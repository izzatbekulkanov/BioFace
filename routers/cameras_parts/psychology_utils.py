from __future__ import annotations

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

    def detect(self, photo_path: Path | None) -> str:
        if photo_path is None:
            return "missing_image"

        recognizer = self._get_recognizer()
        if recognizer is None:
            return "undetermined"

        image_array = _load_image_array(photo_path)
        if image_array is None:
            return "undetermined"

        try:
            result = recognizer.predict_emotions(image_array)
        except Exception as exc:
            LOGGER.debug("hsemotion predict failed for %s: %s", photo_path, exc)
            return "undetermined"

        label = ""
        if isinstance(result, tuple) and result:
            label = _normalize_label(str(result[0] or ""))
        elif isinstance(result, str):
            label = _normalize_label(result)
        elif isinstance(result, dict):
            label = _normalize_label(str(result.get("emotion") or result.get("label") or ""))

        return label or "undetermined"


_DETECTOR = PsychologicalStateDetector()


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
    timestamp: Any = None,
    note: Optional[str] = None,
    source: str = "external_system",
):
    state_key_norm = _normalize_label(str(state_key or ""))
    state_uz, state_ru = state_labels(state_key_norm)
    assessed_at = normalize_timestamp_tashkent(timestamp) or now_tashkent()
    state_date = assessed_at.strftime("%Y-%m-%d")
    source_clean = str(source or "external_system").strip().lower() or "external_system"
    note_clean: str = str(note or "").strip()

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
            state_uz=state_uz,
            state_ru=state_ru,
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
        row.state_uz = state_uz
        row.state_ru = state_ru
        row.source = source_clean
        row.note = note_clean
        row.assessed_at = assessed_at
        row.updated_at = assessed_at
    return row


