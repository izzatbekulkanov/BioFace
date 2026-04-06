"""
Kamera API — real DB bilan ishlaydigan router
GET/POST/DELETE /api/cameras
POST /api/webhook — kameradan kelgan hodisa
POST /api/cameras/{id}/command — kameraga buyruq
"""
import asyncio
import base64
from datetime import datetime, timedelta
import json
import os
import random
import re
import uuid
from fastapi import APIRouter, Request, Depends, HTTPException, File, UploadFile, Form
from fastapi.responses import JSONResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any, Optional
import httpx
from PIL import Image
from io import BytesIO

from database import get_db
from hikvision_sdk import get_sdk_status
from isup_manager import get_process_status
from models import Device, AttendanceLog, Employee, Organization
from system_config import (
    ISUP_API_URL,
    ISUP_KEY,
    get_public_web_base_url,
    normalize_public_web_base_url,
)

# ISUP server manzili (default localhost:7670) — health/info uchun ichki URL

# Redis bridge import (graceful fallback if Redis not available)
try:
    from redis_client import (
        get_isup_device as get_isup_device_from_redis,
        get_isup_devices as get_isup_devices_from_redis,
        is_connected as redis_ok,
        send_command_and_wait,
    )
except ImportError:
    def send_command_and_wait(*a, **kw): return None
    def get_isup_devices_from_redis(): return []
    def get_isup_device_from_redis(*a, **kw): return None
    def redis_ok(): return False

router = APIRouter()

CAMERA_USER_IMAGE_DIR = os.path.join("static", "uploads", "employees")
os.makedirs(CAMERA_USER_IMAGE_DIR, exist_ok=True)
PERSONAL_ID_PATTERN = re.compile(r"^[1-9]\d{6}$")


def _normalize_personal_id(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    clean = value.strip()
    return clean or None


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


def _parse_event_dt(value: Any) -> datetime:
    text = str(value or "").strip()
    if not text:
        return datetime.utcnow()

    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is not None:
            return dt.astimezone().replace(tzinfo=None)
        return dt
    except Exception:
        pass

    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y%m%d%H%M%S"):
        try:
            return datetime.strptime(text, fmt)
        except Exception:
            continue
    return datetime.utcnow()


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


def _resolve_public_web_base_url(request: Request) -> str:
    configured = normalize_public_web_base_url(get_public_web_base_url())
    if configured:
        return configured

    forwarded_proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip()
    scheme = forwarded_proto or request.url.scheme or "http"
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    host = forwarded_host.split(",")[0].strip() or request.url.netloc or request.url.hostname or "127.0.0.1"
    return f"{scheme}://{host}".rstrip("/")


# ── Pydantic schemalar ──────────────────────────────────
class CameraCreate(BaseModel):
    name: str
    mac_address: Optional[str] = ""          # Masalan: AA:BB:CC:11:22:33
    isup_device_id: Optional[str] = None  # Masalan: CAM1111 (ISUP Device ID)
    location: Optional[str] = ""
    model: Optional[str] = ""
    max_memory: Optional[int] = 1500
    organization_id: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    isup_password: Optional[str] = ISUP_KEY

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    mac_address: Optional[str] = None
    isup_device_id: Optional[str] = None
    location: Optional[str] = None
    model: Optional[str] = None
    max_memory: Optional[int] = None
    organization_id: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    isup_password: Optional[str] = None


def _pick_first_nonempty(device: dict, keys: tuple[str, ...]) -> Optional[str]:
    for key in keys:
        value = device.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text and text != "-":
            return text
    return None


GENERIC_CAMERA_MODELS = {
    "hikvision isup",
    "hikvision_isup",
    "hikvision-isup",
    "isup",
}


def _normalize_model_key(value: Optional[str]) -> str:
    text = str(value or "").strip().lower()
    return re.sub(r"[\s_-]+", " ", text)


def _is_generic_camera_model(value: Optional[str]) -> bool:
    return _normalize_model_key(value) in GENERIC_CAMERA_MODELS


def _prefer_persistent_model(current_model: Optional[str], live_model: Optional[str]) -> Optional[str]:
    current = str(current_model or "").strip()
    live = str(live_model or "").strip()

    if not live:
        return current or None
    if current and not _is_generic_camera_model(current):
        return current
    if _is_generic_camera_model(live) and current:
        return current
    return live


def _extract_command_camera_info(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    camera_info = payload.get("camera_info")
    if isinstance(camera_info, dict):
        return camera_info
    nested = payload.get("response")
    if isinstance(nested, dict):
        nested_info = nested.get("camera_info")
        if isinstance(nested_info, dict):
            return nested_info
    return {}


def _normalize_mac_address(value: Optional[str]) -> Optional[str]:
    raw = str(value or "").strip().upper()
    if not raw:
        return None
    if re.fullmatch(r"[0-9A-F]{12}", raw):
        return ":".join(raw[i:i + 2] for i in range(0, 12, 2))
    if re.fullmatch(r"[0-9A-F]{2}([-:][0-9A-F]{2}){5}", raw):
        return raw.replace("-", ":")
    return raw


def _strip_or_none(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None


def _resolve_device_identifier(raw: Optional[str], db: Session) -> str:
    """
    MAC/serial majburiy emas:
    - berilsa o'shani ishlatadi;
    - bo'sh bo'lsa avtomatik unik identifier beradi.
    """
    candidate = (_strip_or_none(raw) or "").upper()
    if candidate:
        return candidate

    while True:
        generated = f"AUTO-{uuid.uuid4().hex[:12].upper()}"
        exists = db.query(Device).filter(Device.mac_address == generated).first()
        if not exists:
            return generated


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
    # Priority: explicit ISUP ID -> MAC -> camera name
    candidates = []
    if cam.isup_device_id:
        candidates.append(cam.isup_device_id.strip())
    if cam.mac_address:
        candidates.append(cam.mac_address.strip())
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

    target_id = _pick_first_nonempty(live_info, ("device_id", "id", "deviceId")) or cam.isup_device_id or cam.mac_address
    if not target_id:
        raise HTTPException(status_code=400, detail="ISUP Device ID topilmadi")

    return target_id, live_info, source


class WebhookPayload(BaseModel):
    """Kamera yuboradigan JSON formati (Hikvision moslashtirilgan farazda)"""
    camera_mac: str              # Qaysi kameradan: "AA:BB:CC:11:22:33"
    person_id: Optional[str] = None
    person_name: Optional[str] = None
    snapshot_url: Optional[str] = None
    timestamp: Optional[str] = None


class CommandPayload(BaseModel):
    command: str         # "get_users", "sync_faces", "restart", "get_info", "clear_faces"
    params: Optional[dict] = {}


# ── GET /api/cameras — barcha kameralar ───────────────
@router.get("/api/cameras")
def list_cameras(request: Request, db: Session = Depends(get_db)):
    cams = db.query(Device).order_by(Device.id).all()
    base_url = _resolve_public_web_base_url(request)
    now = datetime.utcnow()
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

            if live_device_id and c.isup_device_id != live_device_id:
                c.isup_device_id = live_device_id
            resolved_model = _prefer_persistent_model(c.model, live_model)
            if resolved_model and c.model != resolved_model:
                c.model = resolved_model
        elif isup_available and c.isup_device_id:
            isup_online = False

        if isup_online is None:
            dynamic_online = bool(c.last_seen_at and (now - c.last_seen_at) <= online_threshold)
        else:
            dynamic_online = isup_online
        # DB dagi is_online ni ham sinxron yangilaymiz (ixtiyoriy, lekin foydali)
        if c.is_online != dynamic_online:
            c.is_online = dynamic_online
        result.append({
            "id": c.id,
            "name": c.name,
            "mac_address": c.mac_address,
            "isup_device_id": c.isup_device_id,
            "location": c.location,
            "model": c.model,
            "max_memory": c.max_memory,
            "used_faces": c.used_faces,
            "organization_id": c.organization_id,
            "username": c.username,
            "isup_password": c.isup_password or ISUP_KEY,
            "has_password": bool(c.password),
            "is_online": dynamic_online,
            "last_seen_at": c.last_seen_at.isoformat() if c.last_seen_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "webhook_url": f"{base_url}/api/webhook",
            "events_today": db.query(AttendanceLog).filter(
                AttendanceLog.device_id == c.id,
                AttendanceLog.timestamp >= now.replace(hour=0, minute=0, second=0)
            ).count()
        })
    db.commit()
    return result


# ── POST /api/cameras — yangi kamera qo'shish ─────────
@router.post("/api/cameras")
def add_camera(request: Request, data: CameraCreate, db: Session = Depends(get_db)):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Kamera nomi majburiy")

    mac_or_serial = _resolve_device_identifier(data.mac_address, db)
    isup_device_id = data.isup_device_id.strip() if data.isup_device_id else None
    existing = db.query(Device).filter(Device.mac_address == mac_or_serial).first()
    if existing:
        raise HTTPException(status_code=409, detail="Bu MAC manzil allaqachon ro'yxatdan o'tgan")
    if isup_device_id:
        existing_isup = db.query(Device).filter(Device.isup_device_id == isup_device_id).first()
        if existing_isup:
            raise HTTPException(status_code=409, detail="Bu ISUP Device ID allaqachon ro'yxatdan o'tgan")
    
    username = _strip_or_none(data.username)
    password = _strip_or_none(data.password)
    isup_password = _strip_or_none(data.isup_password) or ISUP_KEY

    cam = Device(
        name=name,
        mac_address=mac_or_serial,
        isup_device_id=isup_device_id,
        location=data.location,
        model=data.model,
        max_memory=data.max_memory,
        organization_id=data.organization_id,
        username=username,
        password=password,
        isup_password=isup_password,
    )
    db.add(cam)
    db.commit()
    db.refresh(cam)
    
    # Siz ko'rsatgan tizim webhook manzili:
    base_url = _resolve_public_web_base_url(request)
    webhook_url = f"{base_url}/api/webhook"
    
    return {
        "ok": True, 
        "id": cam.id, 
        "webhook_url": webhook_url,
        "message": f"Kamera saqlandi. Sozlamalarga quyidagi URL ni yozing: {webhook_url}"
    }


# ── DELETE /api/cameras/{id} ───────────────────────────
@router.delete("/api/cameras/{cam_id}")
def delete_camera(cam_id: int, db: Session = Depends(get_db)):
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")
    db.delete(cam)
    db.commit()
    return {"ok": True, "message": "Kamera o'chirildi"}

# ── PUT /api/cameras/{id} ─────────────────────────────
@router.put("/api/cameras/{cam_id}")
def update_camera(cam_id: int, data: CameraUpdate, db: Session = Depends(get_db)):
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")
    
    if data.mac_address and data.mac_address != cam.mac_address:
        existing = db.query(Device).filter(Device.mac_address == data.mac_address).first()
        if existing:
            raise HTTPException(status_code=409, detail="Bu MAC manzil allaqachon mavjud")
        cam.mac_address = data.mac_address

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
    device = db.query(Device).filter(Device.mac_address == payload.camera_mac).first()
    if not device:
        raise HTTPException(status_code=403, detail="Ruxsat etilmagan kamera (MAC manzil ro'yxatda yo'q)")

    ts = datetime.utcnow()
    if payload.timestamp:
        try:
            ts = datetime.fromisoformat(payload.timestamp)
        except Exception:
            pass

    person_id = (payload.person_id or "").strip()
    person_name = (payload.person_name or "").strip() or None
    employee = None
    if person_id:
        employee = db.query(Employee).filter(Employee.personal_id == person_id).first()
    if employee is None and person_id.isdigit():
        employee = db.query(Employee).filter(Employee.id == int(person_id)).first()
    if employee is not None and not person_name:
        person_name = f"{employee.first_name or ''} {employee.last_name or ''}".strip() or None

    log = AttendanceLog(
        employee_id=employee.id if employee else None,
        device_id=device.id,
        camera_mac=device.mac_address,
        person_id=person_id or None,
        person_name=person_name,
        snapshot_url=(payload.snapshot_url or "").strip() or None,
        timestamp=ts,
        status="aniqlandi" if employee else "noma'lum",
    )
    db.add(log)
    device.is_online = True
    device.last_seen_at = datetime.utcnow()
    db.commit()
    db.refresh(log)

    return {
        "ok": True,
        "camera_name": device.name,
        "employee_found": employee is not None,
        "log_id": log.id,
        "message": "Ma'lumot qabul qilindi",
    }


# ── DELETE /api/cameras/{id} ───────────────────────────
@router.delete("/api/cameras/{cam_id}")
def delete_camera(cam_id: int, db: Session = Depends(get_db)):
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")
    db.delete(cam)
    db.commit()
    return {"ok": True, "message": "Kamera o'chirildi"}

# ── PUT /api/cameras/{id} ─────────────────────────────
@router.put("/api/cameras/{cam_id}")
def update_camera(cam_id: int, data: CameraUpdate, db: Session = Depends(get_db)):
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")
    
    if data.mac_address and data.mac_address != cam.mac_address:
        existing = db.query(Device).filter(Device.mac_address == data.mac_address).first()
        if existing:
            raise HTTPException(status_code=409, detail="Bu MAC manzil allaqachon mavjud")
        cam.mac_address = data.mac_address

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
    device = db.query(Device).filter(Device.mac_address == payload.camera_mac).first()
    if not device:
        raise HTTPException(status_code=403, detail="Ruxsat etilmagan kamera (MAC manzil ro'yxatda yo'q)")

    ts = datetime.utcnow()
    if payload.timestamp:
        try:
            ts = datetime.fromisoformat(payload.timestamp)
        except Exception:
            pass

    person_id = (payload.person_id or "").strip()
    person_name = (payload.person_name or "").strip() or None
    employee = None
    if person_id:
        employee = db.query(Employee).filter(Employee.personal_id == person_id).first()
    if employee is None and person_id.isdigit():
        employee = db.query(Employee).filter(Employee.id == int(person_id)).first()
    if employee is not None and not person_name:
        person_name = f"{employee.first_name or ''} {employee.last_name or ''}".strip() or None

    log = AttendanceLog(
        employee_id=employee.id if employee else None,
        device_id=device.id,
        camera_mac=device.mac_address,
        person_id=person_id or None,
        person_name=person_name,
        snapshot_url=(payload.snapshot_url or "").strip() or None,
        timestamp=ts,
        status="aniqlandi" if employee else "noma'lum",
    )
    db.add(log)
    device.is_online = True
    device.last_seen_at = datetime.utcnow()
    db.commit()
    db.refresh(log)

    return {
        "ok": True,
        "camera_name": device.name,
        "employee_found": employee is not None,
        "log_id": log.id,
        "message": "Ma'lumot qabul qilindi"
    }


# ── POST /api/cameras/{id}/command ────────────────────
ALLOWED_COMMANDS = {
    "ping":         "Kameraga ulanishni tekshirish",
    "get_device_snapshot": "Kameradan batafsil holat/capacity ma'lumotini olish",
    "get_users":    "Kameradagi yuzlar ro'yxatini olish",
    "get_attendance_events": "Kameradagi davomat eventlarini olish",
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
def send_command(cam_id: int, payload: CommandPayload, db: Session = Depends(get_db)):
    if payload.command not in ALLOWED_COMMANDS:
        raise HTTPException(status_code=400, detail="Noto'g'ri buyruq")
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")

    target_id, _, source = _resolve_online_command_target(cam)

    response = _send_isup_command_or_raise(
        target_id,
        payload.command,
        payload.params or {},
        timeout=10.0,
    )

    return {
        "ok": True,
        "transport": "isup_redis",
        "isup_source": source,
        "camera": cam.name,
        "command": payload.command,
        "description": ALLOWED_COMMANDS[payload.command],
        "target_device_id": target_id,
        "response": response,
        "message": f"'{ALLOWED_COMMANDS[payload.command]}' buyrug'i ISUP orqali yuborildi",
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
def get_camera_snapshot(cam_id: int, db: Session = Depends(get_db)):
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")

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
    return {
        "ok": True,
        "camera": {
            "id": cam.id,
            "name": cam.name,
            "isup_device_id": cam.isup_device_id,
            "mac_address": cam.mac_address,
            "model": cam.model,
            "organization_id": cam.organization_id,
        },
        "live": live_info,
        "isup_source": source,
        "snapshot": snapshot_response.get("snapshot", {}),
        "warnings": snapshot_response.get("warnings", []),
    }


@router.post("/api/cameras/{cam_id}/sync-metadata")
def sync_camera_metadata(cam_id: int, db: Session = Depends(get_db)):
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")

    target_id, _, source = _resolve_online_command_target(cam)
    info_response = _send_isup_command_or_raise(
        target_id,
        "get_info",
        {},
        timeout=12.0,
    )
    camera_info = _extract_command_camera_info(info_response)

    updated: dict[str, str] = {}
    skipped: list[str] = []

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
            "serial_number": _pick_first_nonempty(camera_info, ("serialNumber",)),
            "firmware_version": _pick_first_nonempty(camera_info, ("firmwareVersion",)),
            "device_uuid": _pick_first_nonempty(camera_info, ("deviceID",)),
            "mac_address": incoming_mac or _pick_first_nonempty(camera_info, ("macAddress", "MACAddress")),
        },
        "camera_info": camera_info,
        "message": "Kamera metadata sinxronlandi." if updated else "Yangi metadata topilmadi.",
    }


@router.get("/api/cameras/{cam_id}/camera-users")
def get_camera_users(cam_id: int, limit: int = 300, db: Session = Depends(get_db)):
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")
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
    return {
        "ok": True,
        "camera_id": cam.id,
        "camera_name": cam.name,
        "target_device_id": target_id,
        "isup_source": source,
        "count": len(users),
        "users": users,
    }


@router.post("/api/cameras/{cam_id}/import-camera-users")
def import_camera_users_to_db(
    cam_id: int,
    limit: int = 500,
    allow_camera_http_download: bool = False,
    db: Session = Depends(get_db),
):
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")
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
        raise
    face_records_error: Optional[str] = None
    try:
        face_records_resp = _send_isup_command_or_raise(
            target_id,
            "get_face_records",
            {"all": True, "limit": limit},
            timeout=20.0,
        )
        face_records = face_records_resp.get("records", []) if isinstance(face_records_resp, dict) else []
    except HTTPException as exc:
        face_records = []
        face_records_error = str(exc.detail)
    face_url_map: dict[str, str] = {}
    for row in face_records:
        if not isinstance(row, dict):
            continue
        fpid = str(row.get("fpid") or "").strip()
        face_url = str(row.get("face_url") or "").strip()
        if fpid and face_url and fpid not in face_url_map:
            face_url_map[fpid] = face_url

    created = 0
    updated = 0
    skipped = 0
    downloaded_faces = 0

    for row in users:
        employee_no = str(row.get("employeeNo") or "").strip()
        full_name = str(row.get("name") or "").strip()
        if not employee_no:
            skipped += 1
            continue

        first_name, last_name = _split_full_name(full_name)
        emp = db.query(Employee).filter(Employee.personal_id == employee_no).first()
        if emp is None:
            emp = Employee(
                first_name=first_name,
                last_name=last_name,
                personal_id=employee_no,
                has_access=True,
                organization_id=cam.organization_id,
            )
            db.add(emp)
            created += 1
        else:
            changed = False
            if first_name and emp.first_name != first_name:
                emp.first_name = first_name
                changed = True
            if last_name and emp.last_name != last_name:
                emp.last_name = last_name
                changed = True
            if changed:
                updated += 1

        face_url = face_url_map.get(employee_no)
        if (
            allow_camera_http_download
            and face_url
            and cam.username
            and cam.password
            and not emp.image_url
        ):
            image_url = _download_face_to_local(face_url, cam.username, cam.password)
            if image_url:
                emp.image_url = image_url
                downloaded_faces += 1

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Import paytida DB xatoligi: {exc}")

    return {
        "ok": True,
        "camera_id": cam.id,
        "camera_name": cam.name,
        "target_device_id": target_id,
        "isup_source": source,
        "imported_users_total": len(users),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "faces_downloaded": downloaded_faces,
        "allow_camera_http_download": allow_camera_http_download,
        "face_records_error": face_records_error,
        "message": f"Kameradan bazaga import yakunlandi: {created} yangi, {updated} yangilandi, {downloaded_faces} rasm olindi.",
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
    response = _send_isup_command_or_raise(
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


# ── GET /api/cameras/by-org/{org_id} ─────────────────────────────
@router.post("/api/cameras/{cam_id}/users/upload")
async def add_user_to_camera_with_image(
    request: Request,
    cam_id: int,
    first_name: str = Form(...),
    last_name: str = Form(...),
    personal_id: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    cam = db.query(Device).filter(Device.id == cam_id).first()
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")

    pid = _normalize_personal_id(personal_id)
    if pid is None:
        pid = _generate_unique_personal_id(db)

    image_url = None
    image_bytes: Optional[bytes] = None
    image_mime = "image/jpeg"
    if image and image.filename:
        ext = image.filename.split(".")[-1].lower()
        if ext not in {"jpg", "jpeg", "png", "webp"}:
            raise HTTPException(status_code=400, detail="Rasm formati noto'g'ri (jpg/png/webp)")

        # Kamera uchun eng mos format: JPEG. PNG/WEBP yuklansa ham JPEG qilib saqlaymiz.
        filename = f"{uuid.uuid4().hex}.jpg"
        filepath = os.path.join(CAMERA_USER_IMAGE_DIR, filename)
        try:
            raw = await image.read()
            with Image.open(BytesIO(raw)) as img:
                rgb = img.convert("RGB")
                # Juda katta rasm yuborilsa ISUP PTXML yuklamasi sekinlashmasligi uchun o'lchamni me'yorlaymiz.
                max_side = 720
                if max(rgb.size) > max_side:
                    rgb.thumbnail((max_side, max_side))
                out = BytesIO()
                rgb.save(out, format="JPEG", quality=88, optimize=True)
                image_bytes = out.getvalue()
            with open(filepath, "wb") as f:
                f.write(image_bytes or b"")
        except Exception:
            # PIL bilan o'qilmasa, fallback sifatida original faylni saqlaymiz.
            ext_fallback = "jpg" if ext in {"jpg", "jpeg"} else ext
            filename = f"{uuid.uuid4().hex}.{ext_fallback}"
            filepath = os.path.join(CAMERA_USER_IMAGE_DIR, filename)
            if image_bytes is None:
                image.file.seek(0)
                image_bytes = image.file.read()
            with open(filepath, "wb") as buffer:
                buffer.write(image_bytes or b"")
            if ext_fallback == "png":
                image_mime = "image/png"
            elif ext_fallback == "webp":
                image_mime = "image/webp"
            else:
                image_mime = "image/jpeg"
        image_url = f"/{CAMERA_USER_IMAGE_DIR.replace(os.sep, '/')}/{filename}"

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

    # Local user avval saqlanadi, keyin kamera tomonga ISUP push qilinadi.
    add_user_response: dict[str, Any] = {
        "ok": False,
        "skipped": True,
        "error": "Kamera push hali urinilmadi",
    }
    set_face_response = None
    camera_push_error: Optional[str] = None
    camera_push_attempted = False
    try:
        target_id, _, _ = _resolve_online_command_target(cam)
        camera_push_attempted = True
        add_user_response = _send_isup_command_or_raise(
            target_id,
            "add_user",
            {
                "first_name": first_name,
                "last_name": last_name,
                "personal_id": pid,
            },
            timeout=12.0,
        )

        if image_url and image_bytes:
            public_base = _resolve_public_web_base_url(request)
            face_url = f"{public_base}{image_url}"

            # add_user dan keyin kamera yozuvni qabul qilishiga qisqa vaqt beramiz.
            await asyncio.sleep(0.25)
            try:
                face_b64 = base64.b64encode(image_bytes).decode("ascii")
                set_face_response = _send_isup_command_or_raise(
                    target_id,
                    "set_face",
                    {
                        "personal_id": pid,
                        "face_b64": face_b64,
                        "face_mime": image_mime,
                        "face_url": face_url,
                    },
                    timeout=10.0,
                )
            except HTTPException as exc:
                err = str(exc.detail)
                low = err.lower()
                transient = "code=10" in low or "fpid" in low or "isup javobi kelmadi" in low
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
        "message": message,
    }


@router.get("/api/cameras/by-org/{org_id}")
def cameras_by_org(org_id: int, db: Session = Depends(get_db)):
    """Return cameras belonging to a specific organization."""
    now = datetime.utcnow()
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
    paginated: bool = False,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(AttendanceLog)
    if camera_id is not None:
        query = query.filter(AttendanceLog.device_id == camera_id)
    if organization_id is not None:
        query = query.outerjoin(AttendanceLog.device).outerjoin(AttendanceLog.employee).filter(
            or_(
                Device.organization_id == organization_id,
                Employee.organization_id == organization_id,
            )
        )

    order_query = query.order_by(AttendanceLog.timestamp.desc(), AttendanceLog.id.desc())

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
    db: Session = Depends(get_db),
):
    safe_limit = max(1, min(int(limit), 3000))
    query = db.query(AttendanceLog)
    if camera_id is not None:
        query = query.filter(AttendanceLog.device_id == camera_id)
    if after_id is not None:
        query = query.filter(AttendanceLog.id > after_id)

    # after_id berilganda faqat yangi yozuvlarni kichikdan kattaga qaytaramiz,
    # aks holda UI uchun oxirgi yozuvlar tepadan pastga (desc) kerak.
    if after_id is not None:
        logs = query.order_by(AttendanceLog.id.asc()).limit(safe_limit).all()
    else:
        logs = query.order_by(AttendanceLog.timestamp.desc(), AttendanceLog.id.desc()).limit(safe_limit).all()

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

        if organization_id is not None:
            if not organization or int(organization.id) != int(organization_id):
                continue

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


# ── GET /api/isup-devices — ISUP orqali ulangan kameralar ──────
def _sync_attendance_for_camera(
    cam: Device,
    db: Session,
    *,
    backfill_hours: int,
    max_events: int,
) -> dict[str, Any]:
    try:
        target_id, _, source = _resolve_online_command_target(cam)
    except HTTPException as exc:
        return {
            "camera_id": cam.id,
            "camera_name": cam.name,
            "ok": False,
            "fetched": 0,
            "inserted": 0,
            "duplicates": 0,
            "error": str(exc.detail),
        }

    try:
        resp = _send_isup_command_or_raise(
            target_id,
            "get_attendance_events",
            {
                "hours": max(1, min(int(backfill_hours), 24 * 30)),
                "limit": max(1, min(int(max_events), 2000)),
                "max_results": 10,
            },
            timeout=25.0,
        )
    except HTTPException as exc:
        return {
            "camera_id": cam.id,
            "camera_name": cam.name,
            "ok": False,
            "fetched": 0,
            "inserted": 0,
            "duplicates": 0,
            "error": str(exc.detail),
        }

    rows = resp.get("events", []) if isinstance(resp, dict) else []
    if not isinstance(rows, list):
        rows = []

    inserted = 0
    duplicates = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        person_id = str(row.get("person_id") or "").strip() or None
        person_name = str(row.get("person_name") or "").strip() or None
        snapshot_url = str(row.get("snapshot_url") or "").strip() or None
        ts = _parse_event_dt(row.get("timestamp"))

        employee = None
        if person_id:
            employee = db.query(Employee).filter(Employee.personal_id == person_id).first()
            if employee is None and person_id.isdigit():
                employee = db.query(Employee).filter(Employee.id == int(person_id)).first()

        existing_q = db.query(AttendanceLog.id).filter(
            AttendanceLog.device_id == cam.id,
            AttendanceLog.timestamp >= ts - timedelta(seconds=2),
            AttendanceLog.timestamp <= ts + timedelta(seconds=2),
        )
        if person_id:
            existing_q = existing_q.filter(AttendanceLog.person_id == person_id)
        existing = existing_q.first()
        if existing:
            duplicates += 1
            continue

        db.add(
            AttendanceLog(
                employee_id=employee.id if employee else None,
                device_id=cam.id,
                camera_mac=cam.mac_address,
                person_id=person_id,
                person_name=person_name,
                snapshot_url=snapshot_url,
                timestamp=ts,
                status="aniqlandi" if employee else "noma'lum",
            )
        )
        inserted += 1

    cam.is_online = True
    cam.last_seen_at = datetime.utcnow()
    return {
        "camera_id": cam.id,
        "camera_name": cam.name,
        "ok": True,
        "isup_source": source,
        "target_device_id": target_id,
        "fetched": len(rows),
        "inserted": inserted,
        "duplicates": duplicates,
    }


@router.post("/api/attendance/sync")
def sync_attendance(
    camera_id: Optional[int] = None,
    backfill_hours: int = 168,
    max_events: int = 600,
    db: Session = Depends(get_db),
):
    cams_q = db.query(Device).order_by(Device.id)
    if camera_id is not None:
        cams_q = cams_q.filter(Device.id == camera_id)
    cameras = cams_q.all()
    if not cameras:
        raise HTTPException(status_code=404, detail="Kamera topilmadi")

    rows: list[dict[str, Any]] = []
    fetched = 0
    inserted = 0
    duplicates = 0
    for cam in cameras:
        result = _sync_attendance_for_camera(
            cam,
            db,
            backfill_hours=backfill_hours,
            max_events=max_events,
        )
        rows.append(result)
        fetched += int(result.get("fetched") or 0)
        inserted += int(result.get("inserted") or 0)
        duplicates += int(result.get("duplicates") or 0)

    db.commit()
    return {
        "ok": True,
        "camera_count": len(cameras),
        "fetched": fetched,
        "inserted": inserted,
        "duplicates": duplicates,
        "rows": rows,
        "message": f"Davomat sinxronlandi: {inserted} yangi, {duplicates} dublikat.",
    }


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
    checked_at = datetime.utcnow().isoformat() + "Z"
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


@router.get("/api/isup-sdk-status")
def isup_sdk_status():
    return get_sdk_status()


# ── POST /api/hik-event — Hikvision native XML/multipart event ────────────
# DS-K kameralar "Alarm Linkage → HTTP Push" yoki "EventNotificationAlert" orqali
# yuz tanish eventini XML + face image (JPEG) sifatida yuboradi.
# Kamera sozlamalari: Network → HTTP Listening Event → URL=/api/hik-event
import xml.etree.ElementTree as _ET
_HIK_SNAP_DIR = os.path.join("static", "uploads", "isup")
os.makedirs(_HIK_SNAP_DIR, exist_ok=True)


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
    return raw if _hik_is_image_bytes(raw) else None

@router.post("/api/hik-event")
async def hik_event_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Hikvision DS-K kameralarining HTTP push notification endpointi.
    Kamera sozlamalari:
      Configuration → Network → Advanced Settings → HTTP Listening
      yoki Event → Basic Event → Alarm Linkage → HTTP Push
    URL: https://example.com/api/hik-event
    """
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

    if "multipart" in content_type:
        try:
            form = await request.form()
        except Exception:
            form = {}
        for key, val in form.items():
            key_name = str(key or "").strip()
            lowered_key = key_name.lower()
            text_value = ""

            if hasattr(val, "read"):
                raw = await val.read()
                if raw:
                    filename = getattr(val, "filename", "") or ""
                    if image_bytes is None and (lowered_key in image_part_keys or _hik_is_image_bytes(raw)):
                        image_bytes = raw
                        image_ext = _hik_guess_image_ext(raw, filename)
                        continue
                    text_value = raw.decode("utf-8", errors="ignore").strip()
            else:
                text_value = str(val).strip()

            if not text_value:
                continue
            text_parts.append(text_value)

            if image_bytes is None and lowered_key in image_b64_keys:
                decoded_image = _hik_decode_base64_image(text_value)
                if decoded_image is not None:
                    image_bytes = decoded_image
                    image_ext = _hik_guess_image_ext(decoded_image)
                    continue

            if json_payload is None:
                parsed_json = _hik_try_parse_json(text_value)
                if parsed_json is not None:
                    json_payload = parsed_json
            if not xml_text and "<" in text_value and ">" in text_value:
                xml_text = text_value
    else:
        body = await request.body()
        if body and _hik_is_image_bytes(body):
            image_bytes = body
            image_ext = _hik_guess_image_ext(body)
        else:
            body_text = body.decode("utf-8", errors="ignore").strip()
            if body_text:
                text_parts.append(body_text)
                json_payload = _hik_try_parse_json(body_text)
                if "<" in body_text and ">" in body_text:
                    xml_text = body_text

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
    event_time_str: Optional[str] = None
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
    event_time_str = (
        _hik_find_first_value(json_payload, {"eventTime", "dateTime", "localTime", "time", "timestamp"})
        or xml_tags.get("eventTime")
        or xml_tags.get("dateTime")
        or xml_tags.get("localTime")
        or xml_tags.get("time")
        or xml_tags.get("timestamp")
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
    print(
        f"[HIK-EVENT] received: format={payload_format}, serial={camera_serial}, mac={camera_mac}, "
        f"person={person_id_val}/{person_name_val}, ts={event_time_str}, has_image={image_bytes is not None}"
    )

    # Kamerani topamiz
    device: Optional[Device] = None
    for candidate in (camera_serial, camera_mac):
        if not candidate:
            continue
        device = db.query(Device).filter(
            or_(Device.isup_device_id == candidate, Device.mac_address == candidate, Device.name == candidate)
        ).first()
        if device is not None:
            break
    if device is None:
        forwarded_for = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
        real_ip = (request.headers.get("x-real-ip") or "").strip()
        client_ip = forwarded_for or real_ip or (request.client.host if request.client else None)
        if client_ip:
            device = db.query(Device).filter(
                or_(Device.mac_address.contains(client_ip), Device.isup_device_id.contains(client_ip))
            ).first()

    # Timestamp
    ts_event = _parse_event_dt(event_time_str)

    # Xodimni topamiz
    emp: Optional[Employee] = None
    if person_id_val:
        emp = db.query(Employee).filter(Employee.personal_id == person_id_val).first()
        if emp is None and person_id_val.isdigit():
            emp = db.query(Employee).filter(Employee.id == int(person_id_val)).first()
    if emp and not person_name_val:
        person_name_val = f"{emp.first_name or ''} {emp.last_name or ''}".strip()

    # Rasmni saqlaymiz
    snap_url: Optional[str] = snapshot_url
    if image_bytes:
        try:
            ts_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
            fname = f"hik_{ts_str}.{image_ext}"
            fpath = os.path.join(_HIK_SNAP_DIR, fname)
            with open(fpath, "wb") as f:
                f.write(image_bytes)
            snap_url = f"/static/uploads/isup/{fname}"
            print(f"[HIK-EVENT] Rasm saqlandi: {snap_url}")
        except Exception as exc:
            print(f"[HIK-EVENT] Rasm saqlash xatosi: {exc}")

    # Dedup: 8s oyna
    from sqlalchemy import text as _sqlt
    is_dup = False
    existing_log_id: Optional[int] = None
    if device and person_id_val:
        ts_sql = ts_event.strftime("%Y-%m-%d %H:%M:%S")
        dup = db.execute(
            _sqlt("SELECT id FROM attendance_logs WHERE device_id=:did AND person_id=:pid AND ABS(strftime('%s',timestamp)-strftime('%s',:ts))<=8 LIMIT 1"),
            {"did": device.id, "pid": person_id_val, "ts": ts_sql}
        ).first()
        if dup is not None:
            existing_log_id = int(dup[0])
            is_dup = True

    log_id: Optional[int] = None
    if device:
        device.is_online = True
        device.last_seen_at = datetime.utcnow()

    if not is_dup:
        new_log = AttendanceLog(
            employee_id=emp.id if emp else None,
            device_id=device.id if device else None,
            camera_mac=device.mac_address if device else (camera_mac or camera_serial),
            person_id=person_id_val,
            person_name=person_name_val,
            snapshot_url=snap_url,
            timestamp=ts_event,
            status="aniqlandi" if emp else "noma'lum",
        )
        db.add(new_log)
        db.commit()
        db.refresh(new_log)
        log_id = new_log.id
        print(f"[HIK-EVENT] Saqlandi: log_id={log_id}, person={person_id_val}/{person_name_val}, snap={snap_url}")
    else:
        log_id = existing_log_id
        if existing_log_id and snap_url:
            db.execute(
                _sqlt("UPDATE attendance_logs SET snapshot_url=:snap WHERE id=:log_id AND (snapshot_url IS NULL OR snapshot_url='')"),
                {"snap": snap_url, "log_id": existing_log_id},
            )
        db.commit()
        print(f"[HIK-EVENT] Duplicate event: log_id={existing_log_id}, person={person_id_val}/{person_name_val}, snap={snap_url}")

    return {
        "ok": True,
        "log_id": log_id,
        "duplicate": is_dup,
        "device_id": device.id if device else None,
        "payload_format": payload_format,
        "has_image": image_bytes is not None,
    }
