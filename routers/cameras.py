"""
Kamera API — real DB bilan ishlaydigan router
GET/POST/DELETE /api/cameras
POST /api/webhook — kameradan kelgan hodisa
POST /api/cameras/{id}/command — kameraga buyruq
"""
import asyncio
import base64
from datetime import datetime, timedelta
import io
import json
import os
import random
import re
import time
import uuid
import zipfile
from urllib.parse import urlsplit
from xml.sax.saxutils import escape as xml_escape
from fastapi import APIRouter, Request, Depends, HTTPException, File, UploadFile, Form, BackgroundTasks
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import or_, case, cast, func, String, literal
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any, Callable, Optional
import httpx
from PIL import Image
from io import BytesIO

from attendance_utils import ATTENDANCE_FLOOD_GUARD_SECONDS, build_attendance_sessions
from database import SessionLocal, get_db
from hikvision_sdk import get_sdk_status
from isup_manager import get_process_status
from models import Device, AttendanceLog, Employee, EmployeeWellbeingNote, Organization, EmployeeCameraLink, UserOrganizationLink
from schedule_utils import get_late_minutes, is_holiday_for_org, resolve_employee_schedule
from time_utils import now_tashkent, normalize_timestamp_tashkent, today_tashkent_range
from system_config import (
    ISUP_API_URL,
    ISUP_KEY,
    get_isup_public_host,
    get_public_web_base_url,
    normalize_public_web_base_url,
)
from routers.cameras_parts import (
    CameraCreate,
    CameraUpdate,
    CommandPayload,
    WebhookPayload,
    _extract_command_camera_info,
    _is_generic_camera_model,
    _is_probable_mac_address,
    _normalize_mac_address,
    _pick_first_nonempty,
    _prefer_persistent_model,
    _resolve_camera_event_push_base_url,
    _resolve_public_web_base_url,
    _strip_or_none,
)
from routers.cameras_parts.routes_event_ingest import router as event_ingest_router
from routers.cameras_parts.psychology_utils import (
    detect_psychological_profile,
    detect_psychological_state,
    resolve_snapshot_path,
    state_labels,
    upsert_daily_psychological_state,
)
from access_control import normalize_role_value
from models import UserRole

# ISUP server manzili (default localhost:7670) — health/info uchun ichki URL

# Redis bridge import (graceful fallback if Redis not available)
try:
    from redis_client import (
        EVENTS_CHANNEL,
        get_isup_device as get_isup_device_from_redis,
        get_isup_devices as get_isup_devices_from_redis,
        get_redis,
        is_connected as redis_ok,
        publish_camera_event,
        send_command_and_wait,
    )
except ImportError:
    EVENTS_CHANNEL = "bioface:events"
    def get_redis(*a, **kw): return None
    def send_command_and_wait(*a, **kw): return None
    def publish_camera_event(*a, **kw): return False
    def get_isup_devices_from_redis(): return []
    def get_isup_device_from_redis(*a, **kw): return None
    def redis_ok(): return False

router = APIRouter()
router.include_router(event_ingest_router)

CAMERA_USER_IMAGE_DIR = os.path.join("static", "uploads", "employees")
os.makedirs(CAMERA_USER_IMAGE_DIR, exist_ok=True)
PERSONAL_ID_PATTERN = re.compile(r"^[1-9]\d{6}$")
WELLBEING_NOTE_SOURCES = {"manual", "operator_observation", "external_ai"}

MAX_FACE_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_FACE_OUTPUT_BYTES = 200 * 1024
MIN_FACE_OUTPUT_BYTES = 2 * 1024
MIN_FACE_SIDE = 160
MAX_FACE_SIDE = 720
MIN_FACE_ASPECT = 0.6
MAX_FACE_ASPECT = 1.67
CAMERA_EVENT_PUSH_PATH = "/api/v1/httppost/"


def _today_local_range() -> tuple[datetime, datetime]:
    return today_tashkent_range()


def _today_utc_range() -> tuple[datetime, datetime]:
    return today_tashkent_range()


_CAMERA_EVENT_DEBUG = os.getenv("CAMERA_EVENT_DEBUG", "0").strip().lower() in {"1", "true", "yes", "on"}


def _camera_event_debug(message: str) -> None:
    if _CAMERA_EVENT_DEBUG:
        print(message)


def _build_camera_event_push_target(request: Request) -> dict[str, str]:
    event_base_url = _resolve_camera_event_push_base_url(request)
    webhook_url = f"{event_base_url}{CAMERA_EVENT_PUSH_PATH}" if event_base_url else ""
    webhook_host = ""
    webhook_port = ""
    if event_base_url:
        try:
            parsed = urlsplit(event_base_url)
            webhook_host = str(parsed.hostname or "").strip()
            if parsed.port:
                webhook_port = str(parsed.port)
            elif parsed.scheme == "https":
                webhook_port = "443"
            elif parsed.scheme == "http":
                webhook_port = "80"
        except Exception:
            webhook_host = ""
            webhook_port = ""
    return {
        "webhook_base_url": event_base_url,
        "webhook_host": webhook_host,
        "webhook_port": webhook_port,
        "webhook_path": CAMERA_EVENT_PUSH_PATH,
        "webhook_url": webhook_url,
    }


def _safe_wellbeing_source(value: Optional[str]) -> str:
    source = str(value or "manual").strip().lower() or "manual"
    return source if source in WELLBEING_NOTE_SOURCES else "manual"


def _resolve_event_wellbeing_snapshot(
    db: Session,
    employee: Optional[Employee],
    *,
    note_uz: Optional[str] = None,
    note_ru: Optional[str] = None,
    source: Optional[str] = None,
) -> tuple[str, str, str]:
    if employee is None:
        return "", "", ""

    uz = str(note_uz or "").strip()
    ru = str(note_ru or "").strip()
    if uz or ru:
        if not uz:
            uz = ru
        if not ru:
            ru = uz
        src = _safe_wellbeing_source(source)
        db.add(
            EmployeeWellbeingNote(
                employee_id=int(employee.id),
                note_uz=uz,
                note_ru=ru,
                source=src,
            )
        )
        return uz, ru, src

    start_dt, end_dt = today_tashkent_range()
    latest_today_note = (
        db.query(EmployeeWellbeingNote)
        .filter(
            EmployeeWellbeingNote.employee_id == int(employee.id),
            EmployeeWellbeingNote.created_at >= start_dt,
            EmployeeWellbeingNote.created_at < end_dt,
        )
        .order_by(EmployeeWellbeingNote.created_at.desc(), EmployeeWellbeingNote.id.desc())
        .first()
    )
    if latest_today_note is None:
        return "", "", ""
    return (
        str(latest_today_note.note_uz or "").strip(),
        str(latest_today_note.note_ru or "").strip(),
        str(latest_today_note.source or "manual").strip() or "manual",
    )


def _get_today_attendance_summary(db: Session, cam: Device) -> dict[str, Any]:
    start, end = _today_local_range()
    raw_total = int(
        db.query(func.count(AttendanceLog.id))
        .filter(
            AttendanceLog.device_id == cam.id,
            AttendanceLog.timestamp >= start,
            AttendanceLog.timestamp < end,
        )
        .scalar()
        or 0
    )

    known_logs = (
        db.query(AttendanceLog)
        .filter(
            AttendanceLog.device_id == cam.id,
            AttendanceLog.timestamp >= start,
            AttendanceLog.timestamp < end,
            AttendanceLog.employee_id.isnot(None),
            AttendanceLog.status != "noma'lum",
        )
        .order_by(AttendanceLog.timestamp.asc(), AttendanceLog.id.asc())
        .all()
    )
    sessions = build_attendance_sessions(known_logs)
    unique_employee_count = len({int(log.employee_id) for log in known_logs if log.employee_id is not None})
    known_session_count = len(sessions)
    known_log_count = len(known_logs)
    unknown = max(0, raw_total - known_log_count)
    latest_known = known_logs[-1].timestamp if known_logs else None
    latest = (
        db.query(AttendanceLog.timestamp)
        .filter(
            AttendanceLog.device_id == cam.id,
            AttendanceLog.timestamp >= start,
            AttendanceLog.timestamp < end,
        )
        .order_by(AttendanceLog.timestamp.desc(), AttendanceLog.id.desc())
        .first()
    )
    return {
        "date": start.strftime("%Y-%m-%d"),
        "count": unique_employee_count,
        "known_count": unique_employee_count,
        "known_session_count": known_session_count,
        "known_log_count": known_log_count,
        "raw_event_count": raw_total,
        "unknown_count": unknown,
        "latest_timestamp": (
            latest_known.isoformat()
            if latest_known is not None
            else (latest[0].isoformat() if latest and latest[0] else None)
        ),
    }


def _parse_camera_timestamp(value: Any) -> Optional[datetime]:
    return normalize_timestamp_tashkent(value)


def _parse_event_timestamp_local(value: Any) -> Optional[datetime]:
    return _parse_camera_timestamp(value)


def _publish_attendance_event_redis(
    *,
    source: str,
    log_id: Optional[int],
    timestamp: Optional[datetime],
    device: Optional[Device],
    employee_id: Optional[int],
    person_id: Optional[str],
    person_name: Optional[str],
    status: str,
    snapshot_url: Optional[str],
    psychological_state_key: Optional[str] = None,
    psychological_state_confidence: Optional[float] = None,
    emotion_scores: Optional[dict[str, float]] = None,
    psychological_state_uz: Optional[str] = None,
    psychological_state_ru: Optional[str] = None,
    psychological_profile_uz: Optional[str] = None,
    psychological_profile_ru: Optional[str] = None,
    psychological_state_source: Optional[str] = None,
    wellbeing_note_uz: Optional[str] = None,
    wellbeing_note_ru: Optional[str] = None,
    wellbeing_note_source: Optional[str] = None,
) -> None:
    payload = {
        "source": source,
        "log_id": int(log_id) if log_id is not None else None,
        "timestamp": timestamp.isoformat() if timestamp else None,
        "camera_id": int(device.id) if device is not None else None,
        "camera_name": str(device.name or "") if device is not None else "",
        "camera_mac": str(device.mac_address or "") if device is not None else "",
        "organization_id": int(device.organization_id) if device is not None and device.organization_id is not None else None,
        "employee_id": int(employee_id) if employee_id is not None else None,
        "person_id": str(person_id or ""),
        "person_name": str(person_name or ""),
        "status": str(status or ""),
        "snapshot_url": str(snapshot_url or ""),
        "psychological_state_key": str(psychological_state_key or ""),
        "psychological_state_confidence": float(psychological_state_confidence) if psychological_state_confidence is not None else None,
        "emotion_scores": dict(emotion_scores or {}),
        "psychological_state_uz": str(psychological_state_uz or ""),
        "psychological_state_ru": str(psychological_state_ru or ""),
        "psychological_profile_uz": str(psychological_profile_uz or ""),
        "psychological_profile_ru": str(psychological_profile_ru or ""),
        "psychological_state_source": str(psychological_state_source or ""),
        "wellbeing_note_uz": str(wellbeing_note_uz or ""),
        "wellbeing_note_ru": str(wellbeing_note_ru or ""),
        "wellbeing_note_source": str(wellbeing_note_source or ""),
    }
    publish_camera_event(payload)


def _normalize_personal_id(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    clean = value.strip()
    return clean or None


def _validate_personal_id_format(personal_id: str) -> None:
    if not PERSONAL_ID_PATTERN.fullmatch(personal_id):
        raise HTTPException(
            status_code=422,
            detail="Shaxsiy ID 7 ta raqam bo'lishi kerak va 0 bilan boshlanmasligi kerak",
        )


def _is_personal_id_taken(db: Session, personal_id: str, *, exclude_id: Optional[int] = None) -> bool:
    query = db.query(Employee.id).filter(Employee.personal_id == personal_id)
    if exclude_id is not None:
        query = query.filter(Employee.id != exclude_id)
    return query.first() is not None


def _generate_unique_personal_id(db: Session, max_attempts: int = 5000) -> str:
    for _ in range(max_attempts):
        candidate = str(random.randint(1000000, 9999999))
        if not _is_personal_id_taken(db, candidate):
            return candidate
    raise HTTPException(status_code=503, detail="Unikal 7 xonali ID generatsiya qilib bo'lmadi")


def _split_full_name(name: str) -> tuple[str, str]:
    clean = str(name or "").strip()
    if not clean:
        return "Noma'lum", ""
    parts = clean.split()
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def _validate_face_geometry(width: int, height: int) -> None:
    if width < MIN_FACE_SIDE or height < MIN_FACE_SIDE:
        raise HTTPException(
            status_code=422,
            detail=f"Rasm juda kichik: kamida {MIN_FACE_SIDE}x{MIN_FACE_SIDE} bo'lishi kerak",
        )
    ratio = width / float(height or 1)
    if ratio < MIN_FACE_ASPECT or ratio > MAX_FACE_ASPECT:
        raise HTTPException(
            status_code=422,
            detail="Rasm proporsiyasi noto'g'ri: kamera uchun 3:5 va 5:3 oralig'ida bo'lishi kerak",
        )


def _encode_camera_jpeg(img: Image.Image) -> bytes:
    out = BytesIO()
    img.save(out, format="JPEG", quality=88, optimize=True)
    data = out.getvalue()
    if len(data) <= MAX_FACE_OUTPUT_BYTES:
        return data

    for quality in (82, 76, 70, 64):
        out = BytesIO()
        img.save(out, format="JPEG", quality=quality, optimize=True)
        data = out.getvalue()
        if len(data) <= MAX_FACE_OUTPUT_BYTES:
            return data

    work = img.copy()
    for side in (640, 560, 480):
        if max(work.size) > side:
            work.thumbnail((side, side), Image.Resampling.LANCZOS)
        out = BytesIO()
        work.save(out, format="JPEG", quality=74, optimize=True)
        data = out.getvalue()
        if len(data) <= MAX_FACE_OUTPUT_BYTES:
            return data
    raise HTTPException(status_code=422, detail="Rasm hajmi katta: 200KB dan oshmasligi kerak")


async def _prepare_camera_face_image(image: UploadFile) -> tuple[str, bytes, str, dict[str, int]]:
    if not image or not image.filename:
        raise HTTPException(status_code=422, detail="Kameraga foydalanuvchi qo'shishda rasm majburiy")

    raw = await image.read()
    if not raw:
        raise HTTPException(status_code=422, detail="Rasm fayli bo'sh")
    if len(raw) > MAX_FACE_UPLOAD_BYTES:
        raise HTTPException(status_code=422, detail="Rasm juda katta: 10MB dan oshmasligi kerak")

    ext = image.filename.rsplit(".", 1)[-1].lower() if "." in image.filename else ""
    if ext and ext not in {"jpg", "jpeg", "png", "webp"}:
        raise HTTPException(status_code=422, detail="Rasm formati noto'g'ri (faqat jpg/png/webp)")

    try:
        with Image.open(BytesIO(raw)) as src:
            frame_count = int(getattr(src, "n_frames", 1) or 1)
            if frame_count > 1:
                raise HTTPException(status_code=422, detail="Animatsion rasm qabul qilinmaydi")

            rgb = src.convert("RGB")
            _validate_face_geometry(rgb.width, rgb.height)
            if max(rgb.size) > MAX_FACE_SIDE:
                rgb.thumbnail((MAX_FACE_SIDE, MAX_FACE_SIDE), Image.Resampling.LANCZOS)

            encoded = _encode_camera_jpeg(rgb)
            if len(encoded) < MIN_FACE_OUTPUT_BYTES:
                raise HTTPException(status_code=422, detail="Rasm sifati past yoki juda kichik")

            filename = f"{uuid.uuid4().hex}.jpg"
            filepath = os.path.join(CAMERA_USER_IMAGE_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(encoded)

            image_url = f"/{CAMERA_USER_IMAGE_DIR.replace(os.sep, '/')}/{filename}"
            return image_url, encoded, "image/jpeg", {
                "width": int(rgb.width),
                "height": int(rgb.height),
                "bytes": int(len(encoded)),
            }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=422, detail="Rasm o'qilmadi yoki buzilgan")


def _push_camera_user_and_face_sync(
    *,
    target_id: str,
    first_name: str,
    last_name: str,
    personal_id: str,
    face_b64: str,
    face_mime: str,
    face_url: str,
    camera_label: str = "",
) -> dict[str, Any]:
    """Background worker: kameraga user va face yozishni requestdan ajratadi."""
    try:
        add_user_response = _send_isup_command_or_raise(
            target_id,
            "add_user",
            {
                "first_name": first_name,
                "last_name": last_name,
                "personal_id": personal_id,
            },
            timeout=12.0,
        )

        set_face_response: Optional[dict[str, Any]] = None
        face_error: Optional[str] = None
        delay = 0.0
        for attempt in range(3):
            if delay > 0:
                time.sleep(delay)
            try:
                set_face_response = _send_isup_command_or_raise(
                    target_id,
                    "set_face",
                    {
                        "personal_id": personal_id,
                        "face_b64": face_b64,
                        "face_mime": face_mime,
                        "face_url": face_url,
                        "allow_http_fallback": True,
                    },
                    timeout=10.0,
                )
                face_error = None
                break
            except HTTPException as exc:
                err = str(exc.detail)
                low = err.lower()
                transient = "code=10" in low or "fpid" in low or "isup javobi kelmadi" in low
                if transient and attempt < 2:
                    delay = 0.08 if attempt == 0 else 0.14
                    continue
                if transient:
                    set_face_response = {
                        "ok": True,
                        "accepted_with_warning": True,
                        "warning": err,
                        "message": "Rasm kameraga yuborildi, yakuniy qo'llanish asinxron bo'lishi mumkin.",
                    }
                else:
                    set_face_response = {"ok": False, "error": err}
                    face_error = err
                break

        result = {
            "ok": bool(add_user_response.get("ok", True)) and bool(set_face_response and set_face_response.get("ok") is not False),
            "camera_label": camera_label,
            "personal_id": personal_id,
            "add_user_response": add_user_response,
            "set_face_response": set_face_response,
            "camera_push_error": face_error,
        }
        print(f"[CAMERA PUSH] background sync done for {camera_label or target_id}: {result}")
        return result
    except Exception as exc:
        result = {
            "ok": False,
            "camera_label": camera_label,
            "personal_id": personal_id,
            "camera_push_error": str(exc),
        }
        print(f"[CAMERA PUSH] background sync failed for {camera_label or target_id}: {exc}")
        return result


def _parse_event_dt(value: Any) -> datetime:
    return _parse_camera_timestamp(value) or now_tashkent()


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "on", "online", "connected", "registered"}


def _extract_users_from_command_response(payload: dict) -> list[dict]:
    if not isinstance(payload, dict):
        return []
    users = payload.get("users")
    if isinstance(users, list):
        return [row for row in users if isinstance(row, dict)]
    response = payload.get("response")
    if isinstance(response, dict):
        nested = response.get("users")
        if isinstance(nested, list):
            return [row for row in nested if isinstance(row, dict)]
    return []


def _extract_face_presence_map(payload: dict) -> dict[str, bool]:
    if not isinstance(payload, dict):
        return {}
    rows = payload.get("records")
    if not isinstance(rows, list):
        rows = []
    result: dict[str, bool] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        fpid = str(row.get("fpid") or "").strip()
        if not fpid:
            continue
        result[fpid] = True
    return result


def _extract_face_record_details(rows: list[dict[str, Any]]) -> tuple[list[dict[str, str]], int, int]:
    details: list[dict[str, str]] = []
    seen: set[str] = set()
    face_records_with_url = 0
    face_records_with_model_data = 0

    for row in rows:
        if not isinstance(row, dict):
            continue
        raw_face = row.get("raw") if isinstance(row.get("raw"), dict) else {}
        sources: list[dict[str, Any]] = [row]
        if raw_face:
            sources.append(raw_face)
            for nested_key in ("EmployeeInfo", "UserInfo", "UserInfoDetail", "AcsEventInfo", "FaceInfo"):
                nested = raw_face.get(nested_key)
                if isinstance(nested, dict):
                    sources.append(nested)

        def _pick(*keys: str) -> str:
            for src in sources:
                for key in keys:
                    if key not in src:
                        continue
                    val = src.get(key)
                    if isinstance(val, dict):
                        for dict_key in ("value", "employeeNo", "employeeNoString", "name", "id", "userID"):
                            nested_val = val.get(dict_key)
                            text = str(nested_val or "").strip()
                            if text:
                                return text
                        continue
                    text = str(val or "").strip()
                    if text:
                        return text
            return ""

        fpid = _pick("fpid", "FPID", "employeeNo", "employeeNoString", "personID", "personId", "userID", "userId")
        if not fpid or fpid in seen:
            continue
        seen.add(fpid)

        face_url = str(row.get("face_url") or "").strip()
        if not face_url:
            face_url = _pick(
                "faceURL",
                "faceUrl",
                "pictureURL",
                "pictureUrl",
                "picUrl",
                "picURL",
                "imageURL",
                "imageUrl",
                "url",
            )

        model_data = _pick(
            "modelData",
            "model_data",
            "faceModelData",
            "face_model_data",
            "pictureData",
            "picture_data",
            "imageData",
            "image_data",
            "faceData",
            "face_data",
            "photoData",
            "photo_data",
            "photo",
        )

        if face_url:
            face_records_with_url += 1
        if model_data:
            face_records_with_model_data += 1

        details.append(
            {
                "employeeNo": fpid,
                "name": _pick("name", "employeeName", "personName", "userName"),
                "face_url": face_url,
                "model_data": model_data,
            }
        )

    return details, face_records_with_url, face_records_with_model_data


def _download_face_to_local(face_url: str, username: str, password: str) -> Optional[str]:
    url = str(face_url or "").strip()
    if not url:
        return None
    try:
        with httpx.Client(
            auth=httpx.DigestAuth(username, password),
            timeout=10.0,
            verify=False,
            trust_env=False,
        ) as client:
            response = client.get(url)
            if response.status_code >= 400 or not response.content:
                return None
            ext = ".jpg"
            content_type = str(response.headers.get("content-type") or "").lower()
            if "png" in content_type:
                ext = ".png"
            filename = f"{uuid.uuid4().hex}{ext}"
            filepath = os.path.join(CAMERA_USER_IMAGE_DIR, filename)
            with open(filepath, "wb") as out:
                out.write(response.content)
        return f"/{CAMERA_USER_IMAGE_DIR.replace(os.sep, '/')}/{filename}"
    except Exception:
        return None


def _strip_data_uri_prefix(value: Any) -> str:
    text = re.sub(r"\s+", "", str(value or "").strip())
    if text.startswith("data:"):
        comma = text.find(",")
        if comma >= 0:
            text = text[comma + 1 :]
    return text


def _decode_base64_payload(value: Any) -> Optional[bytes]:
    text = _strip_data_uri_prefix(value)
    if not text:
        return None
    padding = (-len(text)) % 4
    if padding:
        text += "=" * padding
    try:
        return base64.b64decode(text, validate=False)
    except Exception:
        return None


def _save_face_bytes_to_local(raw: bytes) -> Optional[str]:
    if not raw:
        return None
    if len(raw) > MAX_FACE_UPLOAD_BYTES:
        return None

    try:
        with Image.open(BytesIO(raw)) as src:
            frame_count = int(getattr(src, "n_frames", 1) or 1)
            if frame_count > 1:
                return None

            rgb = src.convert("RGB")
            _validate_face_geometry(rgb.width, rgb.height)
            if max(rgb.size) > MAX_FACE_SIDE:
                rgb.thumbnail((MAX_FACE_SIDE, MAX_FACE_SIDE), Image.Resampling.LANCZOS)

            encoded = _encode_camera_jpeg(rgb)
            if len(encoded) < MIN_FACE_OUTPUT_BYTES:
                return None

            filename = f"{uuid.uuid4().hex}.jpg"
            filepath = os.path.join(CAMERA_USER_IMAGE_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(encoded)

            return f"/{CAMERA_USER_IMAGE_DIR.replace(os.sep, '/')}/{filename}"
    except Exception:
        return None


def _save_face_model_data_to_local(model_data: Any) -> Optional[str]:
    raw = _decode_base64_payload(model_data)
    if not raw:
        return None
    return _save_face_bytes_to_local(raw)


def _read_face_capabilities(target_id: str) -> dict[str, Any]:
    """Kameraning face qidiruv imkoniyatlarini o'qib beradi (best-effort)."""
    try:
        payload = _send_isup_command_or_raise(
            target_id,
            "raw_get",
            {
                "path": "/ISAPI/Intelligent/FDLib/capabilities?format=json",
                "allow_http_fallback": True,
            },
            timeout=12.0,
        )
    except HTTPException:
        return {}
    text = str(payload.get("response") or "") if isinstance(payload, dict) else ""
    if not text:
        return {}
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}


# Schemas and shared helpers were extracted to routers/cameras_parts/*.


def _resolve_device_identifier(raw: Optional[str], db: Session) -> str:
    """
    MAC majburiy emas:
    - berilsa normalizatsiya qilib ishlatadi;
    - bo'sh bo'lsa avtomatik unik identifier beradi.
    """
    candidate = _normalize_mac_address(_strip_or_none(raw))
    if candidate:
        return candidate

    while True:
        generated = f"AUTO-{uuid.uuid4().hex[:12].upper()}"
        exists = db.query(Device).filter(Device.mac_address == generated).first()
        if not exists:
            return generated


def _resolve_camera_identity_inputs(
    *,
    mac_address: Optional[str],
    serial_number: Optional[str],
    db: Session,
) -> tuple[str, Optional[str]]:
    raw_mac = _strip_or_none(mac_address)
    raw_serial = _strip_or_none(serial_number)
    normalized_mac = _normalize_mac_address(raw_mac) if raw_mac and _is_probable_mac_address(raw_mac) else None
    normalized_serial = raw_serial.upper() if raw_serial else None

    # Backward compatibility: eski caller MAC inputiga serial yuborishi mumkin.
    if raw_mac and normalized_mac is None and not normalized_serial:
        normalized_serial = raw_mac.upper()

    return _resolve_device_identifier(normalized_mac, db), normalized_serial


def _resolve_camera_webhook_target_url(request: Request, raw_url: Optional[str]) -> Optional[str]:
    value = str(raw_url or "").strip()
    if not value:
        return None
    if value.startswith("http://") or value.startswith("https://"):
        return value
    base_url = str(_build_camera_event_push_target(request).get("webhook_base_url") or "").rstrip("/")
    if not base_url:
        return value
    return f"{base_url}/{value.lstrip('/')}"


def _as_status_text(value: Any) -> Optional[str]:
    text = str(value or "").strip()
    return text if text else None


def _derive_hik_connect_status(raw_response: Any) -> Optional[str]:
    if raw_response is None:
        return None

    def _status_from_mapping(mapping: dict[str, Any]) -> Optional[str]:
        if not isinstance(mapping, dict):
            return None
        enabled_val = None
        for enabled_key in ("enabled", "enable", "isEnabled", "Enable"):
            if enabled_key in mapping:
                enabled_val = mapping.get(enabled_key)
                break
        enabled_text = str(enabled_val).strip().lower() if enabled_val is not None else None

        for status_key in ("registerStatus", "status", "connectionStatus", "serviceStatus", "state"):
            status_text = _as_status_text(mapping.get(status_key))
            if not status_text:
                continue
            lowered = status_text.lower()
            if lowered in {"online", "connected", "registered", "active", "enable"}:
                return "Connected"
            if lowered in {"offline", "disconnected", "unregistered", "inactive"}:
                return "Offline"
            if lowered in {"disabled", "disable"}:
                return "Disabled"
            if lowered in {"true", "1", "yes", "on"}:
                return "Connected" if status_key == "registerStatus" else "Enabled"
            if lowered in {"false", "0", "no", "off"}:
                if status_key == "registerStatus":
                    return "Disabled" if enabled_text in {"false", "0", "no", "off"} else "Offline"
                return "Disabled"
            return status_text

        if enabled_val is not None:
            if enabled_text in {"true", "1", "yes", "on"}:
                return "Enabled"
            if enabled_text in {"false", "0", "no", "off"}:
                return "Disabled"
        return None

    if isinstance(raw_response, dict):
        for key in ("EZVIZ", "Ezviz", "HikConnect", "hikConnect", "hik_connect"):
            nested = raw_response.get(key)
            derived = _status_from_mapping(nested if isinstance(nested, dict) else raw_response)
            if derived:
                return derived
        return _status_from_mapping(raw_response)

    text = str(raw_response or "").strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
        derived = _derive_hik_connect_status(parsed)
        if derived:
            return derived
    except Exception:
        pass

    try:
        import xml.etree.ElementTree as ET

        clean_xml = re.sub(r'\sxmlns="[^"]+"', '', text, count=1)
        root = ET.fromstring(clean_xml)
        fields = {}
        for tag in ("enabled", "enable", "registerStatus", "status", "connectionStatus", "serviceStatus", "state"):
            node = root.find(f".//{tag}")
            if node is not None and (node.text or "").strip():
                fields[tag] = (node.text or "").strip()
        return _status_from_mapping(fields)
    except Exception:
        return None


def _normalize_live_devices(payload: list) -> dict[str, dict]:
    normalized: dict[str, dict] = {}
    for row in payload or []:
        if not isinstance(row, dict):
            continue
        item = dict(row)
        dev_id = _pick_first_nonempty(item, ("device_id", "id", "deviceId"))
        if not dev_id:
            continue
        item["device_id"] = dev_id
        aliases = [
            dev_id,
            _pick_first_nonempty(item, ("mac_address", "mac", "serial", "sn", "device_serial")),
            _pick_first_nonempty(item, ("display_name", "name", "device_name")),
        ]
        for alias in aliases:
            if not alias:
                continue
            normalized[alias] = item
            normalized[alias.upper()] = item
    return normalized


def _extract_device_list(payload: Any) -> list[dict]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ("devices", "data", "items", "results"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    return []


def _find_live_device_for_camera(cam: Device, isup_map: dict[str, dict]) -> Optional[dict]:
    # Priority: explicit ISUP ID -> MAC -> serial -> camera name
    candidates = []
    if cam.isup_device_id:
        candidates.append(cam.isup_device_id.strip())
    if cam.mac_address:
        candidates.append(cam.mac_address.strip())
    if cam.serial_number:
        candidates.append(cam.serial_number.strip())
    if cam.name:
        candidates.append(cam.name.strip())

    for key in candidates:
        if not key:
            continue
        info = isup_map.get(key) or isup_map.get(key.upper()) or isup_map.get(key.lower())
        if info is not None:
            return info
    return None


def _parse_online_value(value: Any) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on", "online", "connected", "active", "registered"}:
        return True
    if text in {"0", "false", "no", "off", "offline", "disconnected", "inactive", "not_registered"}:
        return False
    return None


def _is_live_device_online(device: dict) -> bool:
    for key in ("online", "status", "connection_state", "state"):
        parsed = _parse_online_value(device.get(key))
        if parsed is not None:
            return parsed
    return True


def _get_live_isup_map() -> tuple[dict[str, dict], str]:
    try:
        response = httpx.get(f"{ISUP_API_URL}/devices", timeout=3.0)
        response.raise_for_status()
        payload = _extract_device_list(response.json() or [])
        return _normalize_live_devices(payload), "isup_rest"
    except Exception:
        if redis_ok():
            payload = _extract_device_list(get_isup_devices_from_redis() or [])
            return _normalize_live_devices(payload), "redis_registry"
    return {}, "unavailable"


def _resolve_online_command_target(cam: Device) -> tuple[str, dict, str]:
    live_map, source = _get_live_isup_map()
    if not live_map:
        raise HTTPException(status_code=503, detail="ISUP live ro'yxat mavjud emas")

    live_info = _find_live_device_for_camera(cam, live_map)
    if not live_info:
        raise HTTPException(status_code=409, detail="Kamera ISUP orqali ro'yxatdan o'tmagan")

    if not _is_live_device_online(live_info):
        raise HTTPException(status_code=409, detail="Kamera offline, buyruq yuborib bo'lmaydi")

    target_id = _pick_first_nonempty(live_info, ("device_id", "id", "deviceId")) or cam.isup_device_id or cam.serial_number or cam.mac_address
    if not target_id:
        raise HTTPException(status_code=400, detail="ISUP Device ID topilmadi")

    return target_id, live_info, source


def _extract_camera_payload_timestamp(payload: WebhookPayload) -> datetime:
    for candidate in (payload.timestamp,):
        parsed = _parse_camera_timestamp(candidate)
        if parsed is not None:
            return parsed
    return now_tashkent()



# ── GET /api/cameras — barcha kameralar ───────────────
@router.get("/api/cameras")
def list_cameras(request: Request, db: Session = Depends(get_db)):
    scope = _resolve_camera_org_scope(request, db)
    cams_query = db.query(Device)
    if not bool(scope.get("is_super_admin")):
        allowed_org_ids = list(scope.get("allowed_org_ids") or [])
        cams_query = (
            cams_query.filter(Device.organization_id.in_(allowed_org_ids))
            if allowed_org_ids
            else cams_query.filter(Device.id == -1)
        )
    cams = cams_query.order_by(Device.id).all()
    push_target = _build_camera_event_push_target(request)
    now = now_tashkent()
    day_start, day_end = _today_local_range()
    isup_map, source = _get_live_isup_map()
    isup_available = source != "unavailable"
    # Kamera 10 daqiqa ichida ping yubormagan bo'lsa -> offline
    online_threshold = timedelta(minutes=10)
    result = []
    for c in cams:
        isup_online = None
        info = _find_live_device_for_camera(c, isup_map) if isup_available else None
        if info is not None:
            isup_online = _is_live_device_online(info)

            live_device_id = _pick_first_nonempty(info, ("device_id",))
            live_model = _pick_first_nonempty(
                info,
                ("device_model", "model", "model_name", "product", "deviceType"),
            )
            live_serial = _pick_first_nonempty(info, ("serial", "serial_no", "serialNumber", "device_serial"))
            live_firmware = _pick_first_nonempty(info, ("firmware_version", "firmware"))
            live_external_ip = _pick_first_nonempty(info, ("remote_ip", "ip"))
            live_protocol_version = _pick_first_nonempty(info, ("isup_version", "protocol_version"))

            if live_device_id and c.isup_device_id != live_device_id:
                c.isup_device_id = live_device_id
            resolved_model = _prefer_persistent_model(c.model, live_model)
            if resolved_model and c.model != resolved_model:
                c.model = resolved_model
            if live_serial and c.serial_number != live_serial:
                c.serial_number = live_serial
            if live_firmware and c.firmware_version != live_firmware:
                c.firmware_version = live_firmware
            if live_external_ip and c.external_ip != live_external_ip:
                c.external_ip = live_external_ip
            if live_protocol_version and c.protocol_version != live_protocol_version:
                c.protocol_version = live_protocol_version
        elif isup_available and c.isup_device_id:
            isup_online = False

        if isup_online is None:
            dynamic_online = bool(c.last_seen_at and (now - c.last_seen_at) <= online_threshold)
        else:
            dynamic_online = isup_online
        # DB dagi is_online ni ham sinxron yangilaymiz (ixtiyoriy, lekin foydali)
        if c.is_online != dynamic_online:
            c.is_online = dynamic_online
        today_summary = _get_today_attendance_summary(db, c)

        result.append({
            "id": c.id,
            "name": c.name,
            "mac_address": c.mac_address,
            "serial_number": c.serial_number,
            "isup_device_id": c.isup_device_id,
            "location": c.location,
            "model": c.model,
            "firmware_version": c.firmware_version,
            "external_ip": c.external_ip,
            "protocol_version": c.protocol_version,
            "webhook_enabled": bool(c.webhook_enabled),
            "webhook_target_url": c.webhook_target_url,
            "webhook_picture_sending": bool(c.webhook_picture_sending),
            "max_memory": c.max_memory,
            "used_faces": c.used_faces,
            "organization_id": c.organization_id,
            "username": c.username,
            "isup_password": c.isup_password or ISUP_KEY,
            "has_password": bool(c.password),
            "is_online": dynamic_online,
            "last_seen_at": c.last_seen_at.isoformat() if c.last_seen_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            **push_target,
            "events_today": int(today_summary.get("count") or 0),
            "today_attendance_count": int(today_summary.get("count") or 0),
            "today_raw_event_count": int(today_summary.get("raw_event_count") or 0),
            "today_unknown_event_count": int(today_summary.get("unknown_count") or 0),
        })
    db.commit()
    return result


# ── POST /api/cameras — yangi kamera qo'shish ─────────
@router.post("/api/cameras")
def add_camera(request: Request, data: CameraCreate, db: Session = Depends(get_db)):
    _assert_camera_manage_access(request)
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Kamera nomi majburiy")

    mac_value, serial_value = _resolve_camera_identity_inputs(
        mac_address=data.mac_address,
        serial_number=data.serial_number,
        db=db,
    )
    isup_device_id = data.isup_device_id.strip() if data.isup_device_id else None
    existing = db.query(Device).filter(Device.mac_address == mac_value).first()
    if existing:
        raise HTTPException(status_code=409, detail="Bu MAC manzil allaqachon ro'yxatdan o'tgan")
    if serial_value:
        existing_serial = db.query(Device).filter(Device.serial_number == serial_value).first()
        if existing_serial:
            raise HTTPException(status_code=409, detail="Bu seriya raqam allaqachon ro'yxatdan o'tgan")
    if isup_device_id:
        existing_isup = db.query(Device).filter(Device.isup_device_id == isup_device_id).first()
        if existing_isup:
            raise HTTPException(status_code=409, detail="Bu ISUP Device ID allaqachon ro'yxatdan o'tgan")
    
    username = _strip_or_none(data.username)
    password = _strip_or_none(data.password)
    isup_password = _strip_or_none(data.isup_password) or ISUP_KEY
    
    # ISUP orqali avtomatik ma'lumotlarni tortib olish
    mac_val = mac_value
    serial_val = serial_value
    model_val = _strip_or_none(data.model)
    firmware_val = _strip_or_none(data.firmware_version)
    external_ip_val = _strip_or_none(data.external_ip)
    protocol_version_val = _strip_or_none(data.protocol_version)
    webhook_enabled_val = bool(data.webhook_enabled) if data.webhook_enabled is not None else False
    webhook_target_url_val = _strip_or_none(data.webhook_target_url)
    webhook_picture_sending_val = bool(data.webhook_picture_sending) if data.webhook_picture_sending is not None else False
    max_memory_val = data.max_memory or 1500

    if isup_device_id:
        try:
            from redis_client import send_command_and_wait
            res = send_command_and_wait(isup_device_id, "get_info", {}, timeout=5)
            if res.get("ok"):
                c_info = res.get("camera_info", {})
                d_info = res.get("device", {})
                
                fetched_mac = _normalize_mac_address(_pick_first_nonempty(c_info, ("macAddress", "MACAddress")))
                if fetched_mac and (not _is_probable_mac_address(mac_val) or str(mac_val).startswith("AUTO-")):
                    mac_val = fetched_mac

                fetched_serial = _pick_first_nonempty(c_info, ("serialNumber",)) or _pick_first_nonempty(d_info, ("serial", "serial_no"))
                if fetched_serial and not serial_val:
                    serial_val = fetched_serial

                fetched_model = c_info.get("model") or d_info.get("model") or d_info.get("device_model")
                if fetched_model and not model_val:
                    model_val = fetched_model

                fetched_firmware = _pick_first_nonempty(c_info, ("firmwareVersion",)) or _pick_first_nonempty(d_info, ("firmware_version", "firmware"))
                if fetched_firmware and not firmware_val:
                    firmware_val = fetched_firmware

                fetched_external_ip = _pick_first_nonempty(d_info, ("remote_ip", "ip"))
                if fetched_external_ip and not external_ip_val:
                    external_ip_val = fetched_external_ip

                fetched_protocol_version = _pick_first_nonempty(d_info, ("isup_version", "protocol_version"))
                if fetched_protocol_version and not protocol_version_val:
                    protocol_version_val = fetched_protocol_version
                    
                # Modellarga qarab avtomatik memory hajmini aniqlash
                if model_val:
                    m_upper = model_val.upper()
                    if "341" in m_upper:
                        max_memory_val = 3000
                    elif "343" in m_upper:
                        max_memory_val = 1500
                    elif "671" in m_upper:
                        max_memory_val = 50000
                    elif "320" in m_upper:
                        max_memory_val = 500
                    elif "321" in m_upper:
                        max_memory_val = 500
                    elif "607" in m_upper:
                        max_memory_val = 6000
                    elif "680" in m_upper:
                        max_memory_val = 100000
        except Exception as e:
            # Xatolik bo'lsa indamay davom etamiz
            print(f"[API] add_camera ISUP auto-fetch error: {e}")
            pass

    mac_conflict = db.query(Device).filter(Device.mac_address == mac_val).first()
    if mac_conflict:
        raise HTTPException(status_code=409, detail="Aniqlangan MAC manzil allaqachon boshqa kameraga biriktirilgan")
    if serial_val:
        serial_conflict = db.query(Device).filter(Device.serial_number == serial_val).first()
        if serial_conflict:
            raise HTTPException(status_code=409, detail="Aniqlangan seriya raqam allaqachon boshqa kameraga biriktirilgan")

    cam = Device(
        name=name,
        mac_address=mac_val or f"TEMP-{uuid.uuid4().hex[:8].upper()}",
        serial_number=serial_val,
        isup_device_id=isup_device_id,
        location=data.location,
        model=model_val,
        firmware_version=firmware_val,
        external_ip=external_ip_val,
        protocol_version=protocol_version_val,
        webhook_enabled=webhook_enabled_val,
        webhook_target_url=webhook_target_url_val,
        webhook_picture_sending=webhook_picture_sending_val,
        max_memory=max_memory_val,
        organization_id=data.organization_id,
        username=username,
        password=password,
        isup_password=isup_password,
    )
    db.add(cam)
    db.commit()
    db.refresh(cam)
    
    # Kamera event push host/path alohida qaytariladi.
    push_target = _build_camera_event_push_target(request)
    webhook_url = push_target["webhook_url"]
    webhook_host = push_target["webhook_host"]
    webhook_port = push_target["webhook_port"]
    webhook_path = push_target["webhook_path"]

    return {
        "ok": True, 
        "id": cam.id, 
        **push_target,
        "message": (
            (
                "Kamera saqlandi. HTTP Listening uchun "
                f"IP: {webhook_host}, Port: {webhook_port}, URL: {webhook_path}"
            )
            if webhook_url
            else "Kamera saqlandi. Avval Sozlamalar sahifasida Camera Event Push Base URL ni belgilang."
        )
    }


# ── DELETE /api/cameras/{id} ───────────────────────────
@router.delete("/api/cameras/{cam_id}")
def delete_camera(request: Request, cam_id: int, db: Session = Depends(get_db)):
    _assert_camera_manage_access(request)
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")
    db.delete(cam)
    db.commit()
    return {"ok": True, "message": "Kamera o'chirildi"}

# ── PUT /api/cameras/{id} ─────────────────────────────
@router.put("/api/cameras/{cam_id}")
def update_camera(request: Request, cam_id: int, data: CameraUpdate, db: Session = Depends(get_db)):
    _assert_camera_manage_access(request)
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")
    
    if data.mac_address is not None:
        incoming_mac_raw = _strip_or_none(data.mac_address)
        if incoming_mac_raw:
            incoming_mac = _normalize_mac_address(incoming_mac_raw) if _is_probable_mac_address(incoming_mac_raw) else None
            if incoming_mac is None:
                raise HTTPException(status_code=422, detail="MAC manzil formati noto'g'ri")
            if incoming_mac != cam.mac_address:
                existing = db.query(Device).filter(Device.mac_address == incoming_mac).first()
                if existing:
                    raise HTTPException(status_code=409, detail="Bu MAC manzil allaqachon mavjud")
                cam.mac_address = incoming_mac

    if data.serial_number is not None:
        incoming_serial = _strip_or_none(data.serial_number)
        if incoming_serial:
            existing_serial = db.query(Device).filter(
                Device.serial_number == incoming_serial,
                Device.id != cam_id,
            ).first()
            if existing_serial:
                raise HTTPException(status_code=409, detail="Bu seriya raqam allaqachon mavjud")
            cam.serial_number = incoming_serial
        else:
            cam.serial_number = None

    if data.isup_device_id is not None:
        isup_device_id = data.isup_device_id.strip() if data.isup_device_id else None
        if isup_device_id:
            existing_isup = db.query(Device).filter(
                Device.isup_device_id == isup_device_id,
                Device.id != cam_id
            ).first()
            if existing_isup:
                raise HTTPException(status_code=409, detail="Bu ISUP Device ID allaqachon mavjud")
        cam.isup_device_id = isup_device_id

    if data.name is not None:
        cam.name = data.name
    if data.location is not None:
        cam.location = data.location
    if data.model is not None:
        cam.model = data.model
    if data.firmware_version is not None:
        cam.firmware_version = _strip_or_none(data.firmware_version)
    if data.external_ip is not None:
        cam.external_ip = _strip_or_none(data.external_ip)
    if data.protocol_version is not None:
        cam.protocol_version = _strip_or_none(data.protocol_version)
    if data.webhook_enabled is not None:
        cam.webhook_enabled = bool(data.webhook_enabled)
    if data.webhook_target_url is not None:
        cam.webhook_target_url = _strip_or_none(data.webhook_target_url)
    if data.webhook_picture_sending is not None:
        cam.webhook_picture_sending = bool(data.webhook_picture_sending)
    if data.max_memory is not None:
        cam.max_memory = data.max_memory
    if data.organization_id is not None:
        cam.organization_id = data.organization_id
    if data.username is not None:
        cam.username = data.username
    if data.password is not None:
        cam.password = data.password
    if data.isup_password is not None:
        cam.isup_password = data.isup_password
        
    db.commit()
    return {"ok": True, "message": "Kamera yangilandi"}


# ── POST /api/webhook — kameradan kelgan hodisa ────────
@router.post("/api/webhook")
def camera_webhook(payload: WebhookPayload, db: Session = Depends(get_db)):
    """
    Kamera BioFace serveriga JSON yuboradi.
    Tizim kamerani MAC manzil bo'yicha topadi.
    Agar TOPILMASA, xabarni qabul qilmaydi (403 xavfsizlik).
    """
    device = db.query(Device).filter(
        or_(
            Device.mac_address == payload.camera_mac,
            Device.serial_number == payload.camera_mac,
            Device.isup_device_id == payload.camera_mac,
        )
    ).first()
    if not device:
        raise HTTPException(status_code=403, detail="Ruxsat etilmagan kamera (MAC manzil ro'yxatda yo'q)")

    ts = _extract_camera_payload_timestamp(payload)

    person_id = (payload.person_id or "").strip()
    person_name = (payload.person_name or "").strip() or None
    employee = None
    if person_id:
        employee = db.query(Employee).filter(Employee.personal_id == person_id).first()
    if employee is None and person_id.isdigit():
        employee = db.query(Employee).filter(Employee.id == int(person_id)).first()
    if employee is not None:
        person_name = f"{employee.first_name or ''} {employee.last_name or ''}".strip() or None

    note_uz, note_ru, note_source = _resolve_event_wellbeing_snapshot(
        db,
        employee,
        note_uz=payload.wellbeing_note_uz,
        note_ru=payload.wellbeing_note_ru,
        source=payload.wellbeing_note_source,
    )
    photo_path = resolve_snapshot_path(payload.snapshot_url or "")
    psychological_profile = detect_psychological_profile(photo_path)
    psychological_state_key = str(psychological_profile.get("state_key") or "")
    psychological_state_uz = str(psychological_profile.get("state_uz") or "")
    psychological_state_ru = str(psychological_profile.get("state_ru") or "")
    psychological_state_confidence = psychological_profile.get("confidence")
    emotion_scores = dict(psychological_profile.get("emotion_scores") or {})
    psychological_profile_uz = str(psychological_profile.get("profile_text_uz") or "")
    psychological_profile_ru = str(psychological_profile.get("profile_text_ru") or "")

    if employee is not None:
        upsert_daily_psychological_state(
            db,
            employee_id=int(employee.id),
            state_key=psychological_state_key,
            confidence=psychological_state_confidence,
            emotion_scores=emotion_scores,
            timestamp=ts,
            note=f"webhook:{device.mac_address or payload.camera_mac}",
            source="external_system",
        )

    log = AttendanceLog(
        employee_id=employee.id if employee else None,
        device_id=device.id,
        camera_mac=device.mac_address,
        person_id=person_id or None,
        person_name=person_name,
        snapshot_url=(payload.snapshot_url or "").strip() or None,
        psychological_state_key=psychological_state_key or None,
        psychological_state_confidence=psychological_state_confidence,
        emotion_scores_json=psychological_profile.get("emotion_scores_json") or None,
        wellbeing_note_uz=note_uz or None,
        wellbeing_note_ru=note_ru or None,
        wellbeing_note_source=note_source or None,
        timestamp=ts,
        status="aniqlandi" if employee else "noma'lum",
    )
    db.add(log)
    db.flush()
    device.is_online = True
    device.last_seen_at = now_tashkent()
    db.commit()

    _publish_attendance_event_redis(
        source="webhook",
        log_id=log.id,
        timestamp=log.timestamp,
        device=device,
        employee_id=int(employee.id) if employee else None,
        person_id=person_id,
        person_name=person_name,
        status=log.status,
        snapshot_url=log.snapshot_url,
        psychological_state_key=psychological_state_key,
        psychological_state_confidence=psychological_state_confidence,
        emotion_scores=emotion_scores,
        psychological_state_uz=psychological_state_uz,
        psychological_state_ru=psychological_state_ru,
        psychological_profile_uz=psychological_profile_uz,
        psychological_profile_ru=psychological_profile_ru,
        psychological_state_source="external_system" if employee else "",
        wellbeing_note_uz=note_uz,
        wellbeing_note_ru=note_ru,
        wellbeing_note_source=note_source,
    )

    return {
        "ok": True,
        "camera_name": device.name,
        "employee_found": employee is not None,
        "log_id": log.id,
        "psychological_state_key": psychological_state_key,
        "psychological_state_confidence": psychological_state_confidence,
        "emotion_scores": emotion_scores,
        "psychological_state_uz": psychological_state_uz,
        "psychological_state_ru": psychological_state_ru,
        "psychological_profile_uz": psychological_profile_uz,
        "psychological_profile_ru": psychological_profile_ru,
        "message": "Ma'lumot qabul qilindi",
    }


# ── DELETE /api/cameras/{id} ───────────────────────────
@router.delete("/api/cameras/{cam_id}")
def delete_camera(request: Request, cam_id: int, db: Session = Depends(get_db)):
    _assert_camera_manage_access(request)
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")
    db.delete(cam)
    db.commit()
    return {"ok": True, "message": "Kamera o'chirildi"}

# ── PUT /api/cameras/{id} ─────────────────────────────
@router.put("/api/cameras/{cam_id}")
def update_camera(request: Request, cam_id: int, data: CameraUpdate, db: Session = Depends(get_db)):
    _assert_camera_manage_access(request)
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")
    
    if data.mac_address is not None:
        incoming_mac_raw = _strip_or_none(data.mac_address)
        if incoming_mac_raw:
            incoming_mac = _normalize_mac_address(incoming_mac_raw) if _is_probable_mac_address(incoming_mac_raw) else None
            if incoming_mac is None:
                raise HTTPException(status_code=422, detail="MAC manzil formati noto'g'ri")
            if incoming_mac != cam.mac_address:
                existing = db.query(Device).filter(Device.mac_address == incoming_mac).first()
                if existing:
                    raise HTTPException(status_code=409, detail="Bu MAC manzil allaqachon mavjud")
                cam.mac_address = incoming_mac

    if data.serial_number is not None:
        incoming_serial = _strip_or_none(data.serial_number)
        if incoming_serial:
            existing_serial = db.query(Device).filter(
                Device.serial_number == incoming_serial,
                Device.id != cam_id,
            ).first()
            if existing_serial:
                raise HTTPException(status_code=409, detail="Bu seriya raqam allaqachon mavjud")
            cam.serial_number = incoming_serial
        else:
            cam.serial_number = None

    if data.isup_device_id is not None:
        isup_device_id = data.isup_device_id.strip() if data.isup_device_id else None
        if isup_device_id:
            existing_isup = db.query(Device).filter(
                Device.isup_device_id == isup_device_id,
                Device.id != cam_id
            ).first()
            if existing_isup:
                raise HTTPException(status_code=409, detail="Bu ISUP Device ID allaqachon mavjud")
        cam.isup_device_id = isup_device_id

    if data.name is not None:
        cam.name = data.name
    if data.location is not None:
        cam.location = data.location
    if data.model is not None:
        cam.model = data.model
    if data.firmware_version is not None:
        cam.firmware_version = _strip_or_none(data.firmware_version)
    if data.external_ip is not None:
        cam.external_ip = _strip_or_none(data.external_ip)
    if data.protocol_version is not None:
        cam.protocol_version = _strip_or_none(data.protocol_version)
    if data.webhook_enabled is not None:
        cam.webhook_enabled = bool(data.webhook_enabled)
    if data.webhook_target_url is not None:
        cam.webhook_target_url = _strip_or_none(data.webhook_target_url)
    if data.webhook_picture_sending is not None:
        cam.webhook_picture_sending = bool(data.webhook_picture_sending)
    if data.max_memory is not None:
        cam.max_memory = data.max_memory
    if data.organization_id is not None:
        cam.organization_id = data.organization_id
    if data.username is not None:
        cam.username = data.username
    if data.password is not None:
        cam.password = data.password
    if data.isup_password is not None:
        cam.isup_password = data.isup_password
        
    db.commit()
    return {"ok": True, "message": "Kamera yangilandi"}


# ── POST /api/webhook — kameradan kelgan hodisa ────────
@router.post("/api/webhook")
def camera_webhook(payload: WebhookPayload, db: Session = Depends(get_db)):
    """
    Kamera BioFace serveriga JSON yuboradi.
    Tizim kamerani MAC manzil bo'yicha topadi.
    Agar TOPILMASA, xabarni qabul qilmaydi (403 xavfsizlik).
    """
    device = db.query(Device).filter(
        or_(
            Device.mac_address == payload.camera_mac,
            Device.serial_number == payload.camera_mac,
            Device.isup_device_id == payload.camera_mac,
        )
    ).first()
    if not device:
        raise HTTPException(status_code=403, detail="Ruxsat etilmagan kamera (MAC manzil ro'yxatda yo'q)")

    ts = _extract_camera_payload_timestamp(payload)

    person_id = (payload.person_id or "").strip()
    person_name = (payload.person_name or "").strip() or None
    employee = None
    if person_id:
        employee = db.query(Employee).filter(Employee.personal_id == person_id).first()
    if employee is None and person_id.isdigit():
        employee = db.query(Employee).filter(Employee.id == int(person_id)).first()
    if employee is not None:
        person_name = f"{employee.first_name or ''} {employee.last_name or ''}".strip() or None

    note_uz, note_ru, note_source = _resolve_event_wellbeing_snapshot(
        db,
        employee,
        note_uz=payload.wellbeing_note_uz,
        note_ru=payload.wellbeing_note_ru,
        source=payload.wellbeing_note_source,
    )
    photo_path = resolve_snapshot_path(payload.snapshot_url or "")
    psychological_profile = detect_psychological_profile(photo_path)
    psychological_state_key = str(psychological_profile.get("state_key") or "")
    psychological_state_uz = str(psychological_profile.get("state_uz") or "")
    psychological_state_ru = str(psychological_profile.get("state_ru") or "")
    psychological_state_confidence = psychological_profile.get("confidence")
    emotion_scores = dict(psychological_profile.get("emotion_scores") or {})
    psychological_profile_uz = str(psychological_profile.get("profile_text_uz") or "")
    psychological_profile_ru = str(psychological_profile.get("profile_text_ru") or "")

    if employee is not None:
        upsert_daily_psychological_state(
            db,
            employee_id=int(employee.id),
            state_key=psychological_state_key,
            confidence=psychological_state_confidence,
            emotion_scores=emotion_scores,
            timestamp=ts,
            note=f"webhook:{device.mac_address or payload.camera_mac}",
            source="external_system",
        )

    log = AttendanceLog(
        employee_id=employee.id if employee else None,
        device_id=device.id,
        camera_mac=device.mac_address,
        person_id=person_id or None,
        person_name=person_name,
        snapshot_url=(payload.snapshot_url or "").strip() or None,
        psychological_state_key=psychological_state_key or None,
        psychological_state_confidence=psychological_state_confidence,
        emotion_scores_json=psychological_profile.get("emotion_scores_json") or None,
        wellbeing_note_uz=note_uz or None,
        wellbeing_note_ru=note_ru or None,
        wellbeing_note_source=note_source or None,
        timestamp=ts,
        status="aniqlandi" if employee else "noma'lum",
    )
    db.add(log)
    db.flush()
    device.is_online = True
    device.last_seen_at = now_tashkent()
    db.commit()

    _publish_attendance_event_redis(
        source="webhook",
        log_id=log.id,
        timestamp=log.timestamp,
        device=device,
        employee_id=int(employee.id) if employee else None,
        person_id=person_id,
        person_name=person_name,
        status=log.status,
        snapshot_url=log.snapshot_url,
        psychological_state_key=psychological_state_key,
        psychological_state_confidence=psychological_state_confidence,
        emotion_scores=emotion_scores,
        psychological_state_uz=psychological_state_uz,
        psychological_state_ru=psychological_state_ru,
        psychological_profile_uz=psychological_profile_uz,
        psychological_profile_ru=psychological_profile_ru,
        psychological_state_source="external_system" if employee else "",
        wellbeing_note_uz=note_uz,
        wellbeing_note_ru=note_ru,
        wellbeing_note_source=note_source,
    )

    return {
        "ok": True,
        "camera_name": device.name,
        "employee_found": employee is not None,
        "log_id": log.id,
        "psychological_state_key": psychological_state_key,
        "psychological_state_confidence": psychological_state_confidence,
        "emotion_scores": emotion_scores,
        "psychological_state_uz": psychological_state_uz,
        "psychological_state_ru": psychological_state_ru,
        "psychological_profile_uz": psychological_profile_uz,
        "psychological_profile_ru": psychological_profile_ru,
        "message": "Ma'lumot qabul qilindi"
    }


# ── POST /api/cameras/{id}/command ────────────────────
ALLOWED_COMMANDS = {
    "ping":         "Kameraga ulanishni tekshirish",
    "get_device_snapshot": "Kameradan batafsil holat/capacity ma'lumotini olish",
    "get_users":    "Kameradagi yuzlar ro'yxatini olish",
    "get_today_attendance_count": "Bugungi attendance sonini olish",
    "get_face_records": "Kameradagi yuz (face record) ro'yxatini olish",
    "sync_faces":   "Serverdan yuz bazasini kameraga sinxronlashtirish",
    "get_face_count": "Kameradan yuz bazasi sonini olish va sinxronlash",
    "get_info":     "Kamera texnik ma'lumotlarini olish",
    "set_face":     "Kamera foydalanuvchisi uchun face rasm yozish",
    "delete_user":  "Kamera foydalanuvchisini o'chirish",
    "restart":      "Kamerani qayta yuklash (Eski)",
    "reboot":       "Kamerani qayta ishga tushirish",
    "open_door":    "Eshikni ochish / Qulfni ochish",
    "clear_logs":   "Kameradagi mahalliy jurnalni tozalash",
    "get_logs":     "Kameraning ichki jurnalini yuklab olish",
    "get_alarm_server": "Kameradan HTTP notification (Event) sozlamalarini olish",
    "set_alarm_server": "Kameraga ISUP/Webhook sozlamalarini yozish",
    "set_tashkent_timezone": "Kameraning vaqtini Asia/Tashkent ga sinxronlash",
    "raw_get":      "ISAPI orqali ixtiyoriy GET so'rov qabul qilish",
    "raw_put":      "ISAPI orqali ixtiyoriy PUT so'rov qabul qilish",
    "raw_post":     "ISAPI orqali ixtiyoriy POST so'rov qabul qilish",
}


def _send_isup_command_or_raise(
    target_device_id: str,
    command: str,
    params: Optional[dict] = None,
    *,
    timeout: float = 10.0,
) -> dict:
    if not redis_ok():
        raise HTTPException(status_code=503, detail="ISUP command bridge (Redis) ulanmagan")
    response = send_command_and_wait(
        target_device_id,
        command,
        params or {},
        timeout=timeout,
    )
    if response is None:
        raise HTTPException(status_code=504, detail="ISUP javobi kelmadi")
    if isinstance(response, dict) and response.get("ok") is False:
        detail = response.get("error") or response.get("message") or "ISUP buyruq bajarilmadi"
        raise HTTPException(status_code=502, detail=str(detail))
    if not isinstance(response, dict):
        raise HTTPException(status_code=502, detail="ISUP noto'g'ri javob qaytardi")
    return response


def _is_not_supported_error(detail: Any) -> bool:
    text = str(detail or "").strip().lower()
    if not text:
        return False
    markers = (
        "notsupported",
        "notsupport",
        "not support",
        "substatuscode=notsupport",
        "statuscode=4",
        "methodnotallowed",
    )
    return any(marker in text for marker in markers)

@router.post("/api/cameras/{cam_id}/command")
def send_command(request: Request, cam_id: int, payload: CommandPayload, db: Session = Depends(get_db)):
    _assert_camera_manage_access(request)
    if payload.command not in ALLOWED_COMMANDS:
        raise HTTPException(status_code=400, detail="Noto'g'ri buyruq")
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")

    if payload.command == "get_today_attendance_count":
        today_attendance = _get_today_attendance_summary(db, cam)
        return {
            "ok": True,
            "transport": "database",
            "isup_source": None,
            "camera": cam.name,
            "command": payload.command,
            "description": ALLOWED_COMMANDS[payload.command],
            "target_device_id": cam.isup_device_id,
            "today_attendance": today_attendance,
            "diagnostics": {
                "source": "http_push_db",
            },
            "response": {
                **today_attendance,
                "source": "http_push_db",
            },
            "message": f"Bazada saqlangan bugungi attendance soni: {today_attendance['count']} ta.",
        }

    params = dict(payload.params or {})
    if payload.command == "set_alarm_server":
        params.setdefault("host", get_isup_public_host())
        event_base_url = _resolve_camera_event_push_base_url(request)
        if event_base_url and not params.get("camera_event_push_base_url") and not params.get("public_web_base_url"):
            params["camera_event_push_base_url"] = event_base_url

    transport_command = payload.command
    if payload.command == "set_tashkent_timezone":
        params.setdefault("force", True)

    target_id, _, source = _resolve_online_command_target(cam)

    response = _send_isup_command_or_raise(
        target_id,
        transport_command,
        params,
        timeout=10.0,
    )

    today_attendance = _get_today_attendance_summary(db, cam)

    return {
        "ok": True,
        "transport": "isup_redis",
        "isup_source": source,
        "camera": cam.name,
        "command": payload.command,
        "description": ALLOWED_COMMANDS[payload.command],
        "target_device_id": target_id,
        "response": response,
        "today_attendance": today_attendance,
        "message": (
            str(response.get("message") or "Kamera vaqti Asia/Tashkent ga sinxronlandi.")
            if payload.command == "set_tashkent_timezone"
            else f"'{ALLOWED_COMMANDS[payload.command]}' buyrug'i ISUP orqali yuborildi. Bugungi attendance: {today_attendance['count']} ta."
        ),
    }


# ── POST /api/cameras/{id}/users ────────────────────
def _collect_camera_users(target_id: str, *, limit: int = 500) -> list[dict]:
    users: list[dict] = []
    max_per_page = 30
    offset = 0
    safe_limit = max(1, min(int(limit), 2000))

    while len(users) < safe_limit:
        response = _send_isup_command_or_raise(
            target_id,
            "get_users",
            {"searchResultPosition": offset, "max_results": max_per_page},
            timeout=12.0,
        )
        page = _extract_users_from_command_response(response)
        if not page:
            break
        users.extend(page)
        total_matches = int(response.get("total_matches") or response.get("count") or len(users))
        offset += len(page)
        if offset >= total_matches:
            break
        if len(page) < max_per_page:
            break
    return users[:safe_limit]


@router.get("/api/cameras/{cam_id}/snapshot")
def get_camera_snapshot(request: Request, cam_id: int, db: Session = Depends(get_db)):
    cam, _ = _get_camera_for_request(request, db, cam_id)

    target_id, live_info, source = _resolve_online_command_target(cam)
    warnings: list[str] = []
    try:
        snapshot_response = _send_isup_command_or_raise(
            target_id,
            "get_device_snapshot",
            {},
            timeout=15.0,
        )
    except HTTPException as exc:
        detail_text = str(exc.detail or "")
        if "notsupport" not in detail_text.lower():
            raise

        info_response = _send_isup_command_or_raise(
            target_id,
            "get_info",
            {},
            timeout=12.0,
        )
        camera_info = _extract_command_camera_info(info_response)
        warnings.append("Kamera ayrim AccessControl endpointlarini qo'llamaydi, soddalashtirilgan snapshot qaytarildi.")
        snapshot_response = {
            "snapshot": {
                "person_information": {
                    "person": {"added": 0, "not_added": 0, "max": 0},
                    "face": {"added": 0, "not_added": 0, "max": 0},
                    "card": {"added": 0, "not_added": 0, "max": 0},
                },
                "network_status": {
                    "wired_network": "Connected" if _as_bool((live_info or {}).get("online")) else "Disconnected",
                    "isup": "Registered" if _as_bool((live_info or {}).get("online")) else "Not Registered",
                    "otap1": "Unknown",
                    "otap2": "Unknown",
                    "hik_connect": "Unknown",
                    "voip": "Unknown",
                },
                "basic_information": {
                    "model": _pick_first_nonempty(camera_info, ("model", "deviceName")) or cam.model or "-",
                    "serial_no": _pick_first_nonempty(camera_info, ("serialNumber", "deviceID")) or "-",
                    "firmware_version": _pick_first_nonempty(camera_info, ("firmwareVersion", "firmwareReleasedDate")) or "-",
                },
                "capacity": {
                    "person_count": 0,
                    "person_max": 0,
                    "face_count": 0,
                    "face_max": 0,
                    "card_count": 0,
                    "card_max": 0,
                    "event_count": 0,
                    "event_max": 0,
                },
                "network": {
                    "ip": _pick_first_nonempty(live_info or {}, ("ip", "remote_ip")) or "-",
                    "mac": _pick_first_nonempty(camera_info, ("macAddress", "MACAddress")) or cam.mac_address or "-",
                    "speed": "",
                    "duplex": "",
                    "addressing_type": "",
                },
                "users_preview": [],
                "users_count": 0,
            },
            "warnings": warnings,
            "transport": info_response.get("transport"),
            "source_transports": {"info": info_response.get("transport")},
        }

    snapshot_payload = snapshot_response.get("snapshot") if isinstance(snapshot_response, dict) else {}
    if not isinstance(snapshot_payload, dict):
        snapshot_payload = {}
        if isinstance(snapshot_response, dict):
            snapshot_response["snapshot"] = snapshot_payload
    network_status = snapshot_payload.setdefault("network_status", {})
    alarm_summary: dict[str, Any] = {}
    hik_connect_status: Optional[str] = None
    changed = False

    try:
        alarm_response = _send_isup_command_or_raise(
            target_id,
            "get_alarm_server",
            {},
            timeout=10.0,
        )
        if isinstance(alarm_response, dict) and isinstance(alarm_response.get("summary"), dict):
            alarm_summary = dict(alarm_response.get("summary") or {})
    except HTTPException:
        alarm_summary = {}

    try:
        ezviz_response = _send_isup_command_or_raise(
            target_id,
            "raw_get",
            {
                "path": "/ISAPI/System/Network/EZVIZ",
                "allow_http_fallback": True,
            },
            timeout=8.0,
        )
        hik_connect_status = _derive_hik_connect_status(
            ezviz_response.get("response") if isinstance(ezviz_response, dict) else ezviz_response
        )
    except HTTPException:
        hik_connect_status = None

    current_hik = str(network_status.get("hik_connect") or "").strip()
    if hik_connect_status:
        network_status["hik_connect"] = hik_connect_status
    elif current_hik.lower() in {"offline", "unknown", ""}:
        network_status["hik_connect"] = "Unknown"

    if isinstance(alarm_summary.get("webhook_enabled"), bool) and cam.webhook_enabled != alarm_summary.get("webhook_enabled"):
        cam.webhook_enabled = bool(alarm_summary.get("webhook_enabled"))
        changed = True
    resolved_webhook_url = _resolve_camera_webhook_target_url(request, alarm_summary.get("webhook_url"))
    if resolved_webhook_url and cam.webhook_target_url != resolved_webhook_url:
        cam.webhook_target_url = resolved_webhook_url
        changed = True
    elif alarm_summary and not resolved_webhook_url and cam.webhook_target_url:
        cam.webhook_target_url = None
        changed = True
    if isinstance(alarm_summary.get("webhook_picture_sending"), bool) and cam.webhook_picture_sending != alarm_summary.get("webhook_picture_sending"):
        cam.webhook_picture_sending = bool(alarm_summary.get("webhook_picture_sending"))
        changed = True
    live_external_ip = _pick_first_nonempty(live_info or {}, ("remote_ip", "ip"))
    if live_external_ip and cam.external_ip != live_external_ip:
        cam.external_ip = live_external_ip
        changed = True
    live_protocol_version = _pick_first_nonempty(live_info or {}, ("isup_version", "protocol_version"))
    if live_protocol_version and cam.protocol_version != live_protocol_version:
        cam.protocol_version = live_protocol_version
        changed = True
    if changed:
        db.commit()
        db.refresh(cam)

    return {
        "ok": True,
        "camera": {
            "id": cam.id,
            "name": cam.name,
            "isup_device_id": cam.isup_device_id,
            "mac_address": cam.mac_address,
            "serial_number": cam.serial_number,
            "model": cam.model,
            "firmware_version": cam.firmware_version,
            "external_ip": cam.external_ip,
            "protocol_version": cam.protocol_version,
            "webhook_enabled": bool(cam.webhook_enabled),
            "webhook_target_url": cam.webhook_target_url,
            "webhook_picture_sending": bool(cam.webhook_picture_sending),
            "organization_id": cam.organization_id,
        },
        "live": live_info,
        "isup_source": source,
        "snapshot": snapshot_payload,
        "warnings": snapshot_response.get("warnings", []),
    }


@router.post("/api/cameras/{cam_id}/sync-metadata")
def sync_camera_metadata(request: Request, cam_id: int, db: Session = Depends(get_db)):
    _assert_camera_manage_access(request)
    cam, _ = _get_camera_for_request(request, db, cam_id)

    target_id, live_info, source = _resolve_online_command_target(cam)
    info_response = _send_isup_command_or_raise(
        target_id,
        "get_info",
        {},
        timeout=12.0,
    )
    camera_info = _extract_command_camera_info(info_response)
    device_info = info_response.get("device") if isinstance(info_response, dict) else {}

    alarm_summary: dict[str, Any] = {}
    updated: dict[str, Any] = {}
    skipped: list[str] = []

    try:
        alarm_response = _send_isup_command_or_raise(
            target_id,
            "get_alarm_server",
            {},
            timeout=12.0,
        )
        if isinstance(alarm_response, dict) and isinstance(alarm_response.get("summary"), dict):
            alarm_summary = dict(alarm_response.get("summary") or {})
    except HTTPException as exc:
        skipped.append(f"Webhook konfiguratsiyasi o'qilmadi: {exc.detail}")

    incoming_model = _pick_first_nonempty(camera_info, ("model", "deviceName"))
    if incoming_model:
        if _is_generic_camera_model(incoming_model) and cam.model and not _is_generic_camera_model(cam.model):
            skipped.append("Model yangilanmadi: generik qiymat ('Hikvision ISUP') bilan custom modelni bosib yuborish bloklandi.")
        elif cam.model != incoming_model:
            cam.model = incoming_model
            updated["model"] = incoming_model

    incoming_isup_device_id = _pick_first_nonempty(info_response, ("device_id",)) or target_id
    if incoming_isup_device_id and cam.isup_device_id != incoming_isup_device_id:
        conflict = db.query(Device).filter(
            Device.isup_device_id == incoming_isup_device_id,
            Device.id != cam.id,
        ).first()
        if conflict:
            skipped.append(f"ISUP Device ID yangilanmadi: '{incoming_isup_device_id}' boshqa kameraga biriktirilgan.")
        else:
            cam.isup_device_id = incoming_isup_device_id
            updated["isup_device_id"] = incoming_isup_device_id

    incoming_mac = _normalize_mac_address(_pick_first_nonempty(camera_info, ("macAddress", "MACAddress")))
    if incoming_mac and cam.mac_address != incoming_mac:
        mac_conflict = db.query(Device).filter(
            Device.mac_address == incoming_mac,
            Device.id != cam.id,
        ).first()
        if mac_conflict:
            skipped.append(f"MAC yangilanmadi: '{incoming_mac}' boshqa kamerada mavjud.")
        else:
            cam.mac_address = incoming_mac
            updated["mac_address"] = incoming_mac

    incoming_serial = _pick_first_nonempty(camera_info, ("serialNumber",)) or _pick_first_nonempty(device_info, ("serial", "serial_no"))
    if incoming_serial and cam.serial_number != incoming_serial:
        serial_conflict = db.query(Device).filter(
            Device.serial_number == incoming_serial,
            Device.id != cam.id,
        ).first()
        if serial_conflict:
            skipped.append(f"Serial yangilanmadi: '{incoming_serial}' boshqa kamerada mavjud.")
        else:
            cam.serial_number = incoming_serial
            updated["serial_number"] = incoming_serial

    incoming_firmware = _pick_first_nonempty(camera_info, ("firmwareVersion",)) or _pick_first_nonempty(device_info, ("firmware_version", "firmware"))
    if incoming_firmware and cam.firmware_version != incoming_firmware:
        cam.firmware_version = incoming_firmware
        updated["firmware_version"] = incoming_firmware

    incoming_external_ip = _pick_first_nonempty(live_info or {}, ("remote_ip", "ip")) or _pick_first_nonempty(device_info, ("remote_ip", "ip"))
    if incoming_external_ip and cam.external_ip != incoming_external_ip:
        cam.external_ip = incoming_external_ip
        updated["external_ip"] = incoming_external_ip

    incoming_protocol_version = (
        _pick_first_nonempty(live_info or {}, ("isup_version", "protocol_version"))
        or _pick_first_nonempty(device_info, ("isup_version", "protocol_version"))
        or _pick_first_nonempty(camera_info, ("protocolVersion",))
    )
    if incoming_protocol_version and cam.protocol_version != incoming_protocol_version:
        cam.protocol_version = incoming_protocol_version
        updated["protocol_version"] = incoming_protocol_version

    if alarm_summary:
        incoming_webhook_enabled = alarm_summary.get("webhook_enabled")
        if isinstance(incoming_webhook_enabled, bool) and cam.webhook_enabled != incoming_webhook_enabled:
            cam.webhook_enabled = incoming_webhook_enabled
            updated["webhook_enabled"] = incoming_webhook_enabled

        incoming_webhook_url = _resolve_camera_webhook_target_url(request, alarm_summary.get("webhook_url"))
        if incoming_webhook_url and cam.webhook_target_url != incoming_webhook_url:
            cam.webhook_target_url = incoming_webhook_url
            updated["webhook_target_url"] = incoming_webhook_url

        incoming_picture_sending = alarm_summary.get("webhook_picture_sending")
        if isinstance(incoming_picture_sending, bool) and cam.webhook_picture_sending != incoming_picture_sending:
            cam.webhook_picture_sending = incoming_picture_sending
            updated["webhook_picture_sending"] = incoming_picture_sending

    if updated:
        db.commit()
        db.refresh(cam)

    return {
        "ok": True,
        "camera_id": cam.id,
        "isup_source": source,
        "updated_fields": updated,
        "skipped": skipped,
        "detected": {
            "device_name": _pick_first_nonempty(camera_info, ("deviceName",)),
            "model": _pick_first_nonempty(camera_info, ("model",)),
            "serial_number": incoming_serial,
            "firmware_version": incoming_firmware,
            "device_uuid": _pick_first_nonempty(camera_info, ("deviceID",)),
            "mac_address": incoming_mac or _pick_first_nonempty(camera_info, ("macAddress", "MACAddress")),
            "external_ip": incoming_external_ip,
            "protocol_version": incoming_protocol_version,
            "webhook_enabled": alarm_summary.get("webhook_enabled"),
            "webhook_target_url": _resolve_camera_webhook_target_url(request, alarm_summary.get("webhook_url")),
            "webhook_picture_sending": alarm_summary.get("webhook_picture_sending"),
        },
        "camera_info": camera_info,
        "device_info": device_info,
        "webhook_summary": alarm_summary,
        "message": "Kamera metadata sinxronlandi." if updated else "Yangi metadata topilmadi.",
    }


@router.get("/api/cameras/{cam_id}/camera-users")
def get_camera_users(request: Request, cam_id: int, limit: int = 300, db: Session = Depends(get_db)):
    cam, _ = _get_camera_for_request(request, db, cam_id)
    target_id, _, source = _resolve_online_command_target(cam)
    try:
        users = _collect_camera_users(target_id, limit=limit)
    except HTTPException as exc:
        if _is_not_supported_error(exc.detail):
            return {
                "ok": True,
                "camera_id": cam.id,
                "camera_name": cam.name,
                "target_device_id": target_id,
                "isup_source": source,
                "count": 0,
                "users": [],
                "unsupported": True,
                "message": "Bu kamera modeli foydalanuvchi/yuz ro'yxatini qo'llamaydi (PTZ/oddiy IP-kamera bo'lishi mumkin).",
            }
        raise

    # Kamera user ro'yxatida har bir user uchun face bor/yo'qligini ko'rsatamiz.
    face_status_available = False
    face_status_error: Optional[str] = None
    face_presence_map: dict[str, bool] = {}
    try:
        face_records_resp = _send_isup_command_or_raise(
            target_id,
            "get_face_records",
            {"all": True, "limit": max(1, min(int(limit), 2000))},
            timeout=20.0,
        )
        face_presence_map = _extract_face_presence_map(face_records_resp)
        face_status_available = True
    except HTTPException as exc:
        face_status_error = str(exc.detail)

    enriched_users: list[dict[str, Any]] = []
    for row in users:
        if not isinstance(row, dict):
            continue
        employee_no = str(row.get("employeeNo") or "").strip()
        enriched = dict(row)
        if not employee_no:
            enriched["has_face_on_camera"] = None
        elif face_status_available:
            enriched["has_face_on_camera"] = bool(face_presence_map.get(employee_no))
        else:
            enriched["has_face_on_camera"] = None
        enriched_users.append(enriched)

    return {
        "ok": True,
        "camera_id": cam.id,
        "camera_name": cam.name,
        "target_device_id": target_id,
        "isup_source": source,
        "count": len(enriched_users),
        "users": enriched_users,
        "face_status_available": face_status_available,
        "face_status_error": face_status_error,
    }


@router.post("/api/cameras/{cam_id}/import-camera-users")
def import_camera_users_to_db(
    cam_id: int,
    limit: int = 500,
    allow_camera_http_download: bool = True,
    face_import_mode: str = "if_missing",
    employee_type: Optional[str] = None,
    only_with_face: bool = False,
    prefer_face_records_only: bool = False,
    progress_cb: Optional[Callable[[int, int, Optional[str], dict[str, Any]], None]] = None,
    db: Session = Depends(get_db),
):
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")
    target_id, _, source = _resolve_online_command_target(cam)

    mode = str(face_import_mode or "if_missing").strip().lower()
    if mode not in {"off", "if_missing", "overwrite"}:
        raise HTTPException(status_code=422, detail="face_import_mode noto'g'ri (off/if_missing/overwrite)")
    emp_type = str(employee_type or "").strip().lower() or None
    if emp_type is not None and emp_type not in {"oquvchi", "oqituvchi", "hodim"}:
        raise HTTPException(status_code=422, detail="employee_type noto'g'ri")

    expected_face_count = 0
    if only_with_face or prefer_face_records_only:
        try:
            count_resp = _send_isup_command_or_raise(
                target_id,
                "get_face_count",
                {},
                timeout=15.0,
            )
            expected_face_count = int(
                count_resp.get("face_count")
                or count_resp.get("bind_face_user_count")
                or count_resp.get("fd_record_total")
                or 0
            )
        except HTTPException:
            expected_face_count = 0

    if progress_cb is not None and (only_with_face or prefer_face_records_only):
        try:
            progress_cb(
                0,
                int(expected_face_count or 0),
                None,
                {
                    "camera_id": int(cam.id),
                    "camera_name": str(cam.name or f"Kamera #{cam.id}"),
                    "created": 0,
                    "updated": 0,
                    "linked_to_camera": 0,
                    "skipped": 0,
                    "imported_users_total": int(expected_face_count or 0),
                    "progress_note": "ISUP orqali face ro'yxati olinmoqda...",
                },
            )
        except Exception:
            pass

    special_incremental_face_only = bool(prefer_face_records_only and mode == "off")
    face_records_error: Optional[str] = None
    face_records: list[dict[str, Any]] = []
    face_record_details: list[dict[str, str]] = []
    face_records_with_url = 0
    face_records_with_model_data = 0
    face_record_map: dict[str, dict[str, str]] = {}
    if not special_incremental_face_only:
        try:
            face_records_timeout = 20.0
            if only_with_face or prefer_face_records_only:
                face_records_timeout = max(60.0, min(420.0, 30.0 + (expected_face_count / 12.0)))
            face_records_resp = _send_isup_command_or_raise(
                target_id,
                "get_face_records",
                {
                    "all": True,
                    "limit": limit,
                    "include_media": mode != "off",
                    "include_raw": mode != "off",
                },
                timeout=face_records_timeout,
            )
            face_records = face_records_resp.get("records", []) if isinstance(face_records_resp, dict) else []
        except HTTPException as exc:
            face_records = []
            face_records_error = str(exc.detail)
        if not isinstance(face_records, list):
            face_records = []
        face_record_details, face_records_with_url, face_records_with_model_data = _extract_face_record_details(face_records)
        face_record_map = {
            str(row.get("employeeNo") or "").strip(): row
            for row in face_record_details
            if str(row.get("employeeNo") or "").strip()
        }

    users: list[dict[str, Any]] = []
    users_error: Optional[str] = None
    if not prefer_face_records_only:
        try:
            users = _collect_camera_users(target_id, limit=limit)
        except HTTPException as exc:
            users_error = str(exc.detail)
            if _is_not_supported_error(exc.detail) and not face_record_map:
                return {
                    "ok": True,
                    "camera_id": cam.id,
                    "camera_name": cam.name,
                    "target_device_id": target_id,
                    "isup_source": source,
                    "unsupported": True,
                    "imported_users_total": 0,
                    "created": 0,
                    "updated": 0,
                    "skipped": 0,
                    "faces_downloaded": 0,
                    "allow_camera_http_download": allow_camera_http_download,
                    "face_records_error": str(exc.detail),
                    "message": "Bu kamera modeli import funksiyasini qo'llamaydi (notsupport).",
                }
            if not only_with_face:
                raise

    if (only_with_face or prefer_face_records_only) and not face_record_map:
        if face_records_error and _is_not_supported_error(face_records_error):
            return {
                "ok": True,
                "camera_id": cam.id,
                "camera_name": cam.name,
                "target_device_id": target_id,
                "isup_source": source,
                "unsupported": True,
                "imported_users_total": 0,
                "created": 0,
                "updated": 0,
                "skipped": 0,
                "faces_downloaded": 0,
                "allow_camera_http_download": allow_camera_http_download,
                "face_records_error": face_records_error,
                "message": "Bu kamera modeli face record import funksiyasini qo'llamaydi.",
            }
        if face_records_error:
            raise HTTPException(status_code=502, detail=f"Face recordlarni olishda xatolik: {face_records_error}")

    face_caps = _read_face_capabilities(target_id)
    supports_fdsearch_data_package = bool(face_caps.get("isSupportFDSearchDataPackage") is True)

    created = 0
    updated = 0
    skipped = 0
    existing = 0
    downloaded_faces = 0
    linked_to_camera = 0
    already_linked = 0
    faces_camera_download_failed = 0
    faces_model_data_not_image = 0
    faces_model_data_save_failed = 0
    faces_isup_direct_downloaded = 0

    existing_links = {
        int(row.employee_id)
        for row in db.query(EmployeeCameraLink.employee_id)
        .filter(EmployeeCameraLink.camera_id == cam.id)
        .all()
    }
    total_users = max(0, min(int(limit), int(expected_face_count or 0)))

    def _emit_progress(done: int, current_personal_id: Optional[str] = None) -> None:
        if progress_cb is None:
            return
        try:
            progress_cb(
                int(done),
                int(total_users),
                current_personal_id,
                {
                    "camera_id": int(cam.id),
                    "camera_name": str(cam.name or f"Kamera #{cam.id}"),
                    "created": int(created),
                    "updated": int(updated),
                    "existing": int(existing),
                    "linked_to_camera": int(linked_to_camera),
                    "already_linked": int(already_linked),
                    "skipped": int(skipped),
                    "imported_users_total": int(total_users),
                    "progress_note": "",
                },
            )
        except Exception:
            return

    def _process_candidate_row(row: dict[str, Any]) -> Optional[str]:
        nonlocal created, updated, skipped, existing, downloaded_faces, linked_to_camera, already_linked
        nonlocal faces_camera_download_failed, faces_model_data_not_image
        nonlocal faces_model_data_save_failed, faces_isup_direct_downloaded

        employee_no = str(row.get("employeeNo") or "").strip()
        full_name = str(row.get("name") or "").strip()
        if not employee_no:
            skipped += 1
            return None

        has_face = bool(row.get("_has_face"))
        if only_with_face and not has_face:
            skipped += 1
            return employee_no

        first_name, last_name = _split_full_name(full_name)
        emp = db.query(Employee).filter(Employee.personal_id == employee_no).first()
        if emp is not None and not full_name:
            full_name = f"{str(emp.first_name or '').strip()} {str(emp.last_name or '').strip()}".strip()
            first_name, last_name = _split_full_name(full_name)
        if not first_name and not last_name:
            first_name = employee_no
            last_name = ""
        if emp is None:
            emp = Employee(
                first_name=first_name,
                last_name=last_name,
                personal_id=employee_no,
                has_access=True,
                organization_id=cam.organization_id,
                employee_type=emp_type,
            )
            db.add(emp)
            db.flush()
            created += 1
        else:
            existing += 1
            changed = False
            if first_name and emp.first_name != first_name:
                emp.first_name = first_name
                changed = True
            if last_name and emp.last_name != last_name:
                emp.last_name = last_name
                changed = True
            if changed:
                updated += 1

        if emp_type is not None and emp.employee_type != emp_type:
            emp.employee_type = emp_type

        if emp.id is not None and int(emp.id) not in existing_links:
            db.add(EmployeeCameraLink(employee_id=int(emp.id), camera_id=int(cam.id)))
            existing_links.add(int(emp.id))
            linked_to_camera += 1
        else:
            already_linked += 1

        face_url = str(row.get("face_url") or "")
        model_data = str(row.get("model_data") or "")
        should_import_face = mode != "off" and (mode == "overwrite" or not emp.image_url)
        image_url = None
        if should_import_face:
            if face_url and allow_camera_http_download and cam.username and cam.password:
                image_url = _download_face_to_local(face_url, cam.username, cam.password)
                if image_url is None:
                    faces_camera_download_failed += 1
            if image_url is None and model_data:
                model_image = _hik_decode_base64_image(model_data)
                if model_image is None:
                    faces_model_data_not_image += 1
                else:
                    image_url = _save_face_bytes_to_local(model_image)
                    if image_url is None:
                        faces_model_data_save_failed += 1
            if image_url is None:
                try:
                    direct_face = _send_isup_command_or_raise(
                        target_id,
                        "get_face_image",
                        {
                            "personal_id": employee_no,
                            "allow_http_fallback": True,
                        },
                        timeout=15.0,
                    )
                except HTTPException:
                    direct_face = {}
                if isinstance(direct_face, dict) and direct_face.get("ok"):
                    image_b64 = str(direct_face.get("image_b64") or "").strip()
                    if image_b64:
                        try:
                            raw = base64.b64decode(image_b64, validate=False)
                        except Exception:
                            raw = b""
                        if raw:
                            image_url = _save_face_bytes_to_local(raw)
                            if image_url is not None:
                                faces_isup_direct_downloaded += 1
            if image_url:
                emp.image_url = image_url
                downloaded_faces += 1

        return employee_no

    _emit_progress(0)
    processed_count = 0
    face_records_total = 0

    if special_incremental_face_only:
        total_users = max(0, min(int(limit), int(expected_face_count or limit)))
        offset = 0
        while processed_count < int(limit):
            remaining = max(1, min(int(limit) - processed_count, 200))
            try:
                page_resp = _send_isup_command_or_raise(
                    target_id,
                    "get_face_records",
                    {
                        "all": False,
                        "limit": remaining,
                        "max_results": 30,
                        "searchResultPosition": offset,
                        "include_media": False,
                        "include_raw": False,
                    },
                    timeout=45.0,
                )
            except HTTPException as exc:
                face_records_error = str(exc.detail)
                raise HTTPException(status_code=502, detail=f"Face recordlarni olishda xatolik: {face_records_error}")

            page_rows = page_resp.get("records", []) if isinstance(page_resp, dict) else []
            if not isinstance(page_rows, list) or not page_rows:
                break
            total_matches = int(page_resp.get("total_matches") or total_users or 0)
            if total_matches > 0:
                total_users = min(int(limit), total_matches)

            page_details, page_url_count, page_model_count = _extract_face_record_details(page_rows)
            face_records_with_url += page_url_count
            face_records_with_model_data += page_model_count
            if not page_details:
                break

            for row in page_details:
                row["_has_face"] = True
                current_personal_id = _process_candidate_row(row)
                processed_count += 1
                face_records_total += 1
                _emit_progress(processed_count, current_personal_id)
                if processed_count >= int(limit):
                    break

            offset += len(page_rows)
            if total_users > 0 and offset >= total_users:
                break
    else:
        candidate_rows: list[dict[str, Any]] = []
        if prefer_face_records_only:
            candidate_rows = [{**row, "_has_face": True} for row in face_record_details]
        else:
            for row in users:
                if not isinstance(row, dict):
                    continue
                employee_no = str(row.get("employeeNo") or "").strip()
                if not employee_no:
                    continue
                if only_with_face and employee_no not in face_record_map:
                    continue
                merged = dict(row)
                face_meta = face_record_map.get(employee_no) or {}
                if face_meta:
                    merged.setdefault("face_url", face_meta.get("face_url") or "")
                    merged.setdefault("model_data", face_meta.get("model_data") or "")
                    if not str(merged.get("name") or "").strip():
                        merged["name"] = str(face_meta.get("name") or "").strip()
                    merged["_has_face"] = True
                else:
                    merged["_has_face"] = False
                candidate_rows.append(merged)

        total_users = len(candidate_rows)
        for idx, row in enumerate(candidate_rows, start=1):
            current_personal_id = _process_candidate_row(row)
            processed_count = idx
            _emit_progress(idx, current_personal_id)
        face_records_total = len(face_records)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import paytida DB xatoligi: {exc}")

    diagnostics: list[str] = []
    if face_caps:
        if not supports_fdsearch_data_package:
            diagnostics.append("Kamera `FDSearchDataPackage` ni qo'llamaydi; import paytida yuz rasmi URL/blob qaytmasligi mumkin.")
    else:
        diagnostics.append("Kamera face capabilities o'qilmadi; rasm import imkoniyati modelga bog'liq bo'lishi mumkin.")
    if face_records_with_model_data and not face_records_with_url and downloaded_faces == 0:
        diagnostics.append("Kamera `get_face_records` javobida asosan `modelData` qaytardi; bu qurilmada bu maydon ko'pincha feature-vector bo'lib, rasm emas.")
    if faces_camera_download_failed:
        diagnostics.append(f"{faces_camera_download_failed} ta faceURL rasmni kameradan yuklab bo'lmadi.")
    if faces_model_data_not_image:
        diagnostics.append(f"{faces_model_data_not_image} ta modelData rasm formati emas (JPEG/PNG/GIF/BMP/WEBP emas).")
    if faces_model_data_save_failed:
        diagnostics.append(f"{faces_model_data_save_failed} ta modelData rasm saqlash validatsiyasidan o'tmadi.")
    if faces_isup_direct_downloaded:
        diagnostics.append(f"{faces_isup_direct_downloaded} ta rasm ISUP get_face_image fallback orqali olindi.")

    return {
        "ok": True,
        "camera_id": cam.id,
        "camera_name": cam.name,
        "target_device_id": target_id,
        "isup_source": source,
        "imported_users_total": total_users,
        "created": created,
        "updated": updated,
        "existing": existing,
        "skipped": skipped,
        "linked_to_camera": linked_to_camera,
        "already_linked": already_linked,
        "faces_downloaded": downloaded_faces,
        "face_records_total": face_records_total,
        "face_records_with_url": face_records_with_url,
        "face_records_with_model_data": face_records_with_model_data,
        "supports_fdsearch_data_package": supports_fdsearch_data_package,
        "faces_camera_download_failed": faces_camera_download_failed,
        "faces_model_data_not_image": faces_model_data_not_image,
        "faces_model_data_save_failed": faces_model_data_save_failed,
        "faces_isup_direct_downloaded": faces_isup_direct_downloaded,
        "allow_camera_http_download": allow_camera_http_download,
        "face_import_mode": mode,
        "only_with_face": bool(only_with_face),
        "prefer_face_records_only": bool(prefer_face_records_only),
        "face_records_error": face_records_error,
        "users_error": users_error,
        "expected_face_count": expected_face_count,
        "diagnostics": diagnostics,
        "message": (
            f"Kameradan bazaga import yakunlandi: {created} yangi, {updated} yangilandi, "
            f"{linked_to_camera} kamera-bog'lanish yaratildi, {downloaded_faces} rasm olindi."
            + (" Faqat face biriktirilgan foydalanuvchilar import qilindi." if only_with_face or prefer_face_records_only else "")
        ),
    }


class AddUserToCameraPayload(BaseModel):
    first_name: str
    last_name: str
    personal_id: Optional[str] = None   # kamera ichidagi shaxsiy ID
    employee_id: Optional[int] = None   # BioFace DB employee ID

@router.post("/api/cameras/{cam_id}/users")
async def add_user_to_camera(
    cam_id: int,
    data: AddUserToCameraPayload,
    db: Session = Depends(get_db)
):
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")

    pid = _normalize_personal_id(data.personal_id)
    if pid is None and data.employee_id:
        pid = str(data.employee_id).strip() or None
    if pid is None:
        pid = _generate_unique_personal_id(db)

    params = {
        "first_name": data.first_name,
        "last_name": data.last_name,
        "personal_id": pid or "",
        "employee_id": data.employee_id,
    }

    target_id, _, _ = _resolve_online_command_target(cam)
    response = await asyncio.to_thread(
        _send_isup_command_or_raise,
        target_id,
        "add_user",
        params,
        timeout=10.0,
    )

    return {
        "ok": True,
        "transport": "isup_redis",
        "personal_id": pid,
        "response": response,
        "message": f"{data.first_name} {data.last_name} (ID: {pid}) — '{cam.name}' kamerasiga yuborildi!",
    }


@router.post("/api/cameras/{cam_id}/sync-employee")
async def sync_employee_to_camera(
    request: Request,
    cam_id: int,
    employee_id: int = Form(...),
    db: Session = Depends(get_db),
):
    with open(r"C:\Users\Izzatbek\Documents\FaceX\TRACER_SYNC.txt", "a") as f:
        f.write(f"Direct sync hit for cam_id={cam_id}, emp_id={employee_id}\n")
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")

    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    target_id, _, _ = _resolve_online_command_target(cam)
    
    # Add link if not exists
    if not db.query(EmployeeCameraLink).filter(
        EmployeeCameraLink.camera_id == cam.id,
        EmployeeCameraLink.employee_id == employee.id
    ).first():
        db.add(EmployeeCameraLink(camera_id=cam.id, employee_id=employee.id))
        db.commit()

    # Push to camera
    public_base = _resolve_public_web_base_url(request)
    face_url = f"{public_base}{employee.image_url}" if employee.image_url else None
    
    response = await asyncio.to_thread(
        _push_camera_user_and_face_sync,
        target_id=target_id,
        first_name=employee.first_name,
        last_name=employee.last_name,
        personal_id=employee.personal_id,
        face_b64=None,
        face_mime=None,
        face_url=face_url,
        camera_label=str(cam.name or ""),
    )
    
    return {"ok": True, "message": "Sinxronizatsiya boshlandi"}


# ── GET /api/cameras/by-org/{org_id} ─────────────────────────────
@router.post("/api/cameras/{cam_id}/users/upload")
async def add_user_to_camera_with_image(
    request: Request,
    background_tasks: BackgroundTasks,
    cam_id: int,
    first_name: str = Form(...),
    last_name: str = Form(...),
    personal_id: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    push_mode: str = Form("background"),
    db: Session = Depends(get_db),
):
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")

    pid = _normalize_personal_id(personal_id)
    if pid is None:
        raise HTTPException(status_code=422, detail="Kameraga saqlash uchun personal_id majburiy")
    _validate_personal_id_format(pid)

    if image is None or not image.filename:
        raise HTTPException(status_code=422, detail="Kameraga foydalanuvchi qo'shishda rasm majburiy")
    image_url, image_bytes, image_mime, image_meta = await _prepare_camera_face_image(image)
    face_b64 = base64.b64encode(image_bytes).decode("ascii")

    employee = db.query(Employee).filter(Employee.personal_id == pid).first()
    if employee is None:
        employee = Employee(
            first_name=first_name,
            last_name=last_name,
            personal_id=pid,
            image_url=image_url,
            has_access=True,
            organization_id=cam.organization_id,
        )
        db.add(employee)
    else:
        employee.first_name = first_name
        employee.last_name = last_name
        if image_url:
            employee.image_url = image_url
        if employee.organization_id is None and cam.organization_id is not None:
            employee.organization_id = cam.organization_id
    db.commit()
    db.refresh(employee)

    push_mode_norm = str(push_mode or "background").strip().lower()
    if push_mode_norm in {"background", "fast", "async", "queued"}:
        add_user_response: dict[str, Any] = {
            "ok": True,
            "queued": True,
            "message": "Foydalanuvchi kamera sinxroni fon rejimida yuboriladi",
        }
        set_face_response: dict[str, Any] = {
            "ok": True,
            "queued": True,
            "message": "Rasm kamera sinxroni fon rejimida yuboriladi",
        }
        camera_push_error: Optional[str] = None
        camera_push_attempted = False
        try:
            target_id, _, _ = _resolve_online_command_target(cam)
            camera_push_attempted = True
            public_base = _resolve_public_web_base_url(request)
            face_url = f"{public_base}{image_url}"
            background_tasks.add_task(
                _push_camera_user_and_face_sync,
                target_id=target_id,
                first_name=first_name,
                last_name=last_name,
                personal_id=pid,
                face_b64=face_b64,
                face_mime=image_mime,
                face_url=face_url,
                camera_label=str(cam.name or ""),
            )
        except HTTPException as exc:
            camera_push_error = str(exc.detail)
            add_user_response = {
                "ok": False,
                "skipped": True,
                "error": camera_push_error,
            }
            set_face_response = {
                "ok": False,
                "skipped": True,
                "error": camera_push_error,
            }

        return {
            "ok": True,
            "camera_id": cam.id,
            "camera_name": cam.name,
            "personal_id": pid,
            "employee_id": employee.id,
            "image_url": image_url,
            "local_saved": True,
            "camera_push_ok": camera_push_error is None,
            "camera_push_queued": bool(camera_push_attempted and camera_push_error is None),
            "camera_push_error": camera_push_error,
            "add_user_response": add_user_response,
            "set_face_response": set_face_response,
            "image_meta": image_meta,
            "message": (
                f"{first_name} {last_name} (ID: {pid}) local bazaga saqlandi. "
                f"Kamera sinxroni fon rejimida davom etmoqda."
            ),
        }

    # Local user saqlangandan keyin kamera tomoniga strict push qilamiz.
    add_user_response: dict[str, Any] = {
        "ok": False,
        "skipped": True,
        "error": "Kamera push hali urinilmadi",
    }
    set_face_response: Optional[dict[str, Any]] = None
    camera_push_error: Optional[str] = None
    camera_push_attempted = False
    try:
        target_id, _, _ = _resolve_online_command_target(cam)
        camera_push_attempted = True
        add_user_response = await asyncio.to_thread(
            _send_isup_command_or_raise,
            target_id,
            "add_user",
            {
                "first_name": first_name,
                "last_name": last_name,
                "personal_id": pid,
            },
            timeout=12.0,
        )

        public_base = _resolve_public_web_base_url(request)
        face_url = f"{public_base}{image_url}"

        # Kamera add_user dan keyin yozuvni darhol qabul qilmasligi mumkin,
        # shuning uchun faqat zarur bo'lsa qisqa retry qilamiz (doimiy sleep yo'q).
        transient_delay = 0.0
        for attempt in range(3):
            if transient_delay > 0:
                await asyncio.sleep(transient_delay)
            try:
                set_face_response = await asyncio.to_thread(
                    _send_isup_command_or_raise,
                    target_id,
                    "set_face",
                    {
                        "personal_id": pid,
                        "face_b64": face_b64,
                        "face_mime": image_mime,
                        "face_url": face_url,
                        "allow_http_fallback": True,
                    },
                    timeout=10.0,
                )
                break
            except HTTPException as exc:
                err = str(exc.detail)
                low = err.lower()
                transient = "code=10" in low or "fpid" in low or "isup javobi kelmadi" in low
                if transient and attempt < 2:
                    # 0.08s -> 0.14s -> 0.22s. Umumiy vaqt kamayadi, lekin kamera tayyor bo'lmasa baribir qayta urinadi.
                    transient_delay = 0.08 if attempt == 0 else 0.14
                    continue
                if transient:
                    # Kamera ko'pincha rasmni qabul qilib bo'ladi, lekin javob kechikadi.
                    set_face_response = {
                        "ok": True,
                        "accepted_with_warning": True,
                        "warning": err,
                        "message": "Rasm kameraga yuborildi, yakuniy qo'llanish asinxron bo'lishi mumkin.",
                    }
                else:
                    set_face_response = {"ok": False, "error": err}
                    camera_push_error = err
                break
    except HTTPException as exc:
        camera_push_error = str(exc.detail)
        add_user_response = {
            "ok": False,
            "skipped": not camera_push_attempted,
            "error": camera_push_error,
        }
        if image_url and image_bytes:
            set_face_response = {
                "ok": False,
                "skipped": True,
                "error": camera_push_error,
            }
    except Exception as exc:
        camera_push_error = f"Noma'lum xatolik: {exc}"
        print(f"[CAMERA UPLOAD] unexpected error for {cam.id}: {exc}")
        add_user_response = {
            "ok": False,
            "skipped": not camera_push_attempted,
            "error": camera_push_error,
        }
        if image_url and image_bytes:
            set_face_response = {
                "ok": False,
                "skipped": True,
                "error": camera_push_error,
            }

    camera_push_ok = camera_push_error is None
    if camera_push_ok and image_url and image_bytes and isinstance(set_face_response, dict):
        if set_face_response.get("ok") is False and not set_face_response.get("skipped"):
            camera_push_ok = False

    # Kamera saqlash rejimi: foydalanuvchi + rasm ikkalasi ham kameraga yozilishi shart.
    if not camera_push_ok:
        raise HTTPException(
            status_code=502,
            detail=(
                f"Kamera saqlash muvaffaqiyatsiz: {camera_push_error or 'foydalanuvchi yoki rasm yozilmadi'}. "
                f"Local employee_id={employee.id}, personal_id={pid} saqlandi."
            ),
        )

    if camera_push_error:
        message = f"{first_name} {last_name} (ID: {pid}) local bazaga saqlandi, lekin kamera pushda muammo: {camera_push_error}"
    elif image_url and image_bytes and set_face_response and set_face_response.get("accepted_with_warning"):
        message = f"{first_name} {last_name} (ID: {pid}) local bazaga saqlandi va face yuborildi, lekin kamera qo'llashi kechikishi mumkin."
    elif image_url and image_bytes and set_face_response and set_face_response.get("ok") is False:
        face_err = set_face_response.get("error") or "Rasmni kamera bazasiga yozishda xatolik"
        if set_face_response.get("skipped"):
            message = f"{first_name} {last_name} (ID: {pid}) local bazaga saqlandi, kamera vaqtincha ulanmagan: {face_err}"
        else:
            message = f"{first_name} {last_name} (ID: {pid}) local bazaga saqlandi, lekin rasmda muammo: {face_err}"
    elif image_url and image_bytes and set_face_response and set_face_response.get("ok"):
        message = f"{first_name} {last_name} (ID: {pid}) local bazaga saqlandi va face kameraga yuborildi."
    else:
        message = f"{first_name} {last_name} (ID: {pid}) local bazaga saqlandi."

    return {
        "ok": True,
        "camera_id": cam.id,
        "camera_name": cam.name,
        "personal_id": pid,
        "employee_id": employee.id,
        "image_url": image_url,
        "local_saved": True,
        "camera_push_ok": camera_push_ok,
        "camera_push_error": camera_push_error,
        "add_user_response": add_user_response,
        "set_face_response": set_face_response,
        "image_meta": image_meta,
        "message": message,
    }


@router.get("/api/cameras/by-org/{org_id}")
def cameras_by_org(request: Request, org_id: int, db: Session = Depends(get_db)):
    """Return cameras belonging to a specific organization."""
    scope = _resolve_camera_org_scope(request, db)
    if not bool(scope.get("is_super_admin")):
        allowed_org_ids = list(scope.get("allowed_org_ids") or [])
        if org_id not in allowed_org_ids:
            return []

    now = now_tashkent()
    isup_map, source = _get_live_isup_map()
    isup_available = source != "unavailable"
    cams = db.query(Device).filter(Device.organization_id == org_id).order_by(Device.name).all()
    result = []
    for c in cams:
        isup_online = None
        info = _find_live_device_for_camera(c, isup_map) if isup_available else None
        if info is not None:
            isup_online = _is_live_device_online(info)
        elif isup_available and c.isup_device_id:
            isup_online = False

        if isup_online is None:
            is_online = bool(c.last_seen_at and (now - c.last_seen_at) <= timedelta(minutes=10))
        else:
            is_online = isup_online
        result.append({
            "id": c.id,
            "name": c.name,
            "mac_address": c.mac_address,
            "isup_device_id": c.isup_device_id,
            "location": c.location,
            "model": c.model,
            "is_online": is_online,
            "organization_id": c.organization_id,
        })
    return result


# ── GET /api/events — so'nggi hodisalar ───────────────
@router.get("/api/events")
def get_events(
    limit: int = 50,
    organization_id: Optional[int] = None,
    camera_id: Optional[int] = None,
    today_only: bool = False,
    paginated: bool = False,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(AttendanceLog)
    if today_only:
        day_start, day_end = _today_utc_range()
        query = query.filter(AttendanceLog.timestamp >= day_start, AttendanceLog.timestamp < day_end)
    if camera_id is not None:
        query = query.filter(AttendanceLog.device_id == camera_id)
    if organization_id is not None:
        query = query.outerjoin(AttendanceLog.device).outerjoin(AttendanceLog.employee).filter(
            or_(
                Device.organization_id == organization_id,
                Employee.organization_id == organization_id,
            )
        )

    # Realtime ko'rinish uchun event kelish tartibini (id) ustuvor qilamiz.
    # Kamera vaqti kech/yoki eski bo'lsa ham yangi yozuv tepada chiqadi.
    order_query = query.order_by(AttendanceLog.id.desc(), AttendanceLog.timestamp.desc())

    if paginated:
        safe_page_size = max(1, min(int(page_size), 200))
        safe_page = max(1, int(page))
        total = int(query.count() or 0)
        total_pages = max(1, (total + safe_page_size - 1) // safe_page_size)
        if total > 0:
            safe_page = min(safe_page, total_pages)
        else:
            safe_page = 1
        offset = (safe_page - 1) * safe_page_size
        logs = order_query.offset(offset).limit(safe_page_size).all()
    else:
        safe_limit = max(1, min(int(limit), 1000))
        logs = order_query.limit(safe_limit).all()

    items = [
        {
            "id": l.id,
            "camera_mac": l.camera_mac,
            "camera_id": l.device_id,
            "camera_name": l.device.name if l.device else None,
            "camera_saved": l.device is not None,
            "person_id": l.person_id,
            "person_name": l.person_name or (f"{l.employee.first_name} {l.employee.last_name}" if l.employee else "Noma'lum"),
            "organization_id": (
                (l.device.organization_id if l.device else None)
                or (l.employee.organization_id if l.employee else None)
            ),
            "organization_name": (
                (l.device.organization.name if l.device and l.device.organization else None)
                or (l.employee.organization.name if l.employee and l.employee.organization else None)
            ),
            "snapshot_url": l.snapshot_url,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
            "status": l.status,
        }
        for l in logs
    ]

    if paginated:
        return {
            "ok": True,
            "items": items,
            "page": safe_page,
            "page_size": safe_page_size,
            "total": total,
            "total_pages": total_pages,
        }
    return items


@router.get("/api/attendance")
def get_attendance(
    limit: int = 300,
    organization_id: Optional[int] = None,
    camera_id: Optional[int] = None,
    after_id: Optional[int] = None,
    today_only: bool = False,
    db: Session = Depends(get_db),
):
    safe_limit = max(1, min(int(limit), 3000))
    query = db.query(AttendanceLog)
    if today_only:
        day_start, day_end = _today_utc_range()
        query = query.filter(AttendanceLog.timestamp >= day_start, AttendanceLog.timestamp < day_end)
    if organization_id is not None:
        query = query.outerjoin(AttendanceLog.device).outerjoin(AttendanceLog.employee).filter(
            or_(
                Device.organization_id == organization_id,
                Employee.organization_id == organization_id,
            )
        )
    if camera_id is not None:
        query = query.filter(AttendanceLog.device_id == camera_id)
    if after_id is not None:
        query = query.filter(AttendanceLog.id > after_id)

    # after_id berilganda faqat yangi yozuvlarni kichikdan kattaga qaytaramiz,
    # aks holda UI uchun oxirgi yozuvlar tepadan pastga (desc) kerak.
    if after_id is not None:
        logs = query.order_by(AttendanceLog.id.asc()).limit(safe_limit).all()
    else:
        logs = query.order_by(AttendanceLog.id.desc(), AttendanceLog.timestamp.desc()).limit(safe_limit).all()

    items = []
    last_id = int(after_id or 0)
    for l in logs:
        if l.id and int(l.id) > last_id:
            last_id = int(l.id)
        organization = None
        if l.device and l.device.organization:
            organization = l.device.organization
        elif l.employee and l.employee.organization:
            organization = l.employee.organization


        employee_name = None
        personal_id = l.person_id
        if l.employee:
            employee_name = f"{l.employee.first_name} {l.employee.last_name}".strip()
            if l.employee.personal_id:
                personal_id = l.employee.personal_id
        if not employee_name:
            employee_name = l.person_name or "Noma'lum"

        items.append(
            {
                "id": l.id,
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
                "status": l.status,
                "employee_id": l.employee_id,
                "employee_name": employee_name,
                "personal_id": personal_id,
                "person_name": l.person_name,
                "camera_id": l.device_id,
                "camera_name": l.device.name if l.device else None,
                "camera_mac": l.camera_mac,
                "camera_isup_device_id": l.device.isup_device_id if l.device else None,
                "organization_id": organization.id if organization else None,
                "organization_name": organization.name if organization else None,
                "snapshot_url": l.snapshot_url,
            }
        )
    return {"ok": True, "count": len(items), "items": items, "last_id": last_id}


def _attendance_group_identity_expr():
    fallback_key = func.coalesce(
        func.nullif(func.trim(AttendanceLog.person_id), ""),
        func.nullif(func.trim(AttendanceLog.person_name), ""),
        func.nullif(func.trim(AttendanceLog.camera_mac), ""),
        literal("unknown"),
    )
    return case(
        (AttendanceLog.employee_id.isnot(None), literal("e:") + cast(AttendanceLog.employee_id, String)),
        else_=literal("u:") + fallback_key,
    )


def _apply_attendance_filters(
    query,
    *,
    organization_id: Optional[int],
    camera_id: Optional[int],
    personal_id: Optional[str],
    year: Optional[int],
    month: Optional[int],
    day: Optional[int],
):
    if organization_id is not None:
        query = query.filter(
            or_(
                AttendanceLog.device.has(Device.organization_id == organization_id),
                AttendanceLog.employee.has(Employee.organization_id == organization_id),
            )
        )
    if camera_id is not None:
        query = query.filter(AttendanceLog.device_id == camera_id)
    personal_id_val = _normalize_personal_id(personal_id)
    if personal_id_val:
        query = query.filter(
            or_(
                func.coalesce(func.nullif(func.trim(AttendanceLog.person_id), ""), "") == personal_id_val,
                AttendanceLog.employee.has(Employee.personal_id == personal_id_val),
            )
        )
    if year is not None:
        query = query.filter(func.strftime("%Y", AttendanceLog.timestamp) == f"{int(year):04d}")
    if month is not None:
        query = query.filter(func.strftime("%m", AttendanceLog.timestamp) == f"{int(month):02d}")
    if day is not None:
        query = query.filter(func.strftime("%d", AttendanceLog.timestamp) == f"{int(day):02d}")
    return query


def _resolve_attendance_org_scope(request: Request, db: Session) -> dict[str, Any]:
    auth_user = request.session.get("auth_user") or {}
    org_query = db.query(Organization.id, Organization.name, Organization.subscription_status)
    org_ids: set[int] = set()
    user_id = auth_user.get("id")
    has_linked_orgs = False
    if user_id is not None:
        rows = (
            db.query(UserOrganizationLink.organization_id)
            .filter(UserOrganizationLink.user_id == int(user_id))
            .all()
        )
        org_ids.update(int(row.organization_id) for row in rows if row.organization_id is not None)
        has_linked_orgs = bool(org_ids)

    fallback_org_id = auth_user.get("organization_id")
    if not has_linked_orgs and fallback_org_id is not None:
        org_ids.add(int(fallback_org_id))

    if not org_ids:
        return {
            "allowed_org_ids": [],
            "pending_org_names": [],
        }

    org_rows = org_query.filter(Organization.id.in_(sorted(org_ids))).all()

    if not org_rows:
        return {
            "allowed_org_ids": [],
            "pending_org_names": [],
        }

    allowed_org_ids: list[int] = []
    pending_org_names: list[str] = []
    for org_id, org_name, sub_status in org_rows:
        status = str(sub_status.value if hasattr(sub_status, "value") else sub_status or "").strip().lower()
        if status == "expired":
            continue
        allowed_org_ids.append(int(org_id))
        if status == "pending":
            pending_org_names.append(str(org_name or ""))

    return {
        "allowed_org_ids": allowed_org_ids,
        "pending_org_names": pending_org_names,
    }


def _request_is_super_admin(request: Request) -> bool:
    auth_user = request.session.get("auth_user") or {}
    return normalize_role_value(auth_user.get("role")) == UserRole.super_admin.value


def _resolve_camera_org_scope(request: Request, db: Session) -> dict[str, Any]:
    if _request_is_super_admin(request):
        allowed_org_ids = [
            int(row.id)
            for row in db.query(Organization.id).all()
            if getattr(row, "id", None) is not None
        ]
        return {
            "is_super_admin": True,
            "allowed_org_ids": allowed_org_ids,
        }

    scope = _resolve_attendance_org_scope(request, db)
    return {
        "is_super_admin": False,
        "allowed_org_ids": list(scope.get("allowed_org_ids") or []),
        "pending_org_names": list(scope.get("pending_org_names") or []),
    }


def _assert_camera_manage_access(request: Request) -> None:
    if not _request_is_super_admin(request):
        raise HTTPException(
            status_code=403,
            detail="Kamera boshqaruvi faqat asosiy administrator uchun ruxsat etilgan",
        )


def _get_camera_for_request(request: Request, db: Session, cam_id: int) -> tuple[Device, dict[str, Any]]:
    scope = _resolve_camera_org_scope(request, db)
    query = db.query(Device).filter(Device.id == cam_id)
    if not bool(scope.get("is_super_admin")):
        allowed_org_ids = list(scope.get("allowed_org_ids") or [])
        if not allowed_org_ids:
            raise HTTPException(status_code=404, detail="Kamera topilmadi")
        query = query.filter(Device.organization_id.in_(allowed_org_ids))

    cam = query.first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")
    return cam, scope


@router.get("/api/attendance/filter-data")
def get_attendance_filter_data(request: Request, db: Session = Depends(get_db)):
    scope = _resolve_attendance_org_scope(request, db)
    allowed_org_ids = list(scope.get("allowed_org_ids") or [])
    if not allowed_org_ids:
        return {"ok": True, "organizations": [], "cameras": []}

    org_rows = (
        db.query(Organization.id, Organization.name)
        .filter(Organization.id.in_(allowed_org_ids))
        .order_by(Organization.name.asc())
        .all()
    )
    cam_rows = (
        db.query(Device.id, Device.name, Device.organization_id)
        .filter(Device.organization_id.in_(allowed_org_ids))
        .order_by(Device.name.asc())
        .all()
    )

    return {
        "ok": True,
        "organizations": [
            {"id": int(row.id), "name": str(row.name or "")}
            for row in org_rows
        ],
        "cameras": [
            {
                "id": int(row.id),
                "name": str(row.name or ""),
                "organization_id": int(row.organization_id) if row.organization_id is not None else None,
            }
            for row in cam_rows
        ],
    }


def _parse_hhmm_or_default(value: Optional[str], default_h: int = 9, default_m: int = 0) -> tuple[int, int]:
    raw = str(value or "").strip()
    if not raw:
        return default_h, default_m
    parts = raw.split(":")
    if len(parts) < 2:
        return default_h, default_m
    try:
        h = max(0, min(23, int(parts[0])))
        m = max(0, min(59, int(parts[1])))
        return h, m
    except Exception:
        return default_h, default_m


def _format_camera_label(camera_names: list[str]) -> str:
    safe_names = [str(name or "").strip() for name in camera_names if str(name or "").strip()]
    if not safe_names:
        return "Noma'lum kamera"
    if len(safe_names) == 1:
        return safe_names[0]
    preview = ", ".join(safe_names[:2])
    if len(safe_names) > 2:
        return f"{preview} +{len(safe_names) - 2}"
    return preview


def _build_attendance_session_payload(session_logs: list[AttendanceLog]) -> dict[str, Any]:
    ordered_logs = sorted(
        [log for log in session_logs if log.timestamp is not None],
        key=lambda log: (log.timestamp or datetime.min, log.id or 0),
    )
    if not ordered_logs:
        return {
            "id": "",
            "timestamp": None,
            "first_timestamp": None,
            "camera_id": None,
            "camera_name": "Noma'lum kamera",
            "camera_mac": None,
            "camera_count": 0,
            "raw_event_count": 0,
            "snapshot_url": None,
            "status": "noma'lum",
        }

    first_log = ordered_logs[0]
    last_log = ordered_logs[-1]
    snapshot_log = next((log for log in reversed(ordered_logs) if log.snapshot_url), last_log)
    camera_ids: set[int] = set()
    camera_names: list[str] = []
    camera_macs: list[str] = []
    for log in ordered_logs:
        if log.device_id is not None:
            camera_ids.add(int(log.device_id))
        camera_name = str(log.device.name or "").strip() if log.device is not None else ""
        if camera_name and camera_name not in camera_names:
            camera_names.append(camera_name)
        camera_mac = str(log.camera_mac or "").strip()
        if camera_mac and camera_mac not in camera_macs:
            camera_macs.append(camera_mac)

    duration_seconds = 0
    if first_log.timestamp and last_log.timestamp:
        duration_seconds = max(0, int((last_log.timestamp - first_log.timestamp).total_seconds()))

    return {
        "id": f"session:{first_log.id or 'x'}:{last_log.id or 'y'}",
        "timestamp": last_log.timestamp.isoformat() if last_log.timestamp else None,
        "first_timestamp": first_log.timestamp.isoformat() if first_log.timestamp else None,
        "camera_id": int(last_log.device_id) if last_log.device_id is not None and len(camera_ids) == 1 else None,
        "camera_name": _format_camera_label(camera_names),
        "camera_names": camera_names,
        "camera_mac": camera_macs[0] if len(camera_macs) == 1 else None,
        "camera_macs": camera_macs,
        "camera_count": len(camera_ids),
        "raw_event_count": len(ordered_logs),
        "duration_seconds": duration_seconds,
        "snapshot_url": snapshot_log.snapshot_url,
        "status": str(last_log.status or ""),
    }


def _summarize_attendance_logs(logs: list[AttendanceLog]) -> dict[str, Any]:
    sessions = [
        _build_attendance_session_payload(session_logs)
        for session_logs in build_attendance_sessions(logs)
    ]
    camera_ids = {
        int(log.device_id)
        for log in logs
        if log.device_id is not None
    }
    return {
        "sessions": list(reversed(sessions)),
        "session_count": len(sessions),
        "camera_count": len(camera_ids),
        "raw_event_count": len(logs),
    }


def _find_recent_attendance_duplicate(
    db: Session,
    *,
    event_time: datetime,
    person_id: Optional[str],
    employee_id: Optional[int],
    organization_id: Optional[int],
    exact_device_id: Optional[int] = None,
    exact_window_seconds: int = 8,
    flood_window_seconds: int = ATTENDANCE_FLOOD_GUARD_SECONDS,
) -> Optional[int]:
    identity_filters = []
    safe_person_id = str(person_id or "").strip()
    if safe_person_id:
        identity_filters.append(func.coalesce(func.nullif(func.trim(AttendanceLog.person_id), ""), "") == safe_person_id)
    if employee_id is not None:
        identity_filters.append(AttendanceLog.employee_id == int(employee_id))
    if not identity_filters:
        return None

    event_epoch = int(event_time.timestamp())
    order_distance = func.abs(func.strftime("%s", AttendanceLog.timestamp) - event_epoch)

    if exact_device_id is not None:
        exact_match = (
            db.query(AttendanceLog.id)
            .filter(
                AttendanceLog.device_id == int(exact_device_id),
                or_(*identity_filters),
                func.abs(func.strftime("%s", AttendanceLog.timestamp) - event_epoch) <= max(1, int(exact_window_seconds)),
            )
            .order_by(order_distance.asc(), AttendanceLog.id.desc())
            .first()
        )
        if exact_match is not None:
            return int(exact_match[0])

    flood_query = db.query(AttendanceLog.id).filter(
        or_(*identity_filters),
        func.abs(func.strftime("%s", AttendanceLog.timestamp) - event_epoch) <= max(1, int(flood_window_seconds)),
    )
    if organization_id is not None:
        flood_query = flood_query.outerjoin(Device, Device.id == AttendanceLog.device_id).filter(
            Device.organization_id == int(organization_id)
        )

    flood_match = flood_query.order_by(order_distance.asc(), AttendanceLog.id.desc()).first()
    if flood_match is None:
        return None
    return int(flood_match[0])


def _build_today_status_items(
    db: Session,
    *,
    allowed_org_ids: list[int],
    today_status: str,
    target_day_start: datetime,
    target_day_end: datetime,
    organization_id: Optional[int],
    camera_id: Optional[int],
    personal_id: Optional[str],
) -> list[dict[str, Any]]:
    if not allowed_org_ids:
        return []

    employees_query = db.query(Employee).outerjoin(Employee.organization)
    employees_query = employees_query.filter(Employee.organization_id.in_(allowed_org_ids))
    if organization_id is not None:
        employees_query = employees_query.filter(Employee.organization_id == organization_id)
    if personal_id:
        employees_query = employees_query.filter(Employee.personal_id == personal_id)
    if camera_id is not None:
        employees_query = employees_query.join(
            EmployeeCameraLink,
            EmployeeCameraLink.employee_id == Employee.id,
        ).filter(EmployeeCameraLink.camera_id == camera_id)

    employees = employees_query.order_by(Employee.id.desc()).all()
    if not employees:
        return []

    employee_ids = [int(emp.id) for emp in employees]
    logs_query = db.query(AttendanceLog).filter(
        AttendanceLog.employee_id.in_(employee_ids),
        AttendanceLog.timestamp >= target_day_start,
        AttendanceLog.timestamp < target_day_end,
    )
    if camera_id is not None:
        logs_query = logs_query.filter(AttendanceLog.device_id == camera_id)
    day_logs = logs_query.order_by(AttendanceLog.timestamp.asc(), AttendanceLog.id.asc()).all()

    logs_by_employee: dict[int, list[AttendanceLog]] = {}
    for log in day_logs:
        if log.employee_id is None:
            continue
        logs_by_employee.setdefault(int(log.employee_id), []).append(log)

    items: list[dict[str, Any]] = []
    for emp in employees:
        emp_id = int(emp.id)
        if is_holiday_for_org(db, target_day_start.date(), emp.organization_id):
            continue
        emp_logs = logs_by_employee.get(emp_id, [])
        first_seen = emp_logs[0].timestamp if emp_logs else None
        last_seen = emp_logs[-1].timestamp if emp_logs else None

        schedule_payload = resolve_employee_schedule(emp)
        expected_start = target_day_start.replace(
            hour=_parse_hhmm_or_default(schedule_payload.get("start_time"), 9, 0)[0],
            minute=_parse_hhmm_or_default(schedule_payload.get("start_time"), 9, 0)[1],
            second=0,
            microsecond=0,
        )
        late_minutes = get_late_minutes(emp, target_day_start.date(), first_seen)
        is_late = late_minutes > 0

        include = False
        if today_status == "came":
            include = len(emp_logs) > 0
        elif today_status == "did_not_come":
            include = len(emp_logs) == 0
        elif today_status == "came_late":
            include = len(emp_logs) > 0 and is_late

        if not include:
            continue

        events = []
        session_summary = _summarize_attendance_logs(emp_logs)
        events = list(session_summary.get("sessions") or [])

        base_url = normalize_public_web_base_url(get_public_web_base_url())
        employee_image_url = None
        if emp.image_url:
            employee_image_url = f"{base_url}{emp.image_url}" if not str(emp.image_url).startswith("http") else emp.image_url

        items.append(
            {
                "group_id": f"emp:{emp_id}:{target_day_start.strftime('%Y-%m-%d')}:{today_status}",
                "event_date": target_day_start.strftime("%Y-%m-%d"),
                "employee_id": emp_id,
                "employee_name": f"{emp.first_name} {emp.last_name}".strip() or "Noma'lum",
                "employee_image_url": employee_image_url,
                "personal_id": emp.personal_id,
                "organization_id": emp.organization_id,
                "organization_name": emp.organization.name if emp.organization else None,
                "first_timestamp": first_seen.isoformat() if first_seen else None,
                "latest_timestamp": last_seen.isoformat() if last_seen else None,
                "visit_count": int(session_summary.get("session_count") or 0),
                "raw_event_count": int(session_summary.get("raw_event_count") or len(emp_logs)),
                "camera_count": int(session_summary.get("camera_count") or 0),
                "status": "kelmagan" if not emp_logs else ("kech" if is_late else "aniqlandi"),
                "events": events,
                "is_late": is_late,
                "late_minutes": max(0, late_minutes),
                "expected_start_time": expected_start.isoformat(),
            }
        )

    items.sort(
        key=lambda row: (
            row.get("latest_timestamp") or "",
            row.get("employee_name") or "",
        ),
        reverse=True,
    )
    return items


def _compute_employee_daily_summary(
    db: Session,
    *,
    allowed_org_ids: list[int],
    target_day_start: datetime,
    target_day_end: datetime,
    organization_id: Optional[int],
    camera_id: Optional[int],
    personal_id: Optional[str],
) -> dict[str, int]:
    if not allowed_org_ids:
        return {
            "total_employees": 0,
            "came": 0,
            "did_not_come": 0,
            "came_late": 0,
        }

    employees_query = (
        db.query(Employee)
        .outerjoin(Employee.organization)
        .filter(Employee.organization_id.in_(allowed_org_ids))
    )
    if organization_id is not None:
        employees_query = employees_query.filter(Employee.organization_id == organization_id)
    if personal_id:
        employees_query = employees_query.filter(Employee.personal_id == personal_id)
    if camera_id is not None:
        employees_query = employees_query.join(
            EmployeeCameraLink,
            EmployeeCameraLink.employee_id == Employee.id,
        ).filter(EmployeeCameraLink.camera_id == camera_id)

    employees = employees_query.order_by(Employee.id.desc()).all()
    if not employees:
        return {
            "total_employees": 0,
            "came": 0,
            "did_not_come": 0,
            "came_late": 0,
        }

    employee_ids = [int(emp.id) for emp in employees]
    logs_query = db.query(AttendanceLog).filter(
        AttendanceLog.employee_id.in_(employee_ids),
        AttendanceLog.timestamp >= target_day_start,
        AttendanceLog.timestamp < target_day_end,
    )
    if camera_id is not None:
        logs_query = logs_query.filter(AttendanceLog.device_id == camera_id)
    logs = logs_query.order_by(AttendanceLog.timestamp.asc(), AttendanceLog.id.asc()).all()

    first_log_by_emp: dict[int, AttendanceLog] = {}
    for log in logs:
        if log.employee_id is None:
            continue
        emp_id = int(log.employee_id)
        if emp_id not in first_log_by_emp:
            first_log_by_emp[emp_id] = log

    eligible_employees = [
        emp for emp in employees
        if not is_holiday_for_org(db, target_day_start.date(), emp.organization_id)
    ]

    came = 0
    came_late = 0
    for emp in eligible_employees:
        emp_id = int(emp.id)
        first_log = first_log_by_emp.get(emp_id)
        if not first_log or not first_log.timestamp:
            continue
        came += 1
        if get_late_minutes(emp, target_day_start.date(), first_log.timestamp) > 0:
            came_late += 1

    total_employees = len(eligible_employees)
    did_not_come = max(0, total_employees - came)
    return {
        "total_employees": total_employees,
        "came": came,
        "did_not_come": did_not_come,
        "came_late": came_late,
    }


@router.get("/api/attendance/groups")
def get_attendance_groups(
    request: Request,
    page: int = 1,
    page_size: int = 15,
    organization_id: Optional[int] = None,
    camera_id: Optional[int] = None,
    today_status: Optional[str] = None,
    personal_id: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    db: Session = Depends(get_db),
):
    safe_page = max(1, int(page or 1))
    safe_page_size = max(1, min(int(page_size or 15), 100))
    personal_id = _normalize_personal_id(personal_id)
    today_status = str(today_status or "").strip().lower() or None
    if today_status not in {None, "all", "came", "did_not_come", "came_late"}:
        raise HTTPException(status_code=422, detail="today_status noto'g'ri")

    # Bugungi holat filtrlari uchun default sana: bugun
    if today_status in {"came", "did_not_come", "came_late"}:
        now = now_tashkent()
        year = int(year or now.year)
        month = int(month or now.month)
        day = int(day or now.day)

    scope = _resolve_attendance_org_scope(request, db)
    allowed_org_ids = list(scope.get("allowed_org_ids") or [])
    pending_org_names = list(scope.get("pending_org_names") or [])

    target_day_start = None
    target_day_end = None
    if year is not None and month is not None and day is not None:
        target_day_start = datetime(int(year), int(month), int(day), 0, 0, 0)
        target_day_end = target_day_start + timedelta(days=1)
    else:
        now = now_tashkent()
        target_day_start = datetime(now.year, now.month, now.day, 0, 0, 0)
        target_day_end = target_day_start + timedelta(days=1)

    if organization_id is not None and organization_id not in allowed_org_ids:
        allowed_org_ids = []

    employee_summary = _compute_employee_daily_summary(
        db,
        allowed_org_ids=allowed_org_ids,
        target_day_start=target_day_start,
        target_day_end=target_day_end,
        organization_id=organization_id,
        camera_id=camera_id,
        personal_id=personal_id,
    )

    if not allowed_org_ids:
        return {
            "ok": True,
            "page": 1,
            "page_size": safe_page_size,
            "total": 0,
            "total_pages": 1,
            "items": [],
            "available_days": [],
            "summary": {
                "total_groups": 0,
                "total_visits": 0,
                "known_groups": 0,
                "unknown_groups": 0,
                "employee_summary": employee_summary,
            },
            "scope": {
                "pending_org_names": pending_org_names,
            },
        }
    day_expr = func.strftime("%d", AttendanceLog.timestamp)

    available_days_query = _apply_attendance_filters(
        db.query(AttendanceLog),
        organization_id=organization_id,
        camera_id=camera_id,
        personal_id=personal_id,
        year=year,
        month=month,
        day=None,
    ).filter(
        or_(
            AttendanceLog.device.has(Device.organization_id.in_(allowed_org_ids)),
            AttendanceLog.employee.has(Employee.organization_id.in_(allowed_org_ids)),
        )
    )
    available_days = [
        str(row[0])
        for row in available_days_query.with_entities(day_expr)
        .group_by(day_expr)
        .order_by(day_expr)
        .all()
        if row[0]
    ]

    if today_status in {"came", "did_not_come", "came_late"} and target_day_start is not None and target_day_end is not None:
        status_items = _build_today_status_items(
            db,
            allowed_org_ids=allowed_org_ids,
            today_status=today_status,
            target_day_start=target_day_start,
            target_day_end=target_day_end,
            organization_id=organization_id,
            camera_id=camera_id,
            personal_id=personal_id,
        )
        total_groups = len(status_items)
        total_visits = int(sum(int(item.get("visit_count") or 0) for item in status_items))
        known_groups = total_groups
        total_pages = max(1, (total_groups + safe_page_size - 1) // safe_page_size)
        safe_page = min(safe_page, total_pages)
        start_idx = (safe_page - 1) * safe_page_size
        paged_items = status_items[start_idx:start_idx + safe_page_size]
        return {
            "ok": True,
            "page": safe_page,
            "page_size": safe_page_size,
            "total": total_groups,
            "total_pages": total_pages,
            "items": paged_items,
            "available_days": available_days,
            "summary": {
                "total_groups": total_groups,
                "total_visits": total_visits,
                "known_groups": known_groups,
                "unknown_groups": 0,
                "employee_summary": employee_summary,
            },
            "scope": {
                "pending_org_names": pending_org_names,
            },
        }

    base_query = _apply_attendance_filters(
        db.query(AttendanceLog),
        organization_id=organization_id,
        camera_id=camera_id,
        personal_id=personal_id,
        year=year,
        month=month,
        day=day,
    ).filter(
        or_(
            AttendanceLog.device.has(Device.organization_id.in_(allowed_org_ids)),
            AttendanceLog.employee.has(Employee.organization_id.in_(allowed_org_ids)),
        )
    )

    event_date_expr = func.date(AttendanceLog.timestamp)
    group_identity_expr = _attendance_group_identity_expr()

    grouped_subq = (
        base_query.with_entities(
            event_date_expr.label("event_date"),
            group_identity_expr.label("group_identity"),
            func.max(AttendanceLog.timestamp).label("latest_timestamp"),
            func.min(AttendanceLog.timestamp).label("first_timestamp"),
            func.count(AttendanceLog.id).label("visit_count"),
            func.count(func.distinct(AttendanceLog.device_id)).label("camera_count"),
            func.max(AttendanceLog.employee_id).label("employee_id"),
            func.max(AttendanceLog.person_id).label("person_id"),
            func.max(AttendanceLog.person_name).label("person_name"),
            func.max(AttendanceLog.status).label("status"),
        )
        .group_by(event_date_expr, group_identity_expr)
        .subquery()
    )

    totals_row = db.query(
        func.count(),
        func.coalesce(func.sum(grouped_subq.c.visit_count), 0),
        func.coalesce(func.sum(case((grouped_subq.c.employee_id.isnot(None), 1), else_=0)), 0),
    ).select_from(grouped_subq).one()
    total_groups = int(totals_row[0] or 0)
    total_visits = int(totals_row[1] or 0)
    known_groups = int(totals_row[2] or 0)
    total_pages = max(1, (total_groups + safe_page_size - 1) // safe_page_size)
    safe_page = min(safe_page, total_pages)

    rows = (
        db.query(grouped_subq)
        .order_by(grouped_subq.c.latest_timestamp.desc(), grouped_subq.c.event_date.desc(), grouped_subq.c.group_identity.desc())
        .offset((safe_page - 1) * safe_page_size)
        .limit(safe_page_size)
        .all()
    )

    items = []
    for row in rows:
        employee = None
        employee_image_url = None
        employee_name = None
        late_minutes = 0
        employee_id = int(row.employee_id) if row.employee_id is not None else None
        if employee_id is not None:
            employee = db.query(Employee).filter(Employee.id == employee_id).first()
            if employee is not None:
                # Rasimni to'liq URL ga aylantiramiz
                if employee.image_url:
                    base_url = normalize_public_web_base_url(get_public_web_base_url())
                    employee_image_url = f"{base_url}{employee.image_url}" if not employee.image_url.startswith("http") else employee.image_url
                employee_name = f"{employee.first_name} {employee.last_name}".strip()
                if row.first_timestamp:
                    first_dt = _parse_camera_timestamp(row.first_timestamp)
                    if first_dt:
                        late_minutes = get_late_minutes(employee, first_dt.date(), first_dt)
                        
        group_identity = str(row.group_identity or "")
        detail_query = _apply_attendance_filters(
            db.query(AttendanceLog),
            organization_id=organization_id,
            camera_id=camera_id,
            personal_id=personal_id,
            year=year,
            month=month,
            day=day,
        ).filter(
            func.date(AttendanceLog.timestamp) == row.event_date,
            or_(
                AttendanceLog.device.has(Device.organization_id.in_(allowed_org_ids)),
                AttendanceLog.employee.has(Employee.organization_id.in_(allowed_org_ids)),
            ),
        )

        if group_identity.startswith("e:") and employee_id is not None:
            detail_query = detail_query.filter(AttendanceLog.employee_id == employee_id)
        else:
            detail_key = group_identity[2:] if group_identity.startswith("u:") else group_identity
            detail_query = detail_query.filter(AttendanceLog.employee_id.is_(None))
            detail_query = detail_query.filter(
                or_(
                    func.coalesce(func.nullif(func.trim(AttendanceLog.person_id), ""), "") == detail_key,
                    func.coalesce(func.nullif(func.trim(AttendanceLog.person_name), ""), "") == detail_key,
                    func.coalesce(func.nullif(func.trim(AttendanceLog.camera_mac), ""), "") == detail_key,
                )
            )

        event_logs = detail_query.order_by(AttendanceLog.timestamp.desc(), AttendanceLog.id.desc()).all()
        session_summary = _summarize_attendance_logs(event_logs)
        events = list(session_summary.get("sessions") or [])
        camera_count = int(session_summary.get("camera_count") or row.camera_count or 0)
        
        # Tashkilot nomini olamiz
        org_name = None
        org_id = organization_id
        if employee is not None and employee.organization_id is not None:
            org_id = employee.organization_id
            org = db.query(Organization).filter(Organization.id == org_id).first()
            if org:
                org_name = org.name
        
        items.append(
            {
                "group_id": group_identity,
                "event_date": row.event_date,
                "employee_id": employee_id,
                "employee_name": employee_name or row.person_name or "Noma'lum",
                "employee_image_url": employee_image_url,
                "personal_id": row.person_id,
                "organization_id": org_id,
                "organization_name": org_name,
                "first_timestamp": row.first_timestamp.isoformat() if row.first_timestamp else None,
                "latest_timestamp": row.latest_timestamp.isoformat() if row.latest_timestamp else None,
                "visit_count": int(session_summary.get("session_count") or 0),
                "raw_event_count": int(session_summary.get("raw_event_count") or row.visit_count or 0),
                "camera_count": camera_count,
                "status": row.status,
                "late_minutes": max(0, late_minutes),
                "events": events,
            }
        )

    unknown_groups = max(0, total_groups - known_groups)
    return {
        "ok": True,
        "page": safe_page,
        "page_size": safe_page_size,
        "total": total_groups,
        "total_pages": total_pages,
        "items": items,
        "available_days": available_days,
        "summary": {
            "total_groups": total_groups,
            "total_visits": total_visits,
            "known_groups": known_groups,
            "unknown_groups": unknown_groups,
            "employee_summary": employee_summary,
        },
        "scope": {
            "pending_org_names": pending_org_names,
        },
    }


@router.get("/api/attendance/stream")
async def attendance_stream(
    request: Request,
    organization_id: Optional[int] = None,
    camera_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    scope = _resolve_attendance_org_scope(request, db)
    allowed_org_ids = {int(v) for v in (scope.get("allowed_org_ids") or [])}

    redis_conn = get_redis(check_connection=True)
    pubsub = None
    if redis_conn is not None:
        try:
            pubsub = redis_conn.pubsub(ignore_subscribe_messages=True)
            pubsub.subscribe(EVENTS_CHANNEL)
        except Exception:
            pubsub = None

    async def _event_generator():
        last_ping = time.monotonic()
        try:
            ready_payload = {"ok": True, "redis": bool(pubsub is not None)}
            yield f"event: ready\ndata: {json.dumps(ready_payload, ensure_ascii=False)}\n\n"

            while True:
                if await request.is_disconnected():
                    break

                message = None
                if pubsub is not None:
                    message = await asyncio.to_thread(pubsub.get_message, timeout=1.0)

                if message and message.get("type") == "message":
                    try:
                        payload = json.loads(message.get("data") or "{}")
                    except Exception:
                        payload = {}

                    org_id = payload.get("organization_id")
                    cam_id = payload.get("camera_id")
                    try:
                        org_id_int = int(org_id) if org_id is not None and str(org_id).strip() != "" else None
                    except Exception:
                        org_id_int = None
                    try:
                        cam_id_int = int(cam_id) if cam_id is not None and str(cam_id).strip() != "" else None
                    except Exception:
                        cam_id_int = None

                    if allowed_org_ids and org_id_int is not None and org_id_int not in allowed_org_ids:
                        continue
                    if organization_id is not None and org_id_int != int(organization_id):
                        continue
                    if camera_id is not None and cam_id_int != int(camera_id):
                        continue

                    event_payload = {
                        "log_id": payload.get("log_id"),
                        "timestamp": payload.get("timestamp"),
                        "camera_id": cam_id_int,
                        "organization_id": org_id_int,
                        "status": payload.get("status"),
                    }
                    yield f"event: attendance\ndata: {json.dumps(event_payload, ensure_ascii=False)}\n\n"

                now = time.monotonic()
                if now - last_ping >= 15:
                    yield "event: ping\ndata: {}\n\n"
                    last_ping = now
        finally:
            if pubsub is not None:
                try:
                    pubsub.unsubscribe(EVENTS_CHANNEL)
                except Exception:
                    pass
                try:
                    pubsub.close()
                except Exception:
                    pass

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _collect_attendance_groups_for_export(
    request: Request,
    db: Session,
    *,
    organization_id: Optional[int],
    camera_id: Optional[int],
    today_status: Optional[str],
    personal_id: Optional[str],
    year: Optional[int],
    month: Optional[int],
    day: Optional[int],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    first_page = get_attendance_groups(
        request=request,
        page=1,
        page_size=100,
        organization_id=organization_id,
        camera_id=camera_id,
        today_status=today_status,
        personal_id=personal_id,
        year=year,
        month=month,
        day=day,
        db=db,
    )

    all_items = list(first_page.get("items") or [])
    total_pages = int(first_page.get("total_pages") or 1)
    if total_pages > 1:
        for page_no in range(2, total_pages + 1):
            page_data = get_attendance_groups(
                request=request,
                page=page_no,
                page_size=100,
                organization_id=organization_id,
                camera_id=camera_id,
                today_status=today_status,
                personal_id=personal_id,
                year=year,
                month=month,
                day=day,
                db=db,
            )
            all_items.extend(page_data.get("items") or [])

    return all_items, dict(first_page.get("summary") or {})


def _format_export_dt(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        return datetime.fromisoformat(str(value)).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return str(value)


def _format_export_time(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        return datetime.fromisoformat(str(value)).strftime("%H:%M:%S")
    except Exception:
        return str(value)


def _xlsx_column_name(index: int) -> str:
    name = ""
    while index > 0:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name or "A"


def _xlsx_text(value: Any) -> str:
    text = "" if value is None else str(value)
    text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", text)
    return xml_escape(text)


def _build_simple_xlsx(
    headers: list[str],
    rows: list[list[Any]],
    sheet_name: str = "Davomat",
) -> bytes:
    table_rows = [headers, *rows]
    sheet_rows = []
    for row_index, row in enumerate(table_rows, start=1):
        cells = []
        for column_index, value in enumerate(row, start=1):
            cell_ref = f"{_xlsx_column_name(column_index)}{row_index}"
            cells.append(
                f'<c r="{cell_ref}" t="inlineStr"><is><t>{_xlsx_text(value)}</t></is></c>'
            )
        sheet_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(sheet_rows)}</sheetData>'
        '</worksheet>'
    )
    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<sheets><sheet name="{_xlsx_text(sheet_name)[:31]}" sheetId="1" r:id="rId1"/></sheets>'
        '</workbook>'
    )
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/>'
        '<Relationship Id="rId2" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
        'Target="styles.xml"/>'
        '</Relationships>'
    )
    package_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/>'
        '</Relationships>'
    )
    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/xl/workbook.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        '<Override PartName="/xl/worksheets/sheet1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        '<Override PartName="/xl/styles.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        '</Types>'
    )
    styles_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>'
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>'
        '</styleSheet>'
    )

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", package_rels)
        archive.writestr("xl/workbook.xml", workbook_xml)
        archive.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        archive.writestr("xl/worksheets/sheet1.xml", sheet_xml)
        archive.writestr("xl/styles.xml", styles_xml)
    return buffer.getvalue()


@router.get("/api/attendance/groups/export/excel")
def export_attendance_groups_excel(
    request: Request,
    organization_id: Optional[int] = None,
    camera_id: Optional[int] = None,
    today_status: Optional[str] = None,
    personal_id: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    db: Session = Depends(get_db),
):
    items, _ = _collect_attendance_groups_for_export(
        request,
        db,
        organization_id=organization_id,
        camera_id=camera_id,
        today_status=today_status,
        personal_id=personal_id,
        year=year,
        month=month,
        day=day,
    )

    headers = [
        "#",
        "Xodim",
        "Shaxsiy ID",
        "Kelgan vaqti",
        "Birinchi vaqti",
        "Tashkilot",
        "Kameralar soni",
        "O'tish soni",
        "Status",
    ]
    export_rows = []
    for idx, row in enumerate(items, start=1):
        export_rows.append([
            idx,
            row.get("employee_name") or "",
            row.get("personal_id") or "",
            _format_export_time(row.get("latest_timestamp")),
            _format_export_time(row.get("first_timestamp")),
            row.get("organization_name") or "",
            row.get("camera_count") or 0,
            row.get("visit_count") or 0,
            row.get("status") or "",
        ])

    filename = f"attendance_{now_tashkent().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return Response(
        content=_build_simple_xlsx(headers, export_rows),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/attendance/groups/export/pdf")
def export_attendance_groups_pdf(
    request: Request,
    organization_id: Optional[int] = None,
    camera_id: Optional[int] = None,
    today_status: Optional[str] = None,
    personal_id: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    day: Optional[int] = None,
    db: Session = Depends(get_db),
):
    try:
        from fpdf import FPDF
    except Exception:
        raise HTTPException(status_code=503, detail="PDF export uchun fpdf2 kerak")

    items, summary = _collect_attendance_groups_for_export(
        request,
        db,
        organization_id=organization_id,
        camera_id=camera_id,
        today_status=today_status,
        personal_id=personal_id,
        year=year,
        month=month,
        day=day,
    )

    pdf = FPDF(orientation="L", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=8)
    pdf.add_page()

    uses_unicode_font = False
    font_path = os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts", "arial.ttf")
    if os.path.exists(font_path):
        try:
            pdf.add_font("ArialUnicode", "", font_path)
            uses_unicode_font = True
        except Exception:
            uses_unicode_font = False

    font_name = "ArialUnicode" if uses_unicode_font else "Helvetica"

    def safe_text(value: Any) -> str:
        text = str(value or "")
        if uses_unicode_font:
            return text
        return text.encode("latin-1", errors="ignore").decode("latin-1")

    pdf.set_font(font_name, "", 12)
    pdf.cell(0, 8, safe_text("Davomat export"), ln=1)
    filter_line = f"Filtr: holat={today_status or 'all'}, yil={year or 'all'}, oy={month or 'all'}, kun={day or 'all'}"
    pdf.set_font(font_name, "", 9)
    pdf.cell(0, 6, safe_text(filter_line), ln=1)
    pdf.cell(0, 6, safe_text(f"Jami guruh: {summary.get('total_groups', len(items))}, jami o'tish: {summary.get('total_visits', 0)}"), ln=1)
    pdf.ln(2)

    headers = ["#", "Sana", "Oxirgi vaqt", "Xodim", "ID", "Tashkilot", "Kamera", "Otish", "Status"]
    widths = [10, 24, 30, 55, 22, 40, 18, 16, 20]
    pdf.set_font(font_name, "", 8)
    for h, w in zip(headers, widths):
        pdf.cell(w, 7, safe_text(h), border=1)
    pdf.ln()

    for idx, row in enumerate(items, start=1):
        cells = [
            str(idx),
            str(row.get("event_date") or ""),
            _format_export_dt(row.get("latest_timestamp")),
            str(row.get("employee_name") or ""),
            str(row.get("personal_id") or ""),
            str(row.get("organization_name") or ""),
            str(row.get("camera_count") or 0),
            str(row.get("visit_count") or 0),
            str(row.get("status") or ""),
        ]
        for value, w in zip(cells, widths):
            txt = safe_text(value)
            if len(txt) > 42:
                txt = txt[:39] + "..."
            pdf.cell(w, 6, txt, border=1)
        pdf.ln()

    filename = f"attendance_{now_tashkent().strftime('%Y%m%d_%H%M%S')}.pdf"
    pdf_bytes = bytes(pdf.output(dest="S"))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/isup-devices")
def get_isup_devices(db: Session = Depends(get_db)):
    """
    ISUP server (port 7670) dan barcha ro'yxatdan o'tgan kameralar ro'yxatini qaytaradi.
    Agar live ro'yxat bo'sh bo'lsa ham, DB dagi ISUP sozlangan kameralar
    "configured_only" holatida qaytariladi.
    """
    live_devices: list[dict] = []
    source = "isup_rest"
    try:
        response = httpx.get(f"{ISUP_API_URL}/devices", timeout=3.0)
        response.raise_for_status()
        live_devices = _extract_device_list(response.json())
    except Exception:
        if redis_ok():
            source = "redis_registry"
            live_devices = _extract_device_list(get_isup_devices_from_redis() or [])

    # Normalize live devices by device_id key
    device_map: dict[str, dict] = {}
    device_lookup: dict[str, str] = {}
    for item in live_devices:
        if not isinstance(item, dict):
            continue
        normalized = dict(item)
        device_id = _pick_first_nonempty(normalized, ("device_id", "id", "deviceId"))
        if not device_id:
            continue
        normalized["device_id"] = device_id
        normalized.setdefault("source", source)
        normalized.setdefault("connection_state", "connected")
        device_map[device_id] = normalized
        device_lookup[device_id] = device_id
        device_lookup[device_id.upper()] = device_id
        device_lookup[device_id.lower()] = device_id

    # Merge DB-configured cameras so UI can show pending/not-registered devices
    cams = db.query(Device).order_by(Device.id).all()
    for cam in cams:
        candidate_ids = []
        if cam.isup_device_id:
            candidate_ids.append(cam.isup_device_id.strip())
        if cam.mac_address:
            candidate_ids.append(cam.mac_address.strip())

        matched_device_id = None
        for cid in candidate_ids:
            if not cid:
                continue
            matched_device_id = (
                device_lookup.get(cid)
                or device_lookup.get(cid.upper())
                or device_lookup.get(cid.lower())
            )
            if matched_device_id:
                break

        if matched_device_id:
            enriched = device_map[matched_device_id]
            enriched.setdefault("db_camera_id", cam.id)
            enriched.setdefault("display_name", cam.name)
            live_model = _pick_first_nonempty(
                enriched,
                ("camera_model", "device_model", "model", "model_name", "product", "deviceType"),
            )
            merged_model = _prefer_persistent_model(cam.model, live_model)
            enriched["camera_model"] = merged_model
            enriched["model"] = merged_model
            if merged_model and cam.model != merged_model:
                cam.model = merged_model
            live_device_id = _pick_first_nonempty(enriched, ("device_id",))
            if live_device_id and cam.isup_device_id != live_device_id:
                cam.isup_device_id = live_device_id
            enriched.setdefault("mac_address", cam.mac_address)
            continue

        fallback_id = next((cid for cid in candidate_ids if cid), f"camera-{cam.id}")
        device_map[fallback_id] = {
            "device_id": fallback_id,
            "db_camera_id": cam.id,
            "display_name": cam.name,
            "camera_model": cam.model,
            "model": cam.model,
            "mac_address": cam.mac_address,
            "ip": "-",
            "port": "-",
            "online": False,
            "registered_at": None,
            "last_seen_at": cam.last_seen_at.isoformat() if cam.last_seen_at else None,
            "source": "configured_only",
            "connection_state": "not_registered",
            "note": "DB da sozlangan, lekin ISUP register bo'lmagan",
        }

    db.commit()
    return list(device_map.values())


@router.get("/api/isup-devices/{device_id}")
def get_isup_device(device_id: str):
    """Bitta ISUP kamera ma'lumotlari"""
    try:
        response = httpx.get(f"{ISUP_API_URL}/devices/{device_id}", timeout=3.0)
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail="ISUP qurilma topilmadi")
        return response.json()
    except HTTPException:
        raise
    except Exception:
        if redis_ok():
            device = get_isup_device_from_redis(device_id)
            if device:
                return device
        raise HTTPException(status_code=503, detail="ISUP server ishlamayapti")


@router.delete("/api/isup-devices/{device_id}")
def disconnect_isup_device(device_id: str):
    """ISUP kamerani uzish"""
    try:
        response = httpx.delete(f"{ISUP_API_URL}/devices/{device_id}", timeout=3.0)
        return response.json()
    except Exception:
        raise HTTPException(status_code=503, detail="ISUP server ishlamayapti")


@router.get("/api/isup-health")
def isup_health():
    """ISUP server holati va xotira (RAM/CPU) ma'lumotlari"""
    process_status = get_process_status()
    checked_at = now_tashkent().isoformat()
    api_host = "0.0.0.0"
    api_port = 7670
    for port_info in process_status.get("ports", []):
        if port_info.get("key") == "api":
            api_host = str(port_info.get("host") or api_host)
            api_port = int(port_info.get("port") or api_port)
            break
    api_display_url = f"http://{api_host}:{api_port}"
    sys_info = {
        "ram_mb": process_status.get("memory_mb", 0.0),
        "cpu_percent": process_status.get("cpu_percent", 0.0),
        "pid": process_status.get("pid"),
    }

    try:
        response = httpx.get(f"{ISUP_API_URL}/health", timeout=2.0)
        response.raise_for_status()
        payload = response.json()
        return {
            **payload,
            "isup_server_url": api_display_url,
            "isup_server_internal_url": ISUP_API_URL,
            "running": True,
            "sys_info": sys_info,
            "process": process_status,
            "sdk": process_status.get("sdk", {}),
            "ports": process_status.get("ports", []),
            "checked_at": checked_at,
        }
    except Exception:
        return {
            "running": bool(process_status.get("running")),
            "status": "offline",
            "isup_server_url": api_display_url,
            "isup_server_internal_url": ISUP_API_URL,
            "devices": 0,
            "sys_info": sys_info,
            "process": process_status,
            "sdk": process_status.get("sdk", {}),
            "ports": process_status.get("ports", []),
            "checked_at": checked_at,
        }


@router.get("/api/isup-traces")
def isup_traces(limit: int = 100, filter: str = "all"):
    try:
        response = httpx.get(
            f"{ISUP_API_URL}/traces",
            params={"limit": max(1, min(int(limit), 300)), "filter": str(filter or "all")},
            timeout=3.0,
        )
        response.raise_for_status()
        data = response.json()
        if isinstance(data, dict):
            data.setdefault("ok", True)
            return data
        return {"ok": True, "count": 0, "items": []}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"ISUP trace olinmadi: {exc}")


@router.delete("/api/isup-traces")
def clear_isup_traces():
    try:
        response = httpx.delete(f"{ISUP_API_URL}/traces", timeout=3.0)
        response.raise_for_status()
        data = response.json()
        if isinstance(data, dict):
            data.setdefault("ok", True)
            return data
        return {"ok": True, "removed": 0}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"ISUP trace tozalanmadi: {exc}")


@router.get("/api/isup-sdk-status")
def isup_sdk_status():
    return get_sdk_status()


# ── POST /api/v1/httppost/ — Hikvision native XML/multipart event ─────────
# DS-K kameralar "Alarm Linkage → HTTP Push" yoki "EventNotificationAlert" orqali
# yuz tanish eventini XML + face image (JPEG) sifatida yuboradi.
# Kamera sozlamalari: Network → HTTP Listening Event → URL=/api/v1/httppost/
import xml.etree.ElementTree as _ET
_HIK_SNAP_DIR = os.path.join("static", "uploads", "isup")
os.makedirs(_HIK_SNAP_DIR, exist_ok=True)


def _hik_store_snapshot_bytes(raw: bytes, *, ext: str = "jpg") -> Optional[str]:
    if not _hik_is_valid_image_bytes(raw):
        return None
    safe_ext = str(ext or "jpg").strip().lower().lstrip(".")
    if safe_ext not in {"jpg", "jpeg", "png", "gif", "bmp", "webp"}:
        safe_ext = "jpg"
    ts_str = now_tashkent().strftime("%Y%m%d_%H%M%S_%f")
    fname = f"hik_{ts_str}.{safe_ext if safe_ext != 'jpeg' else 'jpg'}"
    fpath = os.path.join(_HIK_SNAP_DIR, fname)
    with open(fpath, "wb") as f:
        f.write(raw)
    return f"/static/uploads/isup/{fname}"


def _hik_try_parse_json(text: str) -> Any:
    clean = str(text or "").strip()
    if not clean or clean[0] not in "{[":
        return None
    try:
        return json.loads(clean)
    except Exception:
        return None


def _hik_find_first_value(data: Any, wanted_keys: set[str]) -> Optional[str]:
    targets = {str(key).strip().lower() for key in wanted_keys}

    def _walk(node: Any) -> Optional[str]:
        if isinstance(node, dict):
            for key, value in node.items():
                if str(key).strip().lower() in targets and value is not None:
                    if isinstance(value, (str, int, float, bool)):
                        text = str(value).strip()
                        if text:
                            return text
                nested = _walk(value)
                if nested:
                    return nested
        elif isinstance(node, list):
            for item in node:
                nested = _walk(item)
                if nested:
                    return nested
        return None

    return _walk(data)


def _hik_extract_xml_tags(text: str) -> dict[str, str]:
    if not text or "<" not in text:
        return {}
    try:
        root = _ET.fromstring(text)
    except Exception:
        return {}

    tags: dict[str, str] = {}
    for elem in root.iter():
        tag = elem.tag.rsplit("}", 1)[-1]
        if tag in tags:
            continue
        value = (elem.text or "").strip()
        if value:
            tags[tag] = value
    return tags


def _hik_is_image_bytes(raw: bytes) -> bool:
    return bool(
        raw
        and (
            raw.startswith(b"\xff\xd8\xff")
            or raw.startswith(b"\x89PNG\r\n\x1a\n")
            or raw.startswith(b"GIF87a")
            or raw.startswith(b"GIF89a")
            or raw.startswith(b"BM")
            or (raw.startswith(b"RIFF") and raw[8:12] == b"WEBP")
        )
    )


def _hik_is_valid_image_bytes(raw: bytes) -> bool:
    if not _hik_is_image_bytes(raw):
        return False
    if raw.startswith(b"\xff\xd8\xff") and b"\xff\xd9" not in raw[-4096:]:
        return False
    try:
        with Image.open(BytesIO(raw)) as img:
            img.verify()
        return True
    except Exception:
        return False


def _hik_guess_image_ext(raw: bytes, filename: str = "") -> str:
    ext = str(filename or "").rsplit(".", 1)[-1].lower() if "." in str(filename or "") else ""
    if ext in {"jpg", "jpeg", "png", "gif", "bmp", "webp"}:
        return "jpg" if ext == "jpeg" else ext
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if raw.startswith(b"GIF87a") or raw.startswith(b"GIF89a"):
        return "gif"
    if raw.startswith(b"BM"):
        return "bmp"
    if raw.startswith(b"RIFF") and raw[8:12] == b"WEBP":
        return "webp"
    return "jpg"


def _hik_decode_base64_image(value: Any) -> Optional[bytes]:
    text = str(value or "").strip()
    if not text:
        return None
    if text.startswith("data:") and "," in text:
        text = text.split(",", 1)[1].strip()
    try:
        raw = base64.b64decode(text, validate=False)
    except Exception:
        return None
    return raw if _hik_is_valid_image_bytes(raw) else None


def _hik_snapshot_candidate_urls(camera_ip: str) -> list[str]:
    raw = str(camera_ip or "").strip()
    if not raw:
        return []

    parsed = urlsplit(raw if "://" in raw else f"http://{raw}")
    host = str(parsed.hostname or "").strip()
    if not host:
        return []

    schemes_ports: list[tuple[str, int]] = []
    if parsed.scheme and parsed.scheme in {"http", "https"}:
        schemes_ports.append((parsed.scheme, parsed.port or (443 if parsed.scheme == "https" else 80)))
    else:
        schemes_ports.extend([("http", 80), ("https", 443)])

    paths = (
        "/ISAPI/Streaming/channels/1/picture",
        "/ISAPI/Streaming/channels/101/picture",
        "/ISAPI/Streaming/picture",
    )
    urls: list[str] = []
    for scheme, port in schemes_ports:
        default_port = 443 if scheme == "https" else 80
        base = f"{scheme}://{host}" if port == default_port else f"{scheme}://{host}:{port}"
        for path in paths:
            urls.append(f"{base}{path}")
    return urls


def _hik_try_fetch_snapshot_from_camera(camera_ip: str, username: str, password: str) -> Optional[str]:
    safe_ip = str(camera_ip or "").strip()
    safe_user = str(username or "").strip()
    safe_pass = str(password or "").strip()
    if not safe_ip or not safe_user or not safe_pass:
        return None

    auth_options = [httpx.DigestAuth(safe_user, safe_pass), httpx.BasicAuth(safe_user, safe_pass)]
    candidate_urls = _hik_snapshot_candidate_urls(safe_ip)
    if not candidate_urls:
        return None

    for auth in auth_options:
        try:
            with httpx.Client(timeout=8.0, verify=False, follow_redirects=True, trust_env=False, auth=auth) as client:
                for url in candidate_urls:
                    try:
                        response = client.get(url)
                    except Exception:
                        continue
                    if response.status_code >= 400:
                        continue
                    raw = bytes(response.content or b"")
                    if not _hik_is_valid_image_bytes(raw):
                        continue
                    return _hik_store_snapshot_bytes(raw, ext=_hik_guess_image_ext(raw))
        except Exception:
            continue
    return None


def _hik_update_log_snapshot_and_state(log_id: int, snapshot_url: str) -> bool:
    safe_snapshot_url = str(snapshot_url or "").strip()
    if log_id <= 0 or not safe_snapshot_url:
        return False

    db = SessionLocal()
    try:
        log = db.query(AttendanceLog).filter(AttendanceLog.id == int(log_id)).first()
        if log is None:
            return False

        current_snapshot = str(log.snapshot_url or "").strip()
        if current_snapshot.startswith("/static/"):
            return True

        log.snapshot_url = safe_snapshot_url
        photo_path = resolve_snapshot_path(safe_snapshot_url)
        psychological_profile = detect_psychological_profile(photo_path)
        psychological_state_key = str(psychological_profile.get("state_key") or "")
        psychological_state_confidence = psychological_profile.get("confidence")
        emotion_scores = dict(psychological_profile.get("emotion_scores") or {})
        log.psychological_state_key = psychological_state_key or None
        log.psychological_state_confidence = psychological_state_confidence
        log.emotion_scores_json = psychological_profile.get("emotion_scores_json") or None

        if log.employee_id:
            upsert_daily_psychological_state(
                db,
                employee_id=int(log.employee_id),
                state_key=psychological_state_key,
                confidence=psychological_state_confidence,
                emotion_scores=emotion_scores,
                timestamp=normalize_timestamp_tashkent(log.timestamp),
                note=f"hik_event_snapshot_backfill:{log.camera_mac or '-'}",
                source="external_system",
            )

        db.commit()
        return True
    except Exception as exc:
        db.rollback()
        print(f"[HIK-EVENT] snapshot backfill DB xato: {exc}")
        return False
    finally:
        db.close()


def _hik_backfill_snapshot_task(
    *,
    log_id: int,
    isup_device_id: Optional[str],
    camera_ip: Optional[str],
    username: Optional[str],
    password: Optional[str],
) -> None:
    try:
        time.sleep(1.5)
        snapshot_url: Optional[str] = None

        target_device_id = str(isup_device_id or "").strip()
        if target_device_id and redis_ok():
            try:
                response = send_command_and_wait(
                    target_device_id,
                    "capture_snapshot",
                    {
                        "camera_ip": str(camera_ip or "").strip() or None,
                        "allow_http_fallback": True,
                        "username": str(username or "").strip() or None,
                        "password": str(password or "").strip() or None,
                    },
                    timeout=15.0,
                )
                if isinstance(response, dict) and response.get("ok") and response.get("snapshot_url"):
                    snapshot_url = str(response.get("snapshot_url") or "").strip() or None
            except Exception as exc:
                print(f"[HIK-EVENT] ISUP snapshot backfill xato: {exc}")

        if not snapshot_url:
            snapshot_url = _hik_try_fetch_snapshot_from_camera(
                str(camera_ip or "").strip(),
                str(username or "").strip(),
                str(password or "").strip(),
            )

        if snapshot_url:
            _hik_update_log_snapshot_and_state(int(log_id), snapshot_url)
    except Exception as exc:
        print(f"[HIK-EVENT] snapshot backfill task xato: {exc}")

@router.post("/api/v1/httppost/")
@router.post("/api/v1/httppost")
@router.post("/api/hik-event")
async def hik_event_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Hikvision DS-K kameralarining HTTP push notification endpointi.
    Kamera sozlamalari:
      Configuration → Network → Advanced Settings → HTTP Listening
      yoki Event → Basic Event → Alarm Linkage → HTTP Push
      Server/IP: 94.141.85.147
      Port: 8000
      URL: /api/v1/httppost/
    """
    # ── RAW LOGGER: Kamera yuborayotgan haqiqiy so'rovni qayd qilamiz ──
    try:
        import datetime as _dt
        _raw_body = await request.body()
        _log_path = "C:/Users/Izzatbek/Documents/FaceX/CAMERA_RAW_LOG.txt"
        with open(_log_path, "a", encoding="utf-8", errors="replace") as _lf:
            _lf.write(f"\n{'='*70}\n")
            _lf.write(f"[{_dt.datetime.now().isoformat()}] HIK-EVENT REQUEST\n")
            _lf.write(f"Method : {request.method}\n")
            _lf.write(f"URL    : {request.url}\n")
            _lf.write(f"Client : {request.client}\n")
            for _hk, _hv in request.headers.items():
                _lf.write(f"Header : {_hk}: {_hv}\n")
            _lf.write(f"Body({len(_raw_body)} bytes):\n")
            # Rasm bo'lmagan qismini text sifatida yozamiz (max 4KB)
            _body_preview = _raw_body[:4096]
            _lf.write(_body_preview.decode("utf-8", errors="replace"))
            _lf.write("\n")
    except Exception as _log_exc:
        print(f"[HIK-EVENT] log xatosi: {_log_exc}")

    content_type = (request.headers.get("content-type", "") or "").lower()
    xml_text = ""
    json_payload: Any = None
    image_bytes: Optional[bytes] = None
    image_ext = "jpg"
    text_parts: list[str] = []
    image_part_keys = {
        "faceimagedata",
        "picture",
        "image",
        "faceimage",
        "face",
        "facejpeg",
        "backgroundimage",
    }
    image_b64_keys = {
        "faceimagedata",
        "image",
        "imagebase64",
        "faceimage",
        "captureimage",
        "base64image",
        "picture",
        "picdata",
    }

    body = _raw_body  # Already read in logger above

    if "multipart" in content_type:
        boundary = b""
        if "boundary=" in content_type:
            b_str = content_type.split("boundary=")[-1].split(";")[0].strip('"').strip()
            boundary = f"--{b_str}".encode("utf-8")

        # Hikvision ko'p hollarda Content-Disposition yubormaydi, FastAPI form() uni tashlab yuboradi.
        # Shu sababli manual split qilamiz
        if boundary and boundary in body:
            for part in body.split(boundary):
                if b"\r\n\r\n" in part:
                    header, content = part.split(b"\r\n\r\n", 1)
                    if content.endswith(b"\r\n"):
                        content = content[:-2]
                    
                    if not content.strip():
                        continue
                    
                    if _hik_is_valid_image_bytes(content):
                        image_bytes = content
                        image_ext = _hik_guess_image_ext(content)
                    else:
                        txt = content.decode("utf-8", errors="ignore").strip()
                        if txt:
                            text_parts.append(txt)
        else:
            # Fallback for Requestly yoki to'g'ri form-data clientlar uchun
            try:
                form = await request.form()
                for key, val in form.items():
                    if hasattr(val, "read"):
                        raw = await val.read()
                        if _hik_is_valid_image_bytes(raw):
                            image_bytes = raw
                            image_ext = _hik_guess_image_ext(raw)
                        else:
                            txt = raw.decode("utf-8", errors="ignore").strip()
                            if txt: text_parts.append(txt)
                    else:
                        txt = str(val).strip()
                        if txt: text_parts.append(txt)
            except Exception:
                pass
    else:
        if body and _hik_is_valid_image_bytes(body):
            image_bytes = body
            image_ext = _hik_guess_image_ext(body)
        else:
            body_text = body.decode("utf-8", errors="ignore").strip()
            if body_text:
                text_parts.append(body_text)

    if not xml_text:
        for part in text_parts:
            if "<" in part and ">" in part:
                xml_text = part
                break
    if json_payload is None:
        for part in text_parts:
            parsed_json = _hik_try_parse_json(part)
            if parsed_json is not None:
                json_payload = parsed_json
                break

    xml_tags = _hik_extract_xml_tags(xml_text)

    person_id_val: Optional[str] = None
    person_name_val: Optional[str] = None
    camera_serial: Optional[str] = None
    camera_mac: Optional[str] = None
    camera_ip_val: Optional[str] = None
    event_time_str: Optional[str] = None
    event_type_val: Optional[str] = None
    sub_event_type_val: Optional[str] = None
    verify_mode_val: Optional[str] = None
    wellbeing_note_uz_val: Optional[str] = None
    wellbeing_note_ru_val: Optional[str] = None
    wellbeing_note_source_val: Optional[str] = None
    snapshot_url = (
        _hik_find_first_value(json_payload, {"snapshotUrl", "snapshot_url", "faceURL", "pictureURL", "picUrl"})
        or xml_tags.get("snapshotUrl")
        or xml_tags.get("snapshotURL")
        or xml_tags.get("faceURL")
        or xml_tags.get("pictureURL")
        or xml_tags.get("picUrl")
        or ""
    ).strip() or None

    person_id_val = (
        _hik_find_first_value(
            json_payload,
            {"employeeNoString", "employeeNo", "personID", "personId", "employeeID", "employeeId", "cardNo", "cardReaderNo"},
        )
        or xml_tags.get("employeeNoString")
        or xml_tags.get("employeeNo")
        or xml_tags.get("personID")
        or xml_tags.get("personId")
        or xml_tags.get("employeeID")
        or xml_tags.get("employeeId")
        or xml_tags.get("cardNo")
        or xml_tags.get("cardReaderNo")
        or ""
    ).strip() or None
    person_name_val = (
        _hik_find_first_value(json_payload, {"name", "personName", "employeeName"})
        or xml_tags.get("name")
        or xml_tags.get("personName")
        or xml_tags.get("employeeName")
        or ""
    ).strip() or None
    camera_serial = (
        _hik_find_first_value(json_payload, {"serialNo", "deviceID", "deviceId", "device_id", "serialNumber", "deviceSerial", "devIndex"})
        or xml_tags.get("serialNo")
        or xml_tags.get("deviceID")
        or xml_tags.get("deviceId")
        or xml_tags.get("serialNumber")
        or xml_tags.get("deviceSerial")
        or xml_tags.get("devIndex")
        or ""
    ).strip() or None
    camera_mac = _normalize_mac_address(
        _hik_find_first_value(json_payload, {"camera_mac", "macAddress", "mac"})
        or xml_tags.get("macAddress")
        or xml_tags.get("mac")
    )
    camera_ip_val = (
        _hik_find_first_value(json_payload, {"ipAddress", "ipv4Address", "deviceIP", "deviceIp"})
        or xml_tags.get("ipAddress")
        or xml_tags.get("ipv4Address")
        or xml_tags.get("deviceIP")
        or xml_tags.get("deviceIp")
        or ""
    ).strip() or None
    event_time_str = (
        _hik_find_first_value(json_payload, {"eventTime", "dateTime", "localTime", "time", "timestamp"})
        or xml_tags.get("eventTime")
        or xml_tags.get("dateTime")
        or xml_tags.get("localTime")
        or xml_tags.get("time")
        or xml_tags.get("timestamp")
        or ""
    ).strip() or None
    event_type_val = (
        _hik_find_first_value(json_payload, {"eventType"})
        or xml_tags.get("eventType")
        or ""
    ).strip() or None
    sub_event_type_val = (
        _hik_find_first_value(json_payload, {"subEventType", "minorEventType"})
        or xml_tags.get("subEventType")
        or xml_tags.get("minorEventType")
        or ""
    ).strip() or None
    verify_mode_val = (
        _hik_find_first_value(json_payload, {"currentVerifyMode", "verifyMode"})
        or xml_tags.get("currentVerifyMode")
        or xml_tags.get("verifyMode")
        or ""
    ).strip() or None
    wellbeing_note_uz_val = (
        _hik_find_first_value(json_payload, {"wellbeing_note_uz", "wellbeingNoteUz", "state_uz"})
        or xml_tags.get("wellbeing_note_uz")
        or xml_tags.get("wellbeingNoteUz")
        or xml_tags.get("state_uz")
        or ""
    ).strip() or None
    wellbeing_note_ru_val = (
        _hik_find_first_value(json_payload, {"wellbeing_note_ru", "wellbeingNoteRu", "state_ru"})
        or xml_tags.get("wellbeing_note_ru")
        or xml_tags.get("wellbeingNoteRu")
        or xml_tags.get("state_ru")
        or ""
    ).strip() or None
    wellbeing_note_source_val = (
        _hik_find_first_value(json_payload, {"wellbeing_note_source", "wellbeingNoteSource", "state_source"})
        or xml_tags.get("wellbeing_note_source")
        or xml_tags.get("wellbeingNoteSource")
        or xml_tags.get("state_source")
        or ""
    ).strip() or None

    if image_bytes is None:
        encoded_image = (
            _hik_find_first_value(json_payload, {"faceImageData", "image", "imageBase64", "faceImage", "captureImage", "base64Image", "picture", "picData"})
            or xml_tags.get("faceImageData")
            or xml_tags.get("image")
            or xml_tags.get("imageBase64")
            or xml_tags.get("faceImage")
            or xml_tags.get("captureImage")
            or xml_tags.get("base64Image")
            or xml_tags.get("picture")
            or xml_tags.get("picData")
            or None
        )
        decoded_image = _hik_decode_base64_image(encoded_image)
        if decoded_image is not None:
            image_bytes = decoded_image
            image_ext = _hik_guess_image_ext(decoded_image)

    payload_format = "multipart" if "multipart" in content_type else ("json" if json_payload is not None else "xml")
    _camera_event_debug(
        f"[HIK-EVENT] received: format={payload_format}, serial={camera_serial}, mac={camera_mac}, "
        f"person={person_id_val}/{person_name_val}, ts={event_time_str}, has_image={image_bytes is not None}"
    )

    # Kamerani topamiz
    device: Optional[Device] = None
    for candidate in (camera_serial, camera_mac):
        if not candidate:
            continue
        device = db.query(Device).filter(
            or_(
                Device.isup_device_id == candidate,
                Device.mac_address == candidate,
                Device.serial_number == candidate,
                Device.name == candidate,
            )
        ).first()
        if device is not None:
            break
    if device is None:
        forwarded_for = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        real_ip = (request.headers.get("x-real-ip") or "").strip()
        client_ip = forwarded_for or real_ip or (request.client.host if request.client else None)
        if client_ip:
            device = db.query(Device).filter(
                or_(
                    Device.mac_address.contains(client_ip),
                    Device.isup_device_id.contains(client_ip),
                    Device.external_ip.contains(client_ip),
                )
            ).first()

    # Timestamp
    ts_event = _parse_event_dt(event_time_str)

    ignore_invalid_followup = (
        str(event_type_val or "").strip() == "AccessControllerEvent"
        and str(sub_event_type_val or "").strip() in {"21", "22", "1036"}
        and str(verify_mode_val or "").strip().lower() == "invalid"
        and not person_id_val
        and not person_name_val
        and image_bytes is None
        and not snapshot_url
    )
    ignore_noise_event = (
        str(event_type_val or "").strip().lower() == "heartbeat"
        or (
            str(event_type_val or "").strip() == "AccessControllerEvent"
            and str(sub_event_type_val or "").strip() in {"21", "22", "1036"}
            and not person_id_val
            and not person_name_val
            and image_bytes is None
            and not snapshot_url
        )
    )

    # Xodimni topamiz
    emp: Optional[Employee] = None
    if person_id_val:
        emp = db.query(Employee).filter(Employee.personal_id == person_id_val).first()
        if emp is None and person_id_val.isdigit():
            emp = db.query(Employee).filter(Employee.id == int(person_id_val)).first()
    if emp:
        person_name_val = f"{emp.first_name or ''} {emp.last_name or ''}".strip()

    note_uz, note_ru, note_source = _resolve_event_wellbeing_snapshot(
        db,
        emp,
        note_uz=wellbeing_note_uz_val,
        note_ru=wellbeing_note_ru_val,
        source=wellbeing_note_source_val,
    )

    # Rasmni saqlaymiz
    snap_url: Optional[str] = snapshot_url
    if image_bytes:
        try:
            snap_url = _hik_store_snapshot_bytes(image_bytes, ext=image_ext)
            _camera_event_debug(f"[HIK-EVENT] Rasm saqlandi: {snap_url}")
        except Exception as exc:
            _camera_event_debug(f"[HIK-EVENT] Rasm saqlash xatosi: {exc}")
    needs_snapshot_backfill = not str(snap_url or "").strip().startswith("/static/")

    is_dup = False
    existing_log_id: Optional[int] = None
    if device and (person_id_val or (emp is not None and emp.id is not None)):
        existing_log_id = _find_recent_attendance_duplicate(
            db,
            event_time=ts_event,
            person_id=person_id_val,
            employee_id=int(emp.id) if emp is not None and emp.id is not None else None,
            organization_id=int(device.organization_id) if device.organization_id is not None else None,
            exact_device_id=int(device.id) if device.id is not None else None,
        )
        is_dup = existing_log_id is not None

    log_id: Optional[int] = None
    if device:
        device.is_online = True
        device.last_seen_at = now_tashkent()

    # Hikvision ayrim qurilmalarda haqiqiy 75/76 eventdan keyin bo'sh 21/22 invalid
    # follow-up event yuboradi. Uni attendance sifatida saqlamaymiz.
    if ignore_invalid_followup or ignore_noise_event:
        db.commit()
        _camera_event_debug(
            f"[HIK-EVENT] Ignored non-attendance event: device={device.id if device else None}, "
            f"serial={camera_serial}, eventType={event_type_val}, subEventType={sub_event_type_val}, ts={ts_event.isoformat()}"
        )
        return {
            "ok": True,
            "ignored": True,
            "reason": "non_attendance_event",
            "device_id": device.id if device else None,
            "payload_format": payload_format,
            "has_image": image_bytes is not None,
            "snapshot_url": snap_url,
            "person_id": person_id_val,
            "person_name": person_name_val,
            "timestamp": ts_event.isoformat(),
            "sub_event_type": sub_event_type_val,
            "verify_mode": verify_mode_val,
        }

    if not is_dup:
        psychological_profile = detect_psychological_profile(resolve_snapshot_path(snap_url))
        psychological_state_key = str(psychological_profile.get("state_key") or "")
        psychological_state_uz = str(psychological_profile.get("state_uz") or "")
        psychological_state_ru = str(psychological_profile.get("state_ru") or "")
        psychological_state_confidence = psychological_profile.get("confidence")
        emotion_scores = dict(psychological_profile.get("emotion_scores") or {})
        psychological_profile_uz = str(psychological_profile.get("profile_text_uz") or "")
        psychological_profile_ru = str(psychological_profile.get("profile_text_ru") or "")
        new_log = AttendanceLog(
            employee_id=emp.id if emp else None,
            device_id=device.id if device else None,
            camera_mac=device.mac_address if device else (camera_mac or camera_serial),
            person_id=person_id_val,
            person_name=person_name_val,
            snapshot_url=snap_url,
            psychological_state_key=psychological_state_key or None,
            psychological_state_confidence=psychological_state_confidence,
            emotion_scores_json=psychological_profile.get("emotion_scores_json") or None,
            wellbeing_note_uz=note_uz or None,
            wellbeing_note_ru=note_ru or None,
            wellbeing_note_source=note_source or None,
            timestamp=ts_event,
            status="aniqlandi" if emp else "noma'lum",
        )
        db.add(new_log)
        if emp is not None:
            upsert_daily_psychological_state(
                db,
                employee_id=int(emp.id),
                state_key=psychological_state_key,
                confidence=psychological_state_confidence,
                emotion_scores=emotion_scores,
                timestamp=ts_event,
                note=f"hik_event:{device.mac_address if device else (camera_mac or camera_serial)}",
                source="external_system",
            )
        db.flush()
        db.commit()
        log_id = new_log.id
        _publish_attendance_event_redis(
            source="hik_event",
            log_id=log_id,
            timestamp=ts_event,
            device=device,
            employee_id=int(emp.id) if emp else None,
            person_id=person_id_val,
            person_name=person_name_val,
            status=new_log.status,
            snapshot_url=snap_url,
            psychological_state_key=psychological_state_key,
            psychological_state_confidence=psychological_state_confidence,
            emotion_scores=emotion_scores,
            psychological_state_uz=psychological_state_uz,
            psychological_state_ru=psychological_state_ru,
            psychological_profile_uz=psychological_profile_uz,
            psychological_profile_ru=psychological_profile_ru,
            psychological_state_source="external_system" if emp else "",
            wellbeing_note_uz=note_uz,
            wellbeing_note_ru=note_ru,
            wellbeing_note_source=note_source,
        )
        _camera_event_debug(f"[HIK-EVENT] Saqlandi: log_id={log_id}, person={person_id_val}/{person_name_val}, snap={snap_url}")
    else:
        log_id = existing_log_id
        if existing_log_id and snap_url:
            from sqlalchemy import text as _sqlt
            db.execute(
                _sqlt("UPDATE attendance_logs SET snapshot_url=:snap WHERE id=:log_id AND (snapshot_url IS NULL OR snapshot_url='')"),
                {"snap": snap_url, "log_id": existing_log_id},
            )
        db.commit()
        _camera_event_debug(f"[HIK-EVENT] Duplicate event: log_id={existing_log_id}, person={person_id_val}/{person_name_val}, snap={snap_url}")

    if log_id and needs_snapshot_backfill:
        background_tasks.add_task(
            _hik_backfill_snapshot_task,
            log_id=int(log_id),
            isup_device_id=(device.isup_device_id if device else camera_serial),
            camera_ip=camera_ip_val,
            username=(device.username if device else None),
            password=(device.password if device else None),
        )

    return {
        "ok": True,
        "log_id": log_id,
        "duplicate": is_dup,
        "device_id": device.id if device else None,
        "payload_format": payload_format,
        "has_image": image_bytes is not None,
        "snapshot_url": snap_url,
        "snapshot_pending": bool(log_id and needs_snapshot_backfill),
    }
