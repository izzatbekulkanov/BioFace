from __future__ import annotations

import asyncio
import queue
import json
import logging
import os
import threading
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, unquote

import numpy as np
from PIL import Image
from telegram.error import BadRequest

from redis_client import EVENTS_CHANNEL, get_redis
from bot.formatters import format_camera_event_message
from bot.i18n import normalize_language
from bot.services.bindings import get_bindings_for_employee
from bot.services.employee_lookup import find_employee_by_id, find_employee_by_personal_id, get_today_employee_wellbeing_note

try:
    from hsemotion.facial_emotions import HSEmotionRecognizer
except Exception:  # pragma: no cover - optional dependency fallback
    HSEmotionRecognizer = None  # type: ignore[assignment]


DEFAULT_MESSAGE_EFFECT_ID = os.getenv("TELEGRAM_MESSAGE_EFFECT_ID", "5046509860389126442").strip() or None
PROJECT_ROOT = Path(__file__).resolve().parents[2]
LOGGER = logging.getLogger(__name__)


class CameraEventNotifier:
    def __init__(self, application: Any, loop: asyncio.AbstractEventLoop):
        self.application = application
        self.loop = loop
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._sender_thread: threading.Thread | None = None
        self._pending: queue.Queue[dict[str, Any]] = queue.Queue(maxsize=1000)
        self._emotion_lock = threading.Lock()
        self._emotion_recognizer: Any | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        if self._stop_event.is_set():
            self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._run, name="bioface-telegram-notifier", daemon=True)
        self._thread.start()
        self._sender_thread = threading.Thread(target=self._send_loop, name="bioface-telegram-sender", daemon=True)
        self._sender_thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)
        if self._sender_thread and self._sender_thread.is_alive():
            self._sender_thread.join(timeout=3.0)

    def _run(self) -> None:
        while not self._stop_event.is_set():
            redis_conn = get_redis(check_connection=True)
            if redis_conn is None:
                self._stop_event.wait(2.0)
                continue

            pubsub = redis_conn.pubsub()
            try:
                pubsub.subscribe(EVENTS_CHANNEL)
                while not self._stop_event.is_set():
                    message = pubsub.get_message(timeout=1.0)
                    if not message or message.get("type") != "message":
                        continue
                    self._handle_event(message.get("data"))
            except Exception:
                self._stop_event.wait(2.0)
            finally:
                try:
                    pubsub.close()
                except Exception:
                    pass

    def _handle_event(self, raw_payload: Any) -> None:
        try:
            payload = json.loads(raw_payload) if isinstance(raw_payload, str) else dict(raw_payload or {})
        except Exception:
            return

        employee_id_raw = payload.get("employee_id")
        employee = find_employee_by_id(employee_id_raw)
        if employee is None:
            personal_id = str(payload.get("person_id") or "").strip()
            if not personal_id:
                return
            employee = find_employee_by_personal_id(personal_id)
        if employee is None:
            return

        bindings = get_bindings_for_employee(employee.id)
        if not bindings:
            return

        latest_note = get_today_employee_wellbeing_note(employee.id)

        timestamp = payload.get("timestamp")
        snapshot_url = str(payload.get("snapshot_url") or "").strip()
        payload_state_key = str(payload.get("psychological_state_key") or "").strip()
        payload_state_uz = str(payload.get("psychological_state_uz") or "").strip()
        payload_state_ru = str(payload.get("psychological_state_ru") or "").strip()
        payload_note_uz = str(payload.get("wellbeing_note_uz") or "").strip()
        payload_note_ru = str(payload.get("wellbeing_note_ru") or "").strip()
        photo_path = self._resolve_snapshot_path(snapshot_url)
        psychological_state = payload_state_key or self._detect_psychological_state(photo_path)

        for binding in bindings:
            chat_id = str(binding.telegram_chat_id or "").strip()
            if not chat_id:
                continue
            language = normalize_language(binding.language, fallback="uz")
            if language == "ru" and payload_state_ru:
                psychological_text = payload_state_ru
            elif language != "ru" and payload_state_uz:
                psychological_text = payload_state_uz
            else:
                psychological_text = self._format_psychological_state(psychological_state, language)
            wellbeing_note = ""
            if language == "ru" and payload_note_ru:
                wellbeing_note = payload_note_ru
            elif language != "ru" and payload_note_uz:
                wellbeing_note = payload_note_uz
            elif latest_note is not None:
                wellbeing_note = str(latest_note.note_ru if language == "ru" else latest_note.note_uz or "").strip()
            message = format_camera_event_message(
                employee_name=" ".join(
                    part for part in [employee.first_name, employee.last_name, employee.middle_name] if part and str(part).strip()
                ),
                timestamp=timestamp,
                language=language,
                wellbeing_note=wellbeing_note,
                psychological_state=psychological_text,
            )
            self._enqueue_notification(chat_id=int(chat_id), message=message, photo_path=photo_path)

    def _enqueue_notification(self, *, chat_id: int, message: str, photo_path: Path | None) -> None:
        item = {"chat_id": chat_id, "message": message, "photo_path": str(photo_path) if photo_path else ""}
        try:
            self._pending.put_nowait(item)
        except queue.Full:
            try:
                _ = self._pending.get_nowait()
            except Exception:
                pass
            try:
                self._pending.put_nowait(item)
            except Exception:
                pass

    def _send_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                item = self._pending.get(timeout=1.0)
            except queue.Empty:
                continue

            try:
                photo_path = Path(str(item.get("photo_path") or "")) if item.get("photo_path") else None
                future = asyncio.run_coroutine_threadsafe(
                    self._send_notification(
                        chat_id=int(item.get("chat_id") or 0),
                        message=str(item.get("message") or ""),
                        photo_path=photo_path,
                    ),
                    self.loop,
                )
                future.result(timeout=30.0)
            except Exception:
                # One failed notification must not stop the queue.
                continue

    def _resolve_snapshot_path(self, snapshot_url: str) -> Path | None:
        url = str(snapshot_url or "").strip()
        if not url:
            return None
        parsed = urlparse(url)
        if parsed.scheme in {"http", "https"}:
            rel = unquote(parsed.path or "").lstrip("/")
            if rel:
                candidate = (PROJECT_ROOT / rel).resolve()
                if candidate.exists() and candidate.is_file():
                    return candidate
            return None

        local_candidate = Path(unquote(url.split("?", 1)[0].strip()))
        if local_candidate.is_absolute() and local_candidate.exists() and local_candidate.is_file():
            return local_candidate

        rel = str(local_candidate).lstrip("/\\")
        candidate = (PROJECT_ROOT / rel).resolve()
        if candidate.exists() and candidate.is_file():
            return candidate
        return None

    def _get_emotion_recognizer(self) -> Any | None:
        if HSEmotionRecognizer is None:
            return None
        if self._emotion_recognizer is not None:
            return self._emotion_recognizer
        with self._emotion_lock:
            if self._emotion_recognizer is not None:
                return self._emotion_recognizer
            try:
                self._emotion_recognizer = self._create_hsemotion_recognizer()
            except Exception as exc:
                LOGGER.warning("hsemotion init failed: %s", exc)
                self._emotion_recognizer = None
            return self._emotion_recognizer

    def _create_hsemotion_recognizer(self) -> Any:
        # Torch 2.6 changed torch.load default to weights_only=True, while hsemotion checkpoints need False.
        try:
            import torch  # type: ignore
        except Exception:
            return HSEmotionRecognizer(model_name="enet_b0_8_best_afew")

        original_load = getattr(torch, "load", None)
        if not callable(original_load):
            return HSEmotionRecognizer(model_name="enet_b0_8_best_afew")

        def _patched_load(*args: Any, **kwargs: Any):
            kwargs.setdefault("weights_only", False)
            return original_load(*args, **kwargs)

        torch.load = _patched_load  # type: ignore[assignment]
        try:
            recognizer = HSEmotionRecognizer(model_name="enet_b0_8_best_afew")
            self._patch_hsemotion_model_compat(recognizer)
            return recognizer
        finally:
            torch.load = original_load  # type: ignore[assignment]

    def _patch_hsemotion_model_compat(self, recognizer: Any) -> None:
        # Some hsemotion checkpoints expect legacy timm EfficientNet fields.
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

    def _load_image_array(self, photo_path: Path) -> np.ndarray | None:
        try:
            with Image.open(photo_path) as img:
                return np.array(img.convert("RGB"))
        except Exception as exc:
            LOGGER.debug("snapshot image read failed for %s: %s", photo_path, exc)
            return None

    def _normalize_emotion_label(self, value: str) -> str:
        normalized = str(value or "").strip().lower()
        aliases = {
            "anger": "angry",
            "happiness": "happy",
            "sadness": "sad",
        }
        return aliases.get(normalized, normalized)

    def _detect_psychological_state(self, photo_path: Path | None) -> str:
        if photo_path is None:
            return "missing_image"

        recognizer = self._get_emotion_recognizer()
        if recognizer is None:
            return "undetermined"

        image_array = self._load_image_array(photo_path)
        if image_array is None:
            return "undetermined"

        try:
            result = recognizer.predict_emotions(image_array)
        except Exception as exc:
            LOGGER.debug("hsemotion predict failed for %s: %s", photo_path, exc)
            return "undetermined"

        label = ""
        if isinstance(result, tuple) and result:
            label = self._normalize_emotion_label(str(result[0] or ""))
        elif isinstance(result, str):
            label = self._normalize_emotion_label(result)
        elif isinstance(result, dict):
            label = self._normalize_emotion_label(str(result.get("emotion") or result.get("label") or ""))

        if not label:
            return "undetermined"
        return label

    def _format_psychological_state(self, state: str, language: str) -> str:
        state_labels_uz = {
            "angry": "jahli chiqqan",
            "disgust": "yoqimsiz kayfiyat",
            "fear": "xavotirli",
            "happy": "quvnoq",
            "neutral": "xotirjam",
            "sad": "xafa",
            "surprise": "hayron",
            "contempt": "befarq",
        }
        state_labels_ru = {
            "angry": "раздражён",
            "disgust": "неприятное состояние",
            "fear": "тревожный",
            "happy": "радостный",
            "neutral": "спокойный",
            "sad": "грустный",
            "surprise": "удивлён",
            "contempt": "безразличный",
        }

        if language == "ru":
            if state == "missing_image":
                return "Не определено"
            if state == "undetermined":
                return "Не определено"
            return state_labels_ru.get(state, state)

        if state == "missing_image":
            return "Aniqlanmadi"
        if state == "undetermined":
            return "Aniqlanmadi"
        return state_labels_uz.get(state, state)

    async def _send_notification(self, *, chat_id: int, message: str, photo_path: Path | None) -> None:
        effect_id = DEFAULT_MESSAGE_EFFECT_ID
        if photo_path is not None:
            try:
                with photo_path.open("rb") as photo:
                    kwargs: dict[str, Any] = {
                        "chat_id": chat_id,
                        "photo": photo,
                        "caption": message,
                    }
                    if effect_id:
                        kwargs["message_effect_id"] = effect_id
                    await self.application.bot.send_photo(**kwargs)
                    return
            except BadRequest:
                # Nochmal without effect if Telegram rejects the effect id.
                try:
                    with photo_path.open("rb") as photo:
                        await self.application.bot.send_photo(chat_id=chat_id, photo=photo, caption=message)
                        return
                except Exception:
                    pass
            except Exception:
                pass

        try:
            kwargs = {"chat_id": chat_id, "text": message}
            if effect_id:
                kwargs["message_effect_id"] = effect_id
            await self.application.bot.send_message(**kwargs)
        except BadRequest:
            await self.application.bot.send_message(chat_id=chat_id, text=message)

