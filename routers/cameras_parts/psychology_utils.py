from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path
from typing import Any, Optional
from urllib.parse import unquote, urlparse

import numpy as np
from PIL import Image

from models import EmployeePsychologicalState
from time_utils import normalize_timestamp_tashkent, now_tashkent

try:
    from hsemotion.facial_emotions import HSEmotionRecognizer
except Exception:  # pragma: no cover - optional dependency fallback
    HSEmotionRecognizer = None  # type: ignore[assignment]


LOGGER = logging.getLogger(__name__)
PROJECT_ROOT = Path(__file__).resolve().parents[2]
HSEMOTION_MODEL_NAME = os.getenv("HSEMOTION_MODEL_NAME", "enet_b0_8_best_afew").strip() or "enet_b0_8_best_afew"

STATE_LABELS = {
    "angry": {"uz": "jahli chiqqan", "ru": "раздражён"},
    "disgust": {"uz": "yoqimsiz kayfiyat", "ru": "неприятное состояние"},
    "fear": {"uz": "xavotirli", "ru": "тревожный"},
    "happy": {"uz": "quvnoq", "ru": "радостный"},
    "neutral": {"uz": "xotirjam", "ru": "спокойный"},
    "sad": {"uz": "xafa", "ru": "грустный"},
    "surprise": {"uz": "hayron", "ru": "удивлён"},
    "contempt": {"uz": "befarq", "ru": "безразличный"},
    "missing_image": {"uz": "aniqlanmadi", "ru": "не определено"},
    "undetermined": {"uz": "aniqlanmadi", "ru": "не определено"},
}

STATE_ALIASES = {
    "anger": "angry",
    "happiness": "happy",
    "sadness": "sad",
    "neutral": "neutral",
    "contempt": "contempt",
    "disgust": "disgust",
    "fear": "fear",
    "surprise": "surprise",
    "happy": "happy",
    "sad": "sad",
    "angry": "angry",
}

PROFILELESS_STATES = {"missing_image", "undetermined"}
EMOTION_DISPLAY_ORDER = ("happy", "neutral", "sad", "fear", "angry", "surprise", "disgust", "contempt")


def resolve_snapshot_path(snapshot_url: str) -> Path | None:
    url = str(snapshot_url or "").strip()
    if not url:
        return None

    parsed = urlparse(url)
    if parsed.scheme in {"http", "https"}:
        rel = unquote(parsed.path or "").lstrip("/\\")
        if not rel:
            return None
        candidate = (PROJECT_ROOT / rel).resolve()
        return candidate if candidate.exists() and candidate.is_file() else None

    local_candidate = Path(unquote(url.split("?", 1)[0].strip()))
    if local_candidate.is_absolute() and local_candidate.exists() and local_candidate.is_file():
        return local_candidate

    rel = str(local_candidate).lstrip("/\\")
    candidate = (PROJECT_ROOT / rel).resolve()
    return candidate if candidate.exists() and candidate.is_file() else None


def _normalize_label(value: str) -> str:
    normalized = str(value or "").strip().lower()
    return STATE_ALIASES.get(normalized, normalized)


def _load_image_array(photo_path: Path) -> np.ndarray | None:
    try:
        with Image.open(photo_path) as img:
            return np.array(img.convert("RGB"))
    except Exception as exc:
        LOGGER.debug("snapshot image read failed for %s: %s", photo_path, exc)
        return None


def _patch_torch_load_for_hsemotion() -> None:
    try:
        import torch  # type: ignore
    except Exception:
        return

    original_load = getattr(torch, "load", None)
    if not callable(original_load):
        return

    def _patched_load(*args: Any, **kwargs: Any):
        kwargs.setdefault("weights_only", False)
        return original_load(*args, **kwargs)

    torch.load = _patched_load  # type: ignore[assignment]


def _patch_hsemotion_model_compat(recognizer: Any) -> None:
    model = getattr(recognizer, "model", None)
    if model is None:
        return
    try:
        import torch.nn as nn  # type: ignore
    except Exception:
        return

    for module in model.modules():
        if hasattr(module, "conv_dw"):
            if not hasattr(module, "conv_s2d"):
                module.conv_s2d = None
            if not hasattr(module, "aa"):
                module.aa = nn.Identity()


class PsychologicalStateDetector:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._recognizer: Any | None = None

    def _get_recognizer(self) -> Any | None:
        if HSEmotionRecognizer is None:
            return None
        if self._recognizer is not None:
            return self._recognizer

        with self._lock:
            if self._recognizer is not None:
                return self._recognizer
            try:
                _patch_torch_load_for_hsemotion()
                recognizer = HSEmotionRecognizer(model_name=HSEMOTION_MODEL_NAME)
                _patch_hsemotion_model_compat(recognizer)
                self._recognizer = recognizer
            except Exception as exc:
                LOGGER.warning("hsemotion init failed: %s", exc)
                self._recognizer = None
            return self._recognizer

    def detect_profile(self, photo_path: Path | None) -> dict[str, Any]:
        if photo_path is None:
            return build_psychological_profile("missing_image", confidence=None, emotion_scores={})

        recognizer = self._get_recognizer()
        if recognizer is None:
            return build_psychological_profile("undetermined", confidence=None, emotion_scores={})

        image_array = _load_image_array(photo_path)
        if image_array is None:
            return build_psychological_profile("undetermined", confidence=None, emotion_scores={})

        try:
            result = recognizer.predict_emotions(image_array, logits=False)
        except Exception as exc:
            LOGGER.debug("hsemotion predict failed for %s: %s", photo_path, exc)
            return build_psychological_profile("undetermined", confidence=None, emotion_scores={})

        label = ""
        scores: Any = None
        if isinstance(result, tuple) and result:
            label = _normalize_label(str(result[0] or ""))
            if len(result) > 1:
                scores = result[1]
        elif isinstance(result, str):
            label = _normalize_label(result)
        elif isinstance(result, dict):
            label = _normalize_label(str(result.get("emotion") or result.get("label") or ""))
            scores = result.get("scores") or result.get("probabilities")

        emotion_scores = _extract_emotion_scores(recognizer, scores)
        dominant_key = label or _pick_top_emotion_key(emotion_scores) or "undetermined"
        confidence = emotion_scores.get(dominant_key)
        return build_psychological_profile(dominant_key, confidence=confidence, emotion_scores=emotion_scores)

    def detect(self, photo_path: Path | None) -> str:
        return str(self.detect_profile(photo_path).get("state_key") or "undetermined")


_DETECTOR = PsychologicalStateDetector()


def _normalizable_score(value: Any) -> float:
    try:
        score = float(value)
    except Exception:
        return 0.0
    if not np.isfinite(score):
        return 0.0
    return max(0.0, score)


def normalize_emotion_scores(scores: Any, fallback_state_key: str | None = None) -> dict[str, float]:
    if isinstance(scores, dict):
        raw_items = scores.items()
    else:
        raw_items = []

    normalized: dict[str, float] = {}
    for raw_key, raw_score in raw_items:
        key = _normalize_label(str(raw_key or ""))
        if key in PROFILELESS_STATES or key not in STATE_LABELS:
            continue
        normalized[key] = _normalizable_score(raw_score)

    total = sum(normalized.values())
    if total > 0:
        return {key: value / total for key, value in normalized.items()}

    fallback_key = _normalize_label(str(fallback_state_key or ""))
    if fallback_key and fallback_key not in PROFILELESS_STATES and fallback_key in STATE_LABELS:
        return {fallback_key: 1.0}
    return {}


def _extract_emotion_scores(recognizer: Any | None, scores: Any) -> dict[str, float]:
    if scores is None:
        return {}

    if isinstance(scores, dict):
        return normalize_emotion_scores(scores)

    try:
        raw_scores = list(scores.tolist() if hasattr(scores, "tolist") else scores)
    except Exception:
        return {}

    class_map = getattr(recognizer, "idx_to_class", {}) or {}
    named_scores: dict[str, float] = {}
    for idx, raw_score in enumerate(raw_scores):
        raw_label = class_map.get(idx, idx)
        key = _normalize_label(str(raw_label or ""))
        if key in PROFILELESS_STATES or key not in STATE_LABELS:
            continue
        named_scores[key] = _normalizable_score(raw_score)
    return normalize_emotion_scores(named_scores)


def _pick_top_emotion_key(emotion_scores: dict[str, float]) -> str | None:
    if not emotion_scores:
        return None
    return max(
        emotion_scores.items(),
        key=lambda item: (item[1], -EMOTION_DISPLAY_ORDER.index(item[0]) if item[0] in EMOTION_DISPLAY_ORDER else 0),
    )[0]


def serialize_emotion_scores(emotion_scores: Any) -> str:
    normalized = normalize_emotion_scores(emotion_scores)
    return json.dumps(normalized, ensure_ascii=True, sort_keys=True)


def deserialize_emotion_scores(value: Any) -> dict[str, float]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return normalize_emotion_scores(value)
    raw = str(value or "").strip()
    if not raw:
        return {}
    try:
        return normalize_emotion_scores(json.loads(raw))
    except Exception:
        return {}


def get_top_emotions(emotion_scores: Any, *, top_n: int = 3, language: str = "uz") -> list[dict[str, Any]]:
    scores = normalize_emotion_scores(emotion_scores)
    lang = "ru" if str(language or "").strip().lower() == "ru" else "uz"
    ordered = sorted(
        scores.items(),
        key=lambda item: (-item[1], EMOTION_DISPLAY_ORDER.index(item[0]) if item[0] in EMOTION_DISPLAY_ORDER else 999),
    )
    result: list[dict[str, Any]] = []
    for key, score in ordered[: max(1, int(top_n or 0))]:
        labels = STATE_LABELS.get(key) or STATE_LABELS["undetermined"]
        result.append(
            {
                "key": key,
                "score": round(float(score), 6),
                "percent": round(float(score) * 100, 1),
                "label_uz": labels["uz"],
                "label_ru": labels["ru"],
                "label": labels["ru"] if lang == "ru" else labels["uz"],
            }
        )
    return result


def build_psychological_profile(state_key: str, *, confidence: Any = None, emotion_scores: Any = None) -> dict[str, Any]:
    normalized_state = _normalize_label(str(state_key or "")) or "undetermined"
    normalized_scores = normalize_emotion_scores(emotion_scores, fallback_state_key=normalized_state)
    if normalized_state in PROFILELESS_STATES:
        normalized_scores = {}

    if normalized_state not in STATE_LABELS:
        normalized_state = _pick_top_emotion_key(normalized_scores) or "undetermined"

    confidence_value = _normalizable_score(confidence)
    if confidence_value <= 0 and normalized_scores and normalized_state not in PROFILELESS_STATES:
        confidence_value = _normalizable_score(normalized_scores.get(normalized_state))
    if normalized_state in PROFILELESS_STATES:
        confidence_value = 0.0

    state_uz, state_ru = state_labels(normalized_state)
    top_uz = get_top_emotions(normalized_scores, top_n=3, language="uz")
    top_ru = get_top_emotions(normalized_scores, top_n=3, language="ru")

    return {
        "state_key": normalized_state,
        "state_uz": state_uz,
        "state_ru": state_ru,
        "confidence": round(float(confidence_value), 6) if confidence_value > 0 else None,
        "emotion_scores": normalized_scores,
        "emotion_scores_json": serialize_emotion_scores(normalized_scores) if normalized_scores else "",
        "top_emotions_uz": top_uz,
        "top_emotions_ru": top_ru,
        "profile_text_uz": build_psychological_profile_text(normalized_state, normalized_scores, language="uz"),
        "profile_text_ru": build_psychological_profile_text(normalized_state, normalized_scores, language="ru"),
    }


def build_psychological_profile_text(state_key: str, emotion_scores: Any, *, language: str = "uz", top_n: int = 3) -> str:
    normalized_state = _normalize_label(str(state_key or "")) or "undetermined"
    if normalized_state in PROFILELESS_STATES:
        return state_label_text(normalized_state, language)

    top_items = get_top_emotions(emotion_scores, top_n=top_n, language=language)
    if not top_items:
        return state_label_text(normalized_state, language)
    return ", ".join(f"{item['label']} {item['percent']:.1f}%" for item in top_items)


def aggregate_emotion_scores(score_items: list[Any]) -> dict[str, float]:
    aggregated = {key: 0.0 for key in EMOTION_DISPLAY_ORDER}
    contributing_rows = 0
    for item in score_items:
        scores = normalize_emotion_scores(item)
        if not scores:
            continue
        contributing_rows += 1
        for key, value in scores.items():
            aggregated[key] = aggregated.get(key, 0.0) + float(value)
    if contributing_rows <= 0:
        return {}
    return {
        key: aggregated.get(key, 0.0) / contributing_rows
        for key in EMOTION_DISPLAY_ORDER
        if aggregated.get(key, 0.0) > 0
    }


def detect_psychological_profile(photo_path: Path | None) -> dict[str, Any]:
    return _DETECTOR.detect_profile(photo_path)


def detect_psychological_state(photo_path: Path | None) -> str:
    return _DETECTOR.detect(photo_path)


def state_labels(state_key: str) -> tuple[str, str]:
    key = _normalize_label(str(state_key or ""))
    labels = STATE_LABELS.get(key) or STATE_LABELS["undetermined"]
    return labels["uz"], labels["ru"]


def state_label_text(state_key: str, language: str) -> str:
    uz, ru = state_labels(state_key)
    return ru if str(language or "").strip().lower() == "ru" else uz


def upsert_daily_psychological_state(
    db,
    *,
    employee_id: int,
    state_key: str,
    confidence: Optional[float] = None,
    emotion_scores: Any = None,
    timestamp: Any = None,
    note: Optional[str] = None,
    source: str = "external_system",
):
    profile = build_psychological_profile(state_key, confidence=confidence, emotion_scores=emotion_scores)
    state_key_norm = str(profile["state_key"])
    state_uz = str(profile["state_uz"])
    state_ru = str(profile["state_ru"])
    assessed_at = normalize_timestamp_tashkent(timestamp) or now_tashkent()
    state_date = assessed_at.strftime("%Y-%m-%d")
    source_clean = str(source or "external_system").strip().lower() or "external_system"
    note_clean: str = str(note or "").strip()
    emotion_scores_json = str(profile.get("emotion_scores_json") or "")
    confidence_value = profile.get("confidence")

    row = (
        db.query(EmployeePsychologicalState)
        .filter(
            EmployeePsychologicalState.employee_id == int(employee_id),
            EmployeePsychologicalState.state_date == state_date,
        )
        .order_by(EmployeePsychologicalState.id.desc())
        .first()
    )

    if row is None:
        row = EmployeePsychologicalState(
            employee_id=int(employee_id),
            state_key=state_key_norm,
            state_uz=state_uz,
            state_ru=state_ru,
            confidence=confidence_value,
            emotion_scores_json=emotion_scores_json or None,
            state_date=state_date,
            source=source_clean,
            note=note_clean,
            assessed_at=assessed_at,
            created_at=assessed_at,
            updated_at=assessed_at,
        )
        db.add(row)
        return row

    if str(row.source or "").strip().lower() not in {"manual", "psychologist_assessment", "questionnaire"}:
        row.state_key = state_key_norm
        row.state_uz = state_uz
        row.state_ru = state_ru
        row.confidence = confidence_value
        row.emotion_scores_json = emotion_scores_json or None
        row.source = source_clean
        row.note = note_clean
        row.assessed_at = assessed_at
        row.updated_at = assessed_at
    return row


