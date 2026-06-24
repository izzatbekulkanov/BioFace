import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any, Optional

from database import get_db
from models import Device
from services.hikvision_sdk import get_sdk_status
from services.isup_manager import get_process_status
from utils.time_utils import now_tashkent
from config.system_config import ISUP_API_URL, ISUP_KEY

# Redis bridge import (graceful fallback if Redis not available)
try:
    from services.redis_client import (
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

from routers.cameras_parts import (
    _extract_command_camera_info,
    _is_probable_mac_address,
    _normalize_mac_address,
    _pick_first_nonempty,
    _prefer_persistent_model,
    _extract_device_list,
)

router = APIRouter()

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


@router.get("/api/isup-devices/{device_id}/metadata")
def get_isup_device_metadata(device_id: str):
    """Live ISUP qurilmadan saqlash formasi uchun MAC, serial va modelni aniqlaydi."""
    target_device_id = str(device_id or "").strip()
    if not target_device_id:
        raise HTTPException(status_code=400, detail="ISUP Device ID majburiy")

    live_device: dict[str, Any] = {}
    warnings: list[str] = []
    try:
        response = httpx.get(f"{ISUP_API_URL}/devices/{target_device_id}", timeout=3.0)
        if response.status_code < 400:
            payload = response.json()
            if isinstance(payload, dict):
                live_device = payload
    except Exception as exc:
        warnings.append(f"Live registry o'qilmadi: {exc}")

    info_response: dict[str, Any] = {}
    if redis_ok():
        try:
            raw_response = send_command_and_wait(target_device_id, "get_info", {}, timeout=8.0)
            if isinstance(raw_response, dict):
                info_response = raw_response
                if raw_response.get("ok") is False:
                    warnings.append(str(raw_response.get("error") or "get_info xatolik qaytardi"))
            else:
                warnings.append("get_info javobi kelmadi")
        except Exception as exc:
            warnings.append(f"get_info bajarilmadi: {exc}")
    else:
        warnings.append("Redis command bridge ulanmagan")

    camera_info = _extract_command_camera_info(info_response)
    device_info = info_response.get("device") if isinstance(info_response.get("device"), dict) else {}
    network_info = info_response.get("network_info") if isinstance(info_response.get("network_info"), dict) else {}

    mac_address = _normalize_mac_address(
        _pick_first_nonempty(camera_info, ("macAddress", "MACAddress"))
        or _pick_first_nonempty(network_info, ("macAddress", "MACAddress"))
        or _pick_first_nonempty(device_info, ("mac_address", "mac", "macAddress"))
        or _pick_first_nonempty(live_device, ("mac_address", "mac", "macAddress"))
    )
    serial_number = (
        _pick_first_nonempty(camera_info, ("serialNumber", "serialNo", "deviceID"))
        or _pick_first_nonempty(device_info, ("serial", "serial_no", "serialNumber", "device_serial"))
        or _pick_first_nonempty(live_device, ("serial", "serial_no", "serialNumber", "device_serial"))
    )
    model = (
        _pick_first_nonempty(camera_info, ("model", "deviceName"))
        or _pick_first_nonempty(device_info, ("device_model", "model", "model_name", "product", "deviceType"))
        or _pick_first_nonempty(live_device, ("camera_model", "device_model", "model", "model_name", "product", "deviceType"))
    )
    firmware_version = (
        _pick_first_nonempty(camera_info, ("firmwareVersion", "firmwareReleasedDate"))
        or _pick_first_nonempty(device_info, ("firmware_version", "firmware"))
        or _pick_first_nonempty(live_device, ("firmware_version", "firmware"))
    )
    external_ip = (
        _pick_first_nonempty(network_info, ("ipAddress",))
        or _pick_first_nonempty(device_info, ("remote_ip", "ip"))
        or _pick_first_nonempty(live_device, ("remote_ip", "ip"))
    )
    protocol_version = (
        _pick_first_nonempty(device_info, ("isup_version", "protocol_version"))
        or _pick_first_nonempty(live_device, ("isup_version", "protocol_version"))
        or _pick_first_nonempty(camera_info, ("protocolVersion",))
    )

    return {
        "ok": True,
        "device_id": target_device_id,
        "detected": {
            "mac_address": mac_address if _is_probable_mac_address(mac_address) else (mac_address or ""),
            "serial_number": serial_number or "",
            "model": model or "",
            "firmware_version": firmware_version or "",
            "external_ip": external_ip or "",
            "protocol_version": protocol_version or "",
        },
        "camera_info": camera_info,
        "network_info": network_info,
        "device_info": device_info,
        "live_device": live_device,
        "warnings": warnings,
    }


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
