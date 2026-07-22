import json
import os
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

import models
from database import get_db
from services.redis_client import publish_camera_event
from utils.time_utils import normalize_timestamp_tashkent, now_tashkent
from routers.cameras_parts.psychology_utils import (
    detect_psychological_profile,
    detect_psychological_state,
    resolve_snapshot_path,
    state_labels,
    upsert_daily_psychological_state,
)
from routers.cameras_parts.text_utils import _normalize_mac_address


router = APIRouter()
_UPLOAD_DIR = os.path.join("static", "uploads")
os.makedirs(_UPLOAD_DIR, exist_ok=True)


def _safe_snapshot_name(filename: str) -> str:
    base = os.path.basename(str(filename or "snapshot.jpg")).strip() or "snapshot.jpg"
    ext = base.rsplit(".", 1)[-1].lower() if "." in base else "jpg"
    if ext not in {"jpg", "jpeg", "png", "webp", "bmp", "gif"}:
        ext = "jpg"
    return f"{uuid.uuid4().hex}.{ext}"


def _resolve_event_timestamp(value: Any) -> Any:
    parsed = normalize_timestamp_tashkent(value)
    return parsed if parsed is not None else now_tashkent()


def _employee_allowed_for_device(db: Session, employee: models.Employee | None, device: models.Device | None) -> bool:
    if employee is None:
        return False
    if device is None:
        return True

    if employee.organization_id is not None and device.organization_id is not None:
        if int(employee.organization_id) != int(device.organization_id):
            return False

    linked_camera_ids = {
        int(row[0])
        for row in db.query(models.EmployeeCameraLink.camera_id)
        .filter(models.EmployeeCameraLink.employee_id == int(employee.id))
        .all()
        if row[0] is not None
    }
    if linked_camera_ids and int(device.id) not in linked_camera_ids:
        return False

    return True


def _device_identifier_candidates(*values: str | None) -> list[str]:
    candidates: list[str] = []
    for value in values:
        raw = str(value or "").strip()
        if not raw:
            continue
        for item in (raw, _normalize_mac_address(raw)):
            if item and item not in candidates:
                candidates.append(item)
    return candidates


def _normalize_confidence(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    if parsed < 0:
        return None
    if parsed > 1:
        parsed = parsed / 100.0
    return max(0.0, min(parsed, 1.0))


def _device_min_face_confidence(device: models.Device | None) -> float:
    value = _normalize_confidence(getattr(device, "min_face_confidence", None))
    if value is None or value <= 0:
        return 0.40
    return value


def _resolve_review_state(
    *,
    employee: models.Employee | None,
    device: models.Device | None,
    face_confidence: Optional[float],
) -> tuple[str, Optional[str]]:
    if employee is None:
        return "pending", "unknown_person"
    threshold = _device_min_face_confidence(device)
    if face_confidence is not None and face_confidence < threshold:
        return "pending", f"low_confidence:{face_confidence:.2f}<min:{threshold:.2f}"
    return "auto", None


@router.post("/api/webhook/events")
@router.post("/api/events")
async def camera_event_ingest(
    event_info: str = Form(...),
    picture: UploadFile = File(None),
    db: Session = Depends(get_db),
):
    try:
        data = json.loads(event_info)
        if not isinstance(data, dict):
            raise ValueError("event_info dict bo'lishi kerak")
    except Exception:
        raise HTTPException(status_code=400, detail="Noto'g'ri JSON formati keldi")

    serial_no = str(data.get("device_serial") or data.get("camera_mac") or data.get("device_id") or "").strip()
    if not serial_no:
        raise HTTPException(status_code=422, detail="device_serial (yoki camera_mac/device_id) majburiy")

    identifiers = _device_identifier_candidates(serial_no)
    device = None
    if identifiers:
        device = db.query(models.Device).filter(
            (models.Device.mac_address.in_(identifiers))
            | (models.Device.serial_number.in_(identifiers))
            | (models.Device.isup_device_id.in_(identifiers))
            | (models.Device.name.in_(identifiers))
        ).first()
    if not device:
        raise HTTPException(status_code=404, detail="Bunday serial/mak kamera bazada topilmadi")

    person_id = str(data.get("person_id") or "").strip() or None
    person_name = str(data.get("person_name") or "").strip() or None

    employee: Optional[models.Employee] = None
    employee_id = data.get("employee_id")
    if employee_id is not None:
        try:
            employee = db.query(models.Employee).filter(models.Employee.id == int(employee_id)).first()
        except Exception:
            employee = None
    if employee is None and person_id:
        employee = db.query(models.Employee).filter(models.Employee.personal_id == person_id).first()
    if employee is not None and not _employee_allowed_for_device(db, employee, device):
        employee = None
        person_name = None

    if employee is not None:
        if not person_id:
            person_id = str(employee.personal_id or "").strip() or None
        person_name = " ".join(
            part for part in [employee.first_name, employee.last_name, employee.middle_name] if part and str(part).strip()
        ).strip() or None

    snapshot_url = str(data.get("snapshot_url") or "").strip() or None
    photo_path: Path | None = None
    if picture and picture.filename:
        file_name = f"{uuid.uuid4().hex}.webp"
        file_path = os.path.join(_UPLOAD_DIR, file_name)
        payload = await picture.read()
        try:
            from utils.image_utils import compress_to_webp
            webp_bytes = compress_to_webp(payload)
        except Exception:
            webp_bytes = payload
        with open(file_path, "wb") as file_object:
            file_object.write(webp_bytes)
        snapshot_url = f"/static/uploads/{file_name}"
        photo_path = Path(file_path)
    elif snapshot_url:
        photo_path = resolve_snapshot_path(snapshot_url)

    face_confidence = _normalize_confidence(
        data.get("face_confidence", data.get("confidence", data.get("similarity")))
    )
    review_status, review_reason = _resolve_review_state(
        employee=employee,
        device=device,
        face_confidence=face_confidence,
    )
    event_ts = _resolve_event_timestamp(data.get("timestamp"))
    status = "tasdiqlash_kerak" if employee is not None and review_status == "pending" else ("aniqlandi" if employee is not None else "noma'lum")
    psychological_profile = detect_psychological_profile(photo_path)
    psychological_state_key = str(psychological_profile.get("state_key") or "")
    psychological_state_uz = str(psychological_profile.get("state_uz") or "")
    psychological_state_ru = str(psychological_profile.get("state_ru") or "")
    psychological_state_confidence = psychological_profile.get("confidence")
    emotion_scores = dict(psychological_profile.get("emotion_scores") or {})
    psychological_profile_uz = str(psychological_profile.get("profile_text_uz") or "")
    psychological_profile_ru = str(psychological_profile.get("profile_text_ru") or "")

    new_log = models.AttendanceLog(
        employee_id=int(employee.id) if employee is not None else None,
        device_id=int(device.id),
        camera_mac=str(device.mac_address or "") or None,
        person_id=person_id,
        person_name=person_name,
        timestamp=event_ts,
        snapshot_url=snapshot_url,
        psychological_state_key=psychological_state_key or None,
        psychological_state_confidence=psychological_state_confidence,
        emotion_scores_json=psychological_profile.get("emotion_scores_json") or None,
        face_confidence=face_confidence,
        attendance_source="camera",
        status=status,
        review_status=review_status,
        review_reason=review_reason,
        direction=device.direction if device else None,
    )

    if employee is not None:
        upsert_daily_psychological_state(
            db,
            employee_id=int(employee.id),
            state_key=psychological_state_key,
            confidence=psychological_state_confidence,
            emotion_scores=emotion_scores,
            timestamp=event_ts,
            note=f"multipart_webhook:{new_log.camera_mac or serial_no}",
            source="external_system",
        )

    device.is_online = True
    device.last_seen_at = now_tashkent()

    db.add(new_log)
    db.commit()
    db.refresh(new_log)

    published = publish_camera_event(
        {
            "source": "multipart_webhook",
            "log_id": int(new_log.id),
            "timestamp": new_log.timestamp.isoformat() if new_log.timestamp else None,
            "camera_id": int(device.id),
            "camera_name": str(device.name or ""),
            "camera_mac": str(device.mac_address or ""),
            "organization_id": int(device.organization_id) if device.organization_id is not None else None,
            "employee_id": int(employee.id) if employee is not None else None,
            "person_id": str(person_id or ""),
            "person_name": str(person_name or ""),
            "status": status,
            "review_status": review_status,
            "review_reason": review_reason,
            "face_confidence": face_confidence,
            "snapshot_url": str(snapshot_url or ""),
            "psychological_state_key": psychological_state_key,
            "psychological_state_confidence": psychological_state_confidence,
            "emotion_scores": emotion_scores,
            "psychological_state_uz": psychological_state_uz,
            "psychological_state_ru": psychological_state_ru,
            "psychological_profile_uz": psychological_profile_uz,
            "psychological_profile_ru": psychological_profile_ru,
            "psychological_state_source": "external_system" if employee is not None else "",
        }
    )

    return {
        "ok": True,
        "message": "Voqea saqlandi",
        "log_id": int(new_log.id),
        "employee_found": employee is not None,
        "review_status": review_status,
        "review_reason": review_reason,
        "face_confidence": face_confidence,
        "published": bool(published),
        "psychological_state_key": psychological_state_key,
        "psychological_state_confidence": psychological_state_confidence,
        "emotion_scores": emotion_scores,
        "psychological_state_uz": psychological_state_uz,
        "psychological_state_ru": psychological_state_ru,
        "psychological_profile_uz": psychological_profile_uz,
        "psychological_profile_ru": psychological_profile_ru,
    }
