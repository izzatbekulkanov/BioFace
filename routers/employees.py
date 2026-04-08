import os
import base64
import json
import random
import re
import shutil
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from calendar import monthrange
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, Body
import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import AttendanceLog, Device, Employee, EmployeeCameraLink, EmployeePsychologicalState, EmployeeWellbeingNote, Organization, UserOrganizationLink
from .cameras import (
    _collect_camera_users,
    _download_face_to_local,
    _find_live_device_for_camera,
    _get_live_isup_map,
    _hik_decode_base64_image,
    _pick_first_nonempty,
    _resolve_online_command_target,
    _save_face_bytes_to_local,
    _send_isup_command_or_raise,
    import_camera_users_to_db,
)

UPLOAD_DIR = "static/uploads/employees"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ISUP_SNAPSHOT_INDEX_PATH = os.path.join("static", "uploads", "isup", "_employee_snapshot_index.json")

PERSONAL_ID_PATTERN = re.compile(r"^[1-9]\d{6}$")
EMPLOYEE_TYPES = {"oquvchi", "oqituvchi", "hodim"}
WELLBEING_NOTE_SOURCES = {"manual", "operator_observation", "self_report"}
PSYCHOLOGICAL_STATE_SOURCES = {"manual", "psychologist_assessment", "questionnaire", "external_system"}
PATRONYMIC_SUFFIXES = {"qizi", "qiz", "o'g'li", "ogli", "ugli", "ovna", "ovich", "evich", "yevich", "yevna"}

router = APIRouter()

_IMPORT_JOBS_LOCK = threading.Lock()
_IMPORT_JOBS: dict[str, dict[str, Any]] = {}


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _normalize_employee_type_for_import(value: Optional[str]) -> Optional[str]:
    raw = str(value or "").strip().lower()
    if not raw:
        return None
    if raw not in EMPLOYEE_TYPES:
        raise HTTPException(status_code=422, detail="Xodim turi noto'g'ri. Faqat: oquvchi, oqituvchi, hodim")
    return raw


def _resolve_allowed_org_ids(request: Request, db: Session) -> list[int]:
    auth_user = request.session.get("auth_user") or {}
    role = str(auth_user.get("role") or "").strip().lower()
    if role in {"superadmin", "super_admin"}:
        rows = db.query(Organization.id).all()
        return [int(row.id) for row in rows]

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
    return sorted(org_ids)


def _set_import_job(job_id: str, payload: dict[str, Any]) -> None:
    with _IMPORT_JOBS_LOCK:
        _IMPORT_JOBS[job_id] = payload


def _update_import_job(job_id: str, **changes: Any) -> dict[str, Any]:
    with _IMPORT_JOBS_LOCK:
        state = dict(_IMPORT_JOBS.get(job_id) or {})
        state.update(changes)
        _IMPORT_JOBS[job_id] = state
        return state


def _get_import_job(job_id: str) -> Optional[dict[str, Any]]:
    with _IMPORT_JOBS_LOCK:
        state = _IMPORT_JOBS.get(job_id)
        return dict(state) if state else None


def _normalize_personal_id(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _validate_personal_id_format(personal_id: str) -> None:
    if not PERSONAL_ID_PATTERN.fullmatch(personal_id):
        raise HTTPException(
            status_code=422,
            detail="Shaxsiy ID 7 ta raqam bo'lishi kerak va 0 bilan boshlanmasligi kerak",
        )


def _is_personal_id_taken(
    db: Session,
    personal_id: str,
    *,
    exclude_employee_id: Optional[int] = None,
) -> bool:
    query = db.query(Employee.id).filter(Employee.personal_id == personal_id)
    if exclude_employee_id is not None:
        query = query.filter(Employee.id != exclude_employee_id)
    return query.first() is not None


def _generate_unique_personal_id(db: Session, max_attempts: int = 5000) -> str:
    for _ in range(max_attempts):
        candidate = str(random.randint(1000000, 9999999))
        if not _is_personal_id_taken(db, candidate):
            return candidate
    raise HTTPException(status_code=503, detail="Unikal Shaxsiy ID generatsiya qilib bo'lmadi")


def _normalize_employee_type(value: Optional[str]) -> Optional[str]:
    raw = str(value or "").strip().lower()
    if not raw:
        return None
    if raw not in EMPLOYEE_TYPES:
        raise HTTPException(status_code=422, detail="Xodim turi noto'g'ri. Faqat: oquvchi, oqituvchi, hodim")
    return raw


def _normalize_wellbeing_note_source(value: Optional[str]) -> str:
    source = str(value or "manual").strip().lower() or "manual"
    if source not in WELLBEING_NOTE_SOURCES:
        raise HTTPException(status_code=422, detail="source noto'g'ri")
    return source


def _normalize_psychological_state_source(value: Optional[str]) -> str:
    source = str(value or "manual").strip().lower() or "manual"
    if source not in PSYCHOLOGICAL_STATE_SOURCES:
        raise HTTPException(status_code=422, detail="source noto'g'ri")
    return source


def _parse_camera_ids(raw: Optional[str]) -> list[int]:
    if raw is None:
        return []
    text = str(raw).strip()
    if not text:
        return []

    try:
        if text.startswith("["):
            payload = json.loads(text)
        else:
            payload = [x.strip() for x in text.split(",") if x.strip()]
    except Exception:
        raise HTTPException(status_code=422, detail="camera_ids formati noto'g'ri")

    if not isinstance(payload, list):
        raise HTTPException(status_code=422, detail="camera_ids ro'yxat bo'lishi kerak")

    normalized: list[int] = []
    seen: set[int] = set()
    for item in payload:
        try:
            cam_id = int(str(item).strip())
        except Exception:
            continue
        if cam_id <= 0 or cam_id in seen:
            continue
        seen.add(cam_id)
        normalized.append(cam_id)
    return normalized


def _save_employee_camera_links(
    db: Session,
    *,
    employee_id: int,
    camera_ids: list[int],
    organization_id: Optional[int],
) -> list[int]:
    db.query(EmployeeCameraLink).filter(EmployeeCameraLink.employee_id == employee_id).delete(
        synchronize_session=False
    )
    if not camera_ids:
        return []

    cameras = db.query(Device).filter(Device.id.in_(camera_ids)).all()
    camera_map = {int(c.id): c for c in cameras}
    valid_ids: list[int] = []
    for cam_id in camera_ids:
        cam = camera_map.get(cam_id)
        if cam is None:
            continue
        if organization_id is not None and cam.organization_id != organization_id:
            continue
        valid_ids.append(cam_id)

    for cam_id in valid_ids:
        db.add(EmployeeCameraLink(employee_id=employee_id, camera_id=cam_id))
    return valid_ids


def _resolve_employee_target_cameras(
    db: Session,
    *,
    employee: Employee,
    camera_id: Optional[int] = None,
    camera_ids: Optional[list[int]] = None,
) -> list[Device]:
    requested_ids = [int(cid) for cid in (camera_ids or []) if int(cid) > 0]
    if camera_id is not None and int(camera_id) > 0:
        requested_ids = [int(camera_id)] + [cid for cid in requested_ids if cid != int(camera_id)]

    if requested_ids:
        cameras = db.query(Device).filter(Device.id.in_(requested_ids)).all()
        cam_map = {int(cam.id): cam for cam in cameras}
        return [cam_map[cid] for cid in requested_ids if cid in cam_map]

    linked_camera_ids = [
        int(row.camera_id)
        for row in db.query(EmployeeCameraLink.camera_id)
        .filter(EmployeeCameraLink.employee_id == employee.id)
        .all()
        if row.camera_id is not None
    ]
    if linked_camera_ids:
        cameras = db.query(Device).filter(Device.id.in_(linked_camera_ids)).all()
        cam_map = {int(cam.id): cam for cam in cameras}
        return [cam_map[cid] for cid in linked_camera_ids if cid in cam_map]

    cams_q = db.query(Device)
    if employee.organization_id is not None:
        cams_q = cams_q.filter(Device.organization_id == employee.organization_id)
    return cams_q.order_by(Device.id.asc()).all()


def _extract_camera_face_record_media(record: dict[str, Any]) -> tuple[str, str]:
    raw_face = record.get("raw") if isinstance(record.get("raw"), dict) else {}
    face_url = str(record.get("face_url") or "").strip()
    if not face_url and isinstance(raw_face, dict):
        face_url = _pick_first_nonempty(
            raw_face,
            (
                "faceURL",
                "faceUrl",
                "pictureURL",
                "pictureUrl",
                "picUrl",
                "picURL",
                "imageURL",
                "imageUrl",
                "url",
            ),
        ) or ""

    model_data = ""
    if isinstance(raw_face, dict):
        model_data = _pick_first_nonempty(
            raw_face,
            (
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
            ),
        ) or ""
    return face_url, model_data


def _resolve_camera_http_connection(cam: Device, *, timeout: float = 8.0) -> tuple[Optional[dict[str, Any]], Optional[str]]:
    username = str(cam.username or "").strip()
    password = str(cam.password or "").strip()
    if not username or not password:
        return None, "Kamera HTTP login/paroli topilmadi"

    live_map, _ = _get_live_isup_map()
    live_info = _find_live_device_for_camera(cam, live_map) if live_map else None
    host = _pick_first_nonempty(live_info or {}, ("ip", "remote_ip", "camera_ip", "host")) or ""
    if not host:
        return None, "Kamera IP aniqlanmadi"

    raw_http_port = _pick_first_nonempty(live_info or {}, ("camera_http_port", "http_port"))
    try:
        http_port = int(str(raw_http_port).strip()) if raw_http_port is not None and str(raw_http_port).strip() else 80
    except Exception:
        http_port = 80
    if http_port <= 0:
        http_port = 80

    scheme = "http"
    if http_port == 80:
        base_url = f"{scheme}://{host}"
    else:
        base_url = f"{scheme}://{host}:{http_port}"

    return {
        "base_url": base_url,
        "username": username,
        "password": password,
        "timeout": max(2.0, min(float(timeout or 8.0), 20.0)),
    }, None


def _try_parse_json_text(text: str) -> Optional[Any]:
    raw = str(text or "").strip()
    if not raw or raw[0] not in "{[":
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def _is_image_bytes(raw: bytes) -> bool:
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


def _download_face_url_bytes_http(conn: dict[str, Any], face_url: str) -> Optional[bytes]:
    url = str(face_url or "").strip()
    if not url:
        return None
    if not re.match(r"^https?://", url, flags=re.IGNORECASE):
        if not url.startswith("/"):
            url = f"/{url}"
        url = f"{conn['base_url']}{url}"

    try:
        with httpx.Client(
            auth=httpx.DigestAuth(conn["username"], conn["password"]),
            timeout=float(conn["timeout"]),
            verify=False,
            trust_env=False,
        ) as client:
            response = client.get(url)
        if int(response.status_code) >= 400:
            return None
        raw = bytes(response.content or b"")
        if _is_image_bytes(raw):
            return raw
        return _hik_decode_base64_image(response.text)
    except Exception:
        return None


def _download_face_url_to_local_http(
    cam: Device,
    face_url: str,
    *,
    timeout: float = 8.0,
) -> tuple[Optional[str], Optional[str]]:
    raw_url = str(face_url or "").strip()
    if not raw_url:
        return None, "Face URL bo'sh"

    conn, err = _resolve_camera_http_connection(cam, timeout=timeout)
    if conn is not None:
        raw = _download_face_url_bytes_http(conn, raw_url)
        if raw is not None:
            image_url = _save_face_bytes_to_local(raw)
            if image_url:
                return image_url, None
            return None, "Kamera rasmi yuklandi, lekin local bazaga saqlab bo'lmadi"

    if re.match(r"^https?://", raw_url, flags=re.IGNORECASE):
        image_url = _download_face_to_local(
            raw_url,
            str(cam.username or ""),
            str(cam.password or ""),
        )
        if image_url:
            return image_url, None

    return None, err or "Face URL orqali rasmni yuklab bo'lmadi"


def _extract_face_image_from_http_payload(
    conn: dict[str, Any],
    payload: Any,
    text_payload: str,
    *,
    personal_id: str,
) -> tuple[Optional[bytes], Optional[str]]:
    candidates: list[dict[str, Any]] = []
    if isinstance(payload, dict):
        match_list = payload.get("MatchList")
        if isinstance(match_list, list):
            candidates.extend([x for x in match_list if isinstance(x, dict)])
        face_data_record = payload.get("FaceDataRecord")
        if isinstance(face_data_record, dict):
            candidates.append(face_data_record)
        candidates.append(payload)

    parsed_text = _try_parse_json_text(text_payload)
    if isinstance(parsed_text, dict):
        if isinstance(parsed_text.get("MatchList"), list):
            candidates.extend([x for x in parsed_text.get("MatchList", []) if isinstance(x, dict)])
        face_data_record = parsed_text.get("FaceDataRecord")
        if isinstance(face_data_record, dict):
            candidates.append(face_data_record)
        candidates.append(parsed_text)

    for item in candidates:
        fpid = str(item.get("FPID") or item.get("employeeNo") or "").strip()
        if fpid and fpid != personal_id:
            continue
        face_url = _pick_first_nonempty(
            item,
            ("faceURL", "faceUrl", "pictureURL", "pictureUrl", "picUrl", "picURL", "imageURL", "imageUrl", "url"),
        ) or ""
        raw = _download_face_url_bytes_http(conn, face_url) if face_url else None
        if raw is None:
            model_data = _pick_first_nonempty(
                item,
                ("modelData", "model_data", "faceModelData", "face_model_data", "pictureData", "picture_data", "imageData", "image_data", "faceData", "face_data", "photoData", "photo_data", "photo"),
            ) or ""
            if model_data:
                raw = _hik_decode_base64_image(model_data)
        if raw is None and text_payload:
            raw = _hik_decode_base64_image(text_payload)
        if raw is not None:
            source = "camera_http_face_url" if face_url else "camera_http_model_data"
            return raw, source
    return None, None


def _fetch_face_image_via_camera_http(
    cam: Device,
    personal_id: str,
    *,
    timeout: float = 8.0,
) -> tuple[Optional[bytes], Optional[str], Optional[str]]:
    conn, err = _resolve_camera_http_connection(cam, timeout=timeout)
    if conn is None:
        return None, err, None

    attempts = [
        (
            "/ISAPI/Intelligent/FDLib/FDSearch?format=json",
            {
                "faceLibType": "blackFD",
                "FDID": "1",
                "FPID": personal_id,
                "searchResultPosition": 0,
                "maxResults": 1,
            },
        ),
        (
            "/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json",
            {
                "FaceDataRecord": {
                    "faceLibType": "blackFD",
                    "FDID": "1",
                    "FPID": personal_id,
                }
            },
        ),
        (
            "/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json",
            {
                "faceLibType": "blackFD",
                "FDID": "1",
                "FPID": personal_id,
            },
        ),
    ]

    errors: list[str] = []
    for path, body in attempts:
        try:
            with httpx.Client(
                auth=httpx.DigestAuth(conn["username"], conn["password"]),
                timeout=float(conn["timeout"]),
                verify=False,
                trust_env=False,
            ) as client:
                response = client.post(f"{conn['base_url']}{path}", json=body)
            text_payload = str(response.text or "")
            parsed_payload = None
            try:
                parsed_payload = response.json()
            except Exception:
                parsed_payload = _try_parse_json_text(text_payload)

            raw, source = _extract_face_image_from_http_payload(
                conn,
                parsed_payload,
                text_payload,
                personal_id=personal_id,
            )
            if raw is not None:
                return raw, None, source
            errors.append(f"{path}: rasm topilmadi")
        except Exception as exc:
            errors.append(f"{path}: {exc}")

    return None, "; ".join(errors) if errors else "Kamera HTTP qidiruvida rasm topilmadi", None


def _fetch_isup_face_image_bytes(
    target_id: str,
    personal_id: str,
    *,
    allow_http_fallback: bool = False,
    timeout: float = 15.0,
) -> tuple[Optional[bytes], Optional[str]]:
    try:
        payload = _send_isup_command_or_raise(
            target_id,
            "get_face_image",
            {
                "personal_id": personal_id,
                "allow_http_fallback": bool(allow_http_fallback),
            },
            timeout=timeout,
        )
    except HTTPException as exc:
        return None, str(exc.detail)

    image_b64 = str(payload.get("image_b64") or "").strip() if isinstance(payload, dict) else ""
    if not image_b64:
        return None, "get_face_image javobida rasm topilmadi"

    try:
        raw = base64.b64decode(image_b64, validate=False)
    except Exception:
        raw = b""
    if not raw:
        return None, "get_face_image javobidagi rasmni o'qib bo'lmadi"
    return raw, None


def _inspect_employee_face_on_camera(
    cam: Device,
    *,
    personal_id: str,
    allow_camera_http_download: bool = True,
    import_image: bool = False,
    quick_probe: bool = False,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "camera_id": int(cam.id),
        "camera_name": str(cam.name or ""),
        "status": "unknown",
        "has_face_record": False,
        "has_face_image": False,
        "can_sync_image": False,
        "image_source": None,
    }

    try:
        target_id, _, _ = _resolve_online_command_target(cam)
        result["target_device_id"] = str(target_id)
    except HTTPException as exc:
        result["status"] = "camera_unavailable"
        result["error"] = str(exc.detail)
        return result

    exact_bytes = None
    exact_error = None
    exact_source = None
    if allow_camera_http_download:
        exact_bytes, exact_error, exact_source = _fetch_face_image_via_camera_http(
            cam,
            personal_id,
            timeout=4.0 if quick_probe else 8.0,
        )
    if exact_bytes is None:
        exact_bytes, exact_error = _fetch_isup_face_image_bytes(
            str(result["target_device_id"]),
            personal_id,
            allow_http_fallback=allow_camera_http_download,
            timeout=2.5 if quick_probe else 15.0,
        )
        exact_source = "get_face_image" if exact_bytes else exact_source
    if exact_bytes:
        result.update(
            {
                "status": "face_found",
                "has_face_record": True,
                "has_face_image": True,
                "can_sync_image": True,
                "image_source": exact_source or "get_face_image",
            }
        )
        if import_image:
            image_url = _save_face_bytes_to_local(exact_bytes)
            if image_url:
                result["status"] = "imported"
                result["imported"] = True
                result["image_url"] = image_url
        return result

    if quick_probe:
        error_text = str(exact_error or "").strip().lower()
        if "rasm topilmadi" in error_text or "url/blob qaytarmadi" in error_text:
            result["status"] = "not_found"
        elif "javobi kelmadi" in error_text:
            result["status"] = "probe_timeout"
        else:
            result["status"] = "face_check_failed"
        result["error"] = exact_error or "ISUP tezkor tekshiruvi rasm topmadi"
        return result

    try:
        face_resp = _send_isup_command_or_raise(
            str(result["target_device_id"]),
            "get_face_records",
            {"all": True, "limit": 1200},
            timeout=20.0,
        )
    except HTTPException as exc:
        result["status"] = "face_check_failed"
        result["error"] = exact_error or str(exc.detail)
        return result

    records = face_resp.get("records", []) if isinstance(face_resp, dict) else []
    if not isinstance(records, list):
        records = []

    target_record = None
    for row in records:
        if not isinstance(row, dict):
            continue
        if str(row.get("fpid") or "").strip() == personal_id:
            target_record = row
            break

    if not isinstance(target_record, dict):
        result["status"] = "not_found"
        result["error"] = exact_error or "Face record topilmadi"
        return result

    face_url, model_data = _extract_camera_face_record_media(target_record)
    result["has_face_record"] = True

    model_image = _hik_decode_base64_image(model_data) if model_data else None
    if face_url:
        result["has_face_image"] = True
        result["image_source"] = "face_url"
        result["can_sync_image"] = bool(allow_camera_http_download and cam.username and cam.password)
    elif model_image:
        result["has_face_image"] = True
        result["image_source"] = "model_data"
        result["can_sync_image"] = True

    if import_image:
        imported_image_url = None
        download_error = None
        if face_url and allow_camera_http_download and cam.username and cam.password:
            imported_image_url, download_error = _download_face_url_to_local_http(
                cam,
                face_url,
                timeout=8.0,
            )
        if imported_image_url is None and model_image is not None:
            imported_image_url = _save_face_bytes_to_local(model_image)
            if imported_image_url is None and download_error is None:
                download_error = "Face model data topildi, lekin local bazaga saqlab bo'lmadi"
        if imported_image_url:
            result["status"] = "imported"
            result["imported"] = True
            result["image_url"] = imported_image_url
            result["has_face_image"] = True
            result["can_sync_image"] = True
            return result
        if download_error:
            result["error"] = download_error

    if result["has_face_image"]:
        result["status"] = "face_found"
    else:
        result["status"] = "face_record_found"
        result["error"] = exact_error or "Face record bor, lekin rasm olinmadi"

    return result


def _build_employee_face_status_payload(
    employee: Employee,
    *,
    attempts: list[dict[str, Any]],
) -> dict[str, Any]:
    local_image_exists = bool(str(employee.image_url or "").strip())
    best_sync = next((item for item in attempts if item.get("can_sync_image")), None)
    best_face = best_sync or next(
        (item for item in attempts if item.get("has_face_record") or item.get("has_face_image")),
        None,
    )
    return {
        "ok": True,
        "employee_id": int(employee.id),
        "personal_id": str(employee.personal_id or "").strip(),
        "local_image_exists": local_image_exists,
        "local_image_url": str(employee.image_url or ""),
        "camera_face_found": any(bool(item.get("has_face_record") or item.get("has_face_image")) for item in attempts),
        "camera_sync_available": any(bool(item.get("can_sync_image")) for item in attempts),
        "best_camera_id": int(best_face["camera_id"]) if best_face and best_face.get("camera_id") is not None else None,
        "best_camera_name": str(best_face.get("camera_name") or "") if best_face else "",
        "best_sync_camera_id": int(best_sync["camera_id"]) if best_sync and best_sync.get("camera_id") is not None else None,
        "best_sync_camera_name": str(best_sync.get("camera_name") or "") if best_sync else "",
        "attempts": attempts,
    }


def _load_isup_snapshot_index() -> dict[str, Any]:
    path = str(ISUP_SNAPSHOT_INDEX_PATH or "").strip()
    if not path or not os.path.isfile(path):
        return {"by_personal_id": {}, "by_employee_id": {}}
    try:
        with open(path, "r", encoding="utf-8") as src:
            payload = json.load(src)
    except Exception:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}
    by_personal_id = payload.get("by_personal_id")
    by_employee_id = payload.get("by_employee_id")
    if not isinstance(by_personal_id, dict):
        by_personal_id = {}
    if not isinstance(by_employee_id, dict):
        by_employee_id = {}
    return {
        "by_personal_id": by_personal_id,
        "by_employee_id": by_employee_id,
    }


def _snapshot_candidate_sort_key(candidate: dict[str, Any], camera: Optional[Device]) -> tuple[int, float]:
    device_match = 0
    candidate_device_id = candidate.get("device_id")
    try:
        if camera is not None and candidate_device_id is not None and int(candidate_device_id) == int(camera.id):
            device_match = 1
    except Exception:
        device_match = 0

    stamp = str(candidate.get("updated_at") or candidate.get("timestamp") or "").strip()
    ts_value = 0.0
    if stamp:
        normalized = stamp.replace("Z", "+00:00")
        try:
            ts_value = datetime.fromisoformat(normalized).timestamp()
        except Exception:
            ts_value = 0.0
    return device_match, ts_value


def _find_employee_snapshot_candidate(
    db: Session,
    *,
    employee: Employee,
    camera: Device,
    personal_id: str,
) -> Optional[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    index_payload = _load_isup_snapshot_index()

    personal_key = str(personal_id or "").strip()
    if personal_key:
        indexed = index_payload.get("by_personal_id", {}).get(personal_key)
        if isinstance(indexed, dict) and str(indexed.get("snapshot_url") or "").strip():
            candidates.append(
                {
                    **indexed,
                    "source": "ss_snapshot_cache",
                }
            )

    employee_key = str(getattr(employee, "id", "") or "").strip()
    if employee_key:
        indexed = index_payload.get("by_employee_id", {}).get(employee_key)
        if isinstance(indexed, dict) and str(indexed.get("snapshot_url") or "").strip():
            candidates.append(
                {
                    **indexed,
                    "source": "ss_snapshot_cache",
                }
            )

    base_query = db.query(AttendanceLog).filter(
        AttendanceLog.snapshot_url.isnot(None),
        AttendanceLog.snapshot_url != "",
    )

    candidate_log = (
        base_query.filter(
            AttendanceLog.device_id == int(camera.id),
            AttendanceLog.person_id == personal_id,
        )
        .order_by(AttendanceLog.timestamp.desc(), AttendanceLog.id.desc())
        .first()
    )
    if candidate_log is None:
        candidate_log = (
            base_query.filter(AttendanceLog.person_id == personal_id)
            .order_by(AttendanceLog.timestamp.desc(), AttendanceLog.id.desc())
            .first()
        )
    if candidate_log is None and employee.id is not None:
        candidate_log = (
            base_query.filter(
                AttendanceLog.device_id == int(camera.id),
                AttendanceLog.employee_id == int(employee.id),
            )
            .order_by(AttendanceLog.timestamp.desc(), AttendanceLog.id.desc())
            .first()
        )
    if candidate_log is None and employee.id is not None:
        candidate_log = (
            base_query.filter(AttendanceLog.employee_id == int(employee.id))
            .order_by(AttendanceLog.timestamp.desc(), AttendanceLog.id.desc())
            .first()
        )

    if candidate_log is not None:
        candidates.append(
            {
                "snapshot_url": str(candidate_log.snapshot_url or "").strip(),
                "log_id": int(candidate_log.id),
                "employee_id": int(candidate_log.employee_id) if candidate_log.employee_id is not None else None,
                "personal_id": str(candidate_log.person_id or "").strip() or None,
                "device_id": int(candidate_log.device_id) if candidate_log.device_id is not None else None,
                "camera_mac": str(candidate_log.camera_mac or "").strip() or None,
                "timestamp": candidate_log.timestamp.isoformat() if candidate_log.timestamp else None,
                "source": "attendance_snapshot",
            }
        )

    valid_candidates = [item for item in candidates if str(item.get("snapshot_url") or "").strip()]
    if not valid_candidates:
        return None

    valid_candidates.sort(key=lambda item: _snapshot_candidate_sort_key(item, camera), reverse=True)
    return valid_candidates[0]


def _load_snapshot_bytes(snapshot_url: str, *, timeout: float = 8.0) -> tuple[Optional[bytes], Optional[str]]:
    url = str(snapshot_url or "").strip()
    if not url:
        return None, "Snapshot URL bo'sh"

    if re.match(r"^https?://", url, flags=re.IGNORECASE):
        try:
            with httpx.Client(
                timeout=max(2.0, min(float(timeout or 8.0), 20.0)),
                verify=False,
                trust_env=False,
            ) as client:
                response = client.get(url)
            if int(response.status_code) >= 400:
                return None, f"Snapshot URL {response.status_code} qaytardi"
            raw = bytes(response.content or b"")
            if _is_image_bytes(raw):
                return raw, None
            decoded = _hik_decode_base64_image(response.text)
            if decoded is not None:
                return decoded, None
            return None, "Snapshot URL rasm qaytarmadi"
        except Exception as exc:
            return None, f"Snapshot URL xatosi: {exc}"

    rel_path = url.lstrip("/\\")
    if not rel_path:
        return None, "Snapshot fayl yo'li noto'g'ri"

    abs_path = rel_path
    if not os.path.isabs(abs_path):
        abs_path = os.path.join(os.getcwd(), rel_path)
    if not os.path.isfile(abs_path):
        return None, "Snapshot fayli topilmadi"

    try:
        with open(abs_path, "rb") as src:
            raw = src.read()
        if _is_image_bytes(raw):
            return raw, None
        decoded = _hik_decode_base64_image(raw.decode("utf-8", errors="ignore"))
        if decoded is not None:
            return decoded, None
        return None, "Snapshot fayli rasm emas"
    except Exception as exc:
        return None, f"Snapshot faylini o'qib bo'lmadi: {exc}"


def _import_employee_snapshot_fallback(
    db: Session,
    *,
    employee: Employee,
    camera: Device,
    personal_id: str,
) -> tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    if db is None:
        return None, None, None, "DB mavjud emas"

    candidate = _find_employee_snapshot_candidate(
        db,
        employee=employee,
        camera=camera,
        personal_id=personal_id,
    )
    if not isinstance(candidate, dict):
        return None, None, None, "Snapshot cache topilmadi"

    snapshot_url = str(candidate.get("snapshot_url") or "").strip()
    source = str(candidate.get("source") or "attendance_snapshot").strip() or "attendance_snapshot"
    raw, err = _load_snapshot_bytes(snapshot_url)
    if raw is None:
        return None, snapshot_url, source, err or "Snapshot o'qilmadi"

    image_url = _save_face_bytes_to_local(raw)
    if not image_url:
        return None, snapshot_url, source, "Snapshot local rasmga saqlanmadi"

    return image_url, snapshot_url, source, None


def _run_employee_face_job(
    *,
    job_id: str,
    employee_id: int,
    camera_ids: list[int],
    allow_camera_http_download: bool,
    import_image: bool,
) -> None:
    from database import SessionLocal

    db = SessionLocal()
    try:
        emp = db.query(Employee).filter(Employee.id == int(employee_id)).first()
        if not emp:
            _update_import_job(job_id, status="error", error="Xodim topilmadi", finished_at=_now_iso())
            return

        personal_id = str(emp.personal_id or "").strip()
        if not personal_id:
            _update_import_job(
                job_id,
                status="error",
                error="Xodimda personal_id yo'q",
                finished_at=_now_iso(),
            )
            return

        cameras = _resolve_employee_target_cameras(
            db,
            employee=emp,
            camera_ids=camera_ids,
        )
        if not cameras:
            _update_import_job(
                job_id,
                status="error",
                error="Xodimga mos kamera topilmadi",
                finished_at=_now_iso(),
            )
            return

        total = len(cameras)
        _update_import_job(
            job_id,
            status="running",
            started_at=_now_iso(),
            total_cameras=total,
            processed_cameras=0,
            progress_percent=0,
            heartbeat_at=_now_iso(),
        )

        attempts: list[dict[str, Any]] = []
        imported_image_url = ""
        for idx, cam in enumerate(cameras, start=1):
            attempt = _inspect_employee_face_on_camera(
                cam,
                personal_id=personal_id,
                allow_camera_http_download=allow_camera_http_download,
                import_image=import_image,
                quick_probe=False,
            )
            image_url = str(attempt.get("image_url") or "").strip()
            attempts.append(attempt)

            if import_image and image_url:
                emp.image_url = image_url
                db.commit()
                imported_image_url = image_url

            _update_import_job(
                job_id,
                processed_cameras=idx,
                progress_percent=int((idx / max(1, total)) * 100),
                attempts=attempts,
                heartbeat_at=_now_iso(),
            )

            if import_image and imported_image_url:
                break

        db.refresh(emp)
        result = _build_employee_face_status_payload(emp, attempts=attempts)
        if import_image:
            if imported_image_url:
                result["message"] = "Xodim rasmi kameradagi foydalanuvchi bazasidan sync qilindi va local bazaga saqlandi"
                result["image_url"] = imported_image_url
            else:
                result["message"] = "Xodim rasmi kameradagi foydalanuvchi bazasidan olinmadi"
        else:
            result["message"] = (
                "Kamera bazasida rasm topildi."
                if result.get("camera_face_found")
                else "Kamera bazasida rasm topilmadi."
            )

        _update_import_job(
            job_id,
            status="done",
            progress_percent=100,
            finished_at=_now_iso(),
            result=result,
            attempts=attempts,
        )
    except Exception as exc:
        _update_import_job(job_id, status="error", error=str(exc), finished_at=_now_iso())
    finally:
        db.close()


def _parse_hhmm(value: Optional[str], default_h: int = 9, default_m: int = 0) -> tuple[int, int]:
    text = str(value or "").strip()
    if not text:
        return default_h, default_m
    parts = text.split(":")
    if len(parts) < 2:
        return default_h, default_m
    try:
        return int(parts[0]), int(parts[1])
    except Exception:
        return default_h, default_m


def _format_duration_human(total_minutes: int) -> str:
    safe = max(0, int(total_minutes or 0))
    hh, mm = divmod(safe, 60)
    if hh > 0:
        return f"{hh} soat {mm} daqiqa"
    return f"{mm} daqiqa"


def _format_duration_hms(total_seconds: int) -> str:
    safe = max(0, int(total_seconds or 0))
    hh, rem = divmod(safe, 3600)
    mm, ss = divmod(rem, 60)
    if hh > 0:
        if ss > 0:
            return f"{hh} soat {mm} daqiqa {ss} soniya"
        return f"{hh} soat {mm} daqiqa"
    if mm > 0:
        if ss > 0:
            return f"{mm} daqiqa {ss} soniya"
        return f"{mm} daqiqa"
    return f"{ss} soniya"


def _looks_like_surname(token: str) -> bool:
    value = str(token or "").strip().lower()
    return bool(value) and value.endswith(("ov", "ova", "ev", "eva", "yev", "yeva"))


def _split_import_person_name(full_name: Optional[str], fallback_personal_id: str) -> tuple[str, str, str]:
    text = str(full_name or "").strip()
    if not text:
        return "Foydalanuvchi", fallback_personal_id, ""

    parts = [p.strip() for p in text.split() if p.strip()]
    if len(parts) == 1:
        return parts[0], fallback_personal_id, ""

    has_patronymic = str(parts[-1]).lower() in PATRONYMIC_SUFFIXES
    if len(parts) >= 3 or has_patronymic:
        # Attendance source usually sends: FAMILIYA ISM OTASINING_ISMI
        last_name = parts[0]
        first_name = parts[1]
        middle_name = " ".join(parts[2:])
        return first_name or "Foydalanuvchi", last_name or fallback_personal_id, middle_name

    if len(parts) == 2 and _looks_like_surname(parts[0]):
        return parts[1], parts[0], ""

    return parts[0], parts[1], ""


@router.get("/api/employees")
def get_employees(request: Request, db: Session = Depends(get_db)):
    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    if not allowed_org_ids:
        return []

    employees = db.query(Employee).filter(Employee.organization_id.in_(allowed_org_ids)).order_by(Employee.id.desc()).all()
    employee_ids = [int(e.id) for e in employees]
    links = (
        db.query(EmployeeCameraLink.employee_id, EmployeeCameraLink.camera_id)
        .filter(EmployeeCameraLink.employee_id.in_(employee_ids))
        .all()
        if employee_ids
        else []
    )
    org_rows = db.query(Organization.id, Organization.name).filter(Organization.id.in_(allowed_org_ids)).all()
    cam_rows = db.query(Device.id, Device.name).filter(Device.organization_id.in_(allowed_org_ids)).all()
    org_map = {int(row[0]): str(row[1]) for row in org_rows}
    cam_map = {int(row[0]): str(row[1]) for row in cam_rows}
    camera_map: dict[int, list[int]] = {}
    for emp_id, cam_id in links:
        key = int(emp_id)
        camera_map.setdefault(key, []).append(int(cam_id))
    return [
        {
            "id": e.id,
            "personal_id": e.personal_id,
            "full_name": " ".join([x for x in [e.first_name, e.last_name, e.middle_name] if x]),
            "first_name": e.first_name,
            "last_name": e.last_name,
            "middle_name": e.middle_name,
            "department": e.department,
            "position": e.position,
            "employee_type": e.employee_type,
            "status": "Faol" if e.has_access else "Ruxsat yo'q",
            "added_date": e.created_at.strftime("%Y-%m-%d") if e.created_at else "",
            "start_time": e.start_time,
            "end_time": e.end_time,
            "avatar": e.image_url or "",
            "organization_id": e.organization_id,
            "organization_name": org_map.get(int(e.organization_id)) if e.organization_id is not None else None,
            "camera_ids": camera_map.get(int(e.id), []),
            "camera_names": [
                cam_map[cam_id]
                for cam_id in camera_map.get(int(e.id), [])
                if cam_id in cam_map
            ],
        }
        for e in employees
    ]


@router.get("/api/employees/import/sources")
def get_employees_import_sources(
    request: Request,
    organization_id: Optional[int] = Query(None),
    limit_per_camera: int = Query(1200, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    if not allowed_org_ids:
        return {"ok": True, "organizations": []}

    org_query = db.query(Organization).filter(Organization.id.in_(allowed_org_ids))
    if organization_id is not None:
        org_query = org_query.filter(Organization.id == int(organization_id))
    orgs = org_query.order_by(Organization.name.asc()).all()

    payload_orgs: list[dict[str, Any]] = []
    for org in orgs:
        cameras = (
            db.query(Device)
            .filter(Device.organization_id == org.id)
            .order_by(Device.name.asc())
            .all()
        )
        cam_rows: list[dict[str, Any]] = []
        for cam in cameras:
            count = 0
            unsupported = False
            error_msg = None
            try:
                target_id, _, _ = _resolve_online_command_target(cam)
                users = _collect_camera_users(target_id, limit=limit_per_camera)
                count = len(users)
            except HTTPException as exc:
                txt = str(exc.detail or "")
                unsupported = "notsupport" in txt.lower()
                error_msg = txt

            cam_rows.append(
                {
                    "id": int(cam.id),
                    "name": str(cam.name or f"Kamera #{cam.id}"),
                    "organization_id": int(org.id),
                    "organization_name": str(org.name or ""),
                    "user_count": int(count),
                    "unsupported": bool(unsupported),
                    "error": error_msg,
                }
            )

        payload_orgs.append(
            {
                "id": int(org.id),
                "name": str(org.name or ""),
                "camera_count": len(cam_rows),
                "cameras": cam_rows,
            }
        )

    return {"ok": True, "organizations": payload_orgs}


def _run_employees_import_job(
    *,
    job_id: str,
    camera_ids: list[int],
    employee_type: Optional[str],
):
    from database import SessionLocal

    db = SessionLocal()
    try:
        total = len(camera_ids)
        _update_import_job(job_id, status="running", total_cameras=total, started_at=_now_iso())

        summary = {
            "created": 0,
            "updated": 0,
            "linked_to_camera": 0,
            "skipped": 0,
            "imported_users_total": 0,
        }
        per_camera: list[dict[str, Any]] = []

        for idx, cam_id in enumerate(camera_ids, start=1):
            _update_import_job(
                job_id,
                current_camera_id=int(cam_id),
                processed_cameras=idx - 1,
                progress_percent=int(((idx - 1) / max(1, total)) * 100),
                heartbeat_at=_now_iso(),
            )
            try:
                result = import_camera_users_to_db(
                    cam_id=int(cam_id),
                    limit=2000,
                    allow_camera_http_download=False,
                    face_import_mode="off",
                    employee_type=employee_type,
                    db=db,
                )
                cam_info = {
                    "camera_id": int(cam_id),
                    "camera_name": str(result.get("camera_name") or f"Kamera #{cam_id}"),
                    "ok": bool(result.get("ok", True)),
                    "created": int(result.get("created") or 0),
                    "updated": int(result.get("updated") or 0),
                    "linked_to_camera": int(result.get("linked_to_camera") or 0),
                    "skipped": int(result.get("skipped") or 0),
                    "imported_users_total": int(result.get("imported_users_total") or 0),
                    "message": str(result.get("message") or ""),
                }
                per_camera.append(cam_info)
                for key in summary:
                    summary[key] += int(cam_info.get(key) or 0)
            except Exception as exc:
                per_camera.append(
                    {
                        "camera_id": int(cam_id),
                        "camera_name": f"Kamera #{cam_id}",
                        "ok": False,
                        "created": 0,
                        "updated": 0,
                        "linked_to_camera": 0,
                        "skipped": 0,
                        "imported_users_total": 0,
                        "message": str(exc),
                    }
                )

            _update_import_job(
                job_id,
                processed_cameras=idx,
                progress_percent=int((idx / max(1, total)) * 100),
                summary=summary,
                per_camera=per_camera,
                heartbeat_at=_now_iso(),
            )

        _update_import_job(
            job_id,
            status="done",
            progress_percent=100,
            finished_at=_now_iso(),
            summary=summary,
            per_camera=per_camera,
        )
    except Exception as exc:
        _update_import_job(job_id, status="error", error=str(exc), finished_at=_now_iso())
    finally:
        db.close()


@router.post("/api/employees/import/start")
def start_employees_import_job(
    request: Request,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    camera_ids_raw = payload.get("camera_ids") if isinstance(payload, dict) else []
    employee_type = _normalize_employee_type_for_import(payload.get("employee_type") if isinstance(payload, dict) else None)
    if not isinstance(camera_ids_raw, list):
        raise HTTPException(status_code=422, detail="camera_ids ro'yxat bo'lishi kerak")
    camera_ids = []
    for cam_id in camera_ids_raw:
        try:
            val = int(cam_id)
        except Exception:
            continue
        if val > 0 and val not in camera_ids:
            camera_ids.append(val)
    if not camera_ids:
        raise HTTPException(status_code=422, detail="Kamida bitta kamera tanlang")

    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    cams = db.query(Device.id, Device.organization_id).filter(Device.id.in_(camera_ids)).all()
    cam_map = {int(row.id): (int(row.organization_id) if row.organization_id is not None else None) for row in cams}
    valid_camera_ids = [cid for cid in camera_ids if cid in cam_map and cam_map[cid] in allowed_org_ids]
    if not valid_camera_ids:
        raise HTTPException(status_code=403, detail="Tanlangan kameralar uchun ruxsat yo'q")

    job_id = uuid.uuid4().hex
    _set_import_job(
        job_id,
        {
            "job_id": job_id,
            "status": "queued",
            "created_at": _now_iso(),
            "processed_cameras": 0,
            "total_cameras": len(valid_camera_ids),
            "progress_percent": 0,
            "current_camera_id": None,
            "summary": {
                "created": 0,
                "updated": 0,
                "linked_to_camera": 0,
                "skipped": 0,
                "imported_users_total": 0,
            },
            "per_camera": [],
            "employee_type": employee_type,
        },
    )

    thread = threading.Thread(
        target=_run_employees_import_job,
        kwargs={
            "job_id": job_id,
            "camera_ids": valid_camera_ids,
            "employee_type": employee_type,
        },
        daemon=True,
        name=f"employees-import-{job_id[:8]}",
    )
    thread.start()

    return {
        "ok": True,
        "job_id": job_id,
        "message": "Import jarayoni boshlandi",
    }


@router.get("/api/employees/import/status")
def get_employees_import_status(job_id: str):
    state = _get_import_job(str(job_id or "").strip())
    if not state:
        raise HTTPException(status_code=404, detail="Import job topilmadi")
    return {"ok": True, **state}


def _import_from_attendance_core(
    db: Session,
    *,
    allowed_org_ids: list[int],
    org_id_int: Optional[int],
    cam_id_int: Optional[int],
    employee_type: Optional[str],
    limit: int,
    progress_cb: Optional[Any] = None,
) -> dict[str, Any]:
    logs_query = (
        db.query(AttendanceLog)
        .outerjoin(AttendanceLog.device)
        .filter(
            AttendanceLog.person_id.isnot(None),
            func.trim(AttendanceLog.person_id) != "",
            Device.organization_id.in_(allowed_org_ids),
        )
    )
    if org_id_int is not None:
        logs_query = logs_query.filter(Device.organization_id == org_id_int)
    if cam_id_int is not None:
        logs_query = logs_query.filter(AttendanceLog.device_id == cam_id_int)

    logs = logs_query.order_by(AttendanceLog.timestamp.desc(), AttendanceLog.id.desc()).limit(limit).all()
    grouped: dict[str, dict[str, Any]] = {}
    for log in logs:
        pid = str(log.person_id or "").strip()
        if not pid:
            continue
        entry = grouped.setdefault(
            pid,
            {
                "name": str(log.person_name or "").strip(),
                "camera_ids": set(),
                "organization_id": log.device.organization_id if log.device else None,
                "log_ids": [],
            },
        )
        if not entry["name"] and log.person_name:
            entry["name"] = str(log.person_name)
        if entry["organization_id"] is None and log.device and log.device.organization_id is not None:
            entry["organization_id"] = log.device.organization_id
        if log.device_id is not None:
            entry["camera_ids"].add(int(log.device_id))
        entry["log_ids"].append(int(log.id))

    created = 0
    updated = 0
    linked_to_camera = 0
    logs_bound = 0
    total_users = len(grouped)

    for idx, (personal_id, info) in enumerate(grouped.items(), start=1):
        first_name, last_name, middle_name = _split_import_person_name(info.get("name"), personal_id)
        emp = db.query(Employee).filter(Employee.personal_id == personal_id).first()
        if emp is None:
            emp = Employee(
                first_name=first_name,
                last_name=last_name,
                middle_name=middle_name,
                personal_id=personal_id,
                employee_type=employee_type,
                has_access=True,
                organization_id=info.get("organization_id"),
            )
            db.add(emp)
            db.flush()
            created += 1
        else:
            changed = False
            if first_name and emp.first_name != first_name:
                emp.first_name = first_name
                changed = True
            if last_name and emp.last_name != last_name:
                emp.last_name = last_name
                changed = True
            if middle_name and emp.middle_name != middle_name:
                emp.middle_name = middle_name
                changed = True
            if employee_type is not None and emp.employee_type != employee_type:
                emp.employee_type = employee_type
                changed = True
            if emp.organization_id is None and info.get("organization_id") is not None:
                emp.organization_id = info.get("organization_id")
                changed = True
            if changed:
                updated += 1

        for cam_id in sorted(list(info.get("camera_ids") or [])):
            exists = (
                db.query(EmployeeCameraLink.id)
                .filter(EmployeeCameraLink.employee_id == int(emp.id), EmployeeCameraLink.camera_id == int(cam_id))
                .first()
            )
            if not exists:
                db.add(EmployeeCameraLink(employee_id=int(emp.id), camera_id=int(cam_id)))
                linked_to_camera += 1

        if info.get("log_ids"):
            updated_rows = (
                db.query(AttendanceLog)
                .filter(AttendanceLog.id.in_(info["log_ids"]), AttendanceLog.employee_id.is_(None))
                .update({AttendanceLog.employee_id: int(emp.id)}, synchronize_session=False)
            )
            logs_bound += int(updated_rows or 0)

        if callable(progress_cb):
            progress_cb(idx, total_users, personal_id)

    db.commit()
    return {
        "created": created,
        "updated": updated,
        "linked_to_camera": linked_to_camera,
        "logs_bound": logs_bound,
        "processed_users": total_users,
    }


def _run_attendance_import_job(
    *,
    job_id: str,
    allowed_org_ids: list[int],
    org_id_int: Optional[int],
    cam_id_int: Optional[int],
    employee_type: Optional[str],
    limit: int,
):
    from database import SessionLocal

    db = SessionLocal()
    try:
        _update_import_job(job_id, status="running", started_at=_now_iso(), heartbeat_at=_now_iso())

        def _progress(done: int, total: int, current_personal_id: str) -> None:
            _update_import_job(
                job_id,
                processed_items=int(done),
                total_items=int(total),
                current_personal_id=str(current_personal_id or ""),
                progress_percent=int((int(done) / max(1, int(total))) * 100),
                heartbeat_at=_now_iso(),
            )

        result = _import_from_attendance_core(
            db,
            allowed_org_ids=allowed_org_ids,
            org_id_int=org_id_int,
            cam_id_int=cam_id_int,
            employee_type=employee_type,
            limit=limit,
            progress_cb=_progress,
        )
        _update_import_job(
            job_id,
            status="done",
            progress_percent=100,
            finished_at=_now_iso(),
            summary=result,
            processed_items=int(result.get("processed_users") or 0),
            total_items=int(result.get("processed_users") or 0),
        )
    except Exception as exc:
        _update_import_job(job_id, status="error", error=str(exc), finished_at=_now_iso())
    finally:
        db.close()


@router.post("/api/employees/import/from-attendance/start")
def start_import_from_attendance_job(
    request: Request,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
):
    data = payload if isinstance(payload, dict) else {}
    organization_id = data.get("organization_id")
    camera_id = data.get("camera_id")
    employee_type = _normalize_employee_type_for_import(data.get("employee_type"))
    limit = int(data.get("limit") or 5000)
    limit = max(1, min(limit, 50000))

    try:
        org_id_int = int(organization_id) if organization_id is not None else None
    except Exception:
        raise HTTPException(status_code=422, detail="organization_id noto'g'ri")
    try:
        cam_id_int = int(camera_id) if camera_id is not None else None
    except Exception:
        raise HTTPException(status_code=422, detail="camera_id noto'g'ri")

    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    if not allowed_org_ids:
        raise HTTPException(status_code=403, detail="Import uchun ruxsatli tashkilot topilmadi")
    if org_id_int is not None and org_id_int not in allowed_org_ids:
        raise HTTPException(status_code=403, detail="Tashkilot uchun ruxsat yo'q")
    if cam_id_int is not None:
        cam = db.query(Device.id, Device.organization_id).filter(Device.id == cam_id_int).first()
        if not cam:
            raise HTTPException(status_code=404, detail="Kamera topilmadi")
        if cam.organization_id not in allowed_org_ids:
            raise HTTPException(status_code=403, detail="Kamera uchun ruxsat yo'q")

    job_id = uuid.uuid4().hex
    _set_import_job(
        job_id,
        {
            "job_id": job_id,
            "kind": "attendance_import",
            "status": "queued",
            "created_at": _now_iso(),
            "progress_percent": 0,
            "processed_items": 0,
            "total_items": 0,
            "current_personal_id": "",
            "summary": {
                "created": 0,
                "updated": 0,
                "linked_to_camera": 0,
                "logs_bound": 0,
                "processed_users": 0,
            },
        },
    )

    thread = threading.Thread(
        target=_run_attendance_import_job,
        kwargs={
            "job_id": job_id,
            "allowed_org_ids": allowed_org_ids,
            "org_id_int": org_id_int,
            "cam_id_int": cam_id_int,
            "employee_type": employee_type,
            "limit": limit,
        },
        daemon=True,
        name=f"attendance-import-{job_id[:8]}",
    )
    thread.start()

    return {
        "ok": True,
        "job_id": job_id,
        "message": "Davomatdan import jarayoni boshlandi",
    }


@router.get("/api/employees/import/from-attendance/sources")
def get_attendance_import_sources(
    request: Request,
    db: Session = Depends(get_db),
):
    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    if not allowed_org_ids:
        return {"ok": True, "organizations": []}

    grouped_rows = (
        db.query(
            Device.organization_id.label("org_id"),
            Device.id.label("camera_id"),
            Device.name.label("camera_name"),
            func.count(func.distinct(func.trim(AttendanceLog.person_id))).label("users_count"),
        )
        .join(Device, Device.id == AttendanceLog.device_id)
        .filter(
            Device.organization_id.in_(allowed_org_ids),
            AttendanceLog.person_id.isnot(None),
            func.trim(AttendanceLog.person_id) != "",
        )
        .group_by(Device.organization_id, Device.id, Device.name)
        .order_by(Device.organization_id.asc(), Device.name.asc())
        .all()
    )

    org_names = {
        int(row.id): str(row.name or "")
        for row in db.query(Organization.id, Organization.name)
        .filter(Organization.id.in_(allowed_org_ids))
        .all()
    }

    org_map: dict[int, dict[str, Any]] = {}
    for row in grouped_rows:
        org_id = int(row.org_id) if row.org_id is not None else 0
        if org_id <= 0:
            continue
        org_payload = org_map.setdefault(
            org_id,
            {
                "id": org_id,
                "name": org_names.get(org_id, f"Tashkilot #{org_id}"),
                "camera_count": 0,
                "users_count": 0,
                "cameras": [],
            },
        )
        users_count = int(row.users_count or 0)
        org_payload["cameras"].append(
            {
                "id": int(row.camera_id),
                "name": str(row.camera_name or f"Kamera #{row.camera_id}"),
                "users_count": users_count,
            }
        )
        org_payload["camera_count"] += 1
        org_payload["users_count"] += users_count

    organizations = list(org_map.values())
    organizations.sort(key=lambda item: str(item.get("name") or ""))
    return {"ok": True, "organizations": organizations}


@router.post("/api/employees/import/from-attendance")
def import_employees_from_attendance(
    request: Request,
    payload: dict = Body(default={}),
    db: Session = Depends(get_db),
):
    data = payload if isinstance(payload, dict) else {}
    organization_id = data.get("organization_id")
    camera_id = data.get("camera_id")
    employee_type = _normalize_employee_type_for_import(data.get("employee_type"))
    limit = int(data.get("limit") or 5000)
    limit = max(1, min(limit, 50000))

    try:
        org_id_int = int(organization_id) if organization_id is not None else None
    except Exception:
        raise HTTPException(status_code=422, detail="organization_id noto'g'ri")
    try:
        cam_id_int = int(camera_id) if camera_id is not None else None
    except Exception:
        raise HTTPException(status_code=422, detail="camera_id noto'g'ri")

    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    if not allowed_org_ids:
        return {
            "ok": True,
            "created": 0,
            "updated": 0,
            "linked_to_camera": 0,
            "logs_bound": 0,
            "processed_users": 0,
            "message": "Import uchun ruxsatli tashkilot topilmadi",
        }

    if org_id_int is not None and org_id_int not in allowed_org_ids:
        raise HTTPException(status_code=403, detail="Tashkilot uchun ruxsat yo'q")

    if cam_id_int is not None:
        cam = db.query(Device.id, Device.organization_id).filter(Device.id == cam_id_int).first()
        if not cam:
            raise HTTPException(status_code=404, detail="Kamera topilmadi")
        if cam.organization_id not in allowed_org_ids:
            raise HTTPException(status_code=403, detail="Kamera uchun ruxsat yo'q")

    result = _import_from_attendance_core(
        db,
        allowed_org_ids=allowed_org_ids,
        org_id_int=org_id_int,
        cam_id_int=cam_id_int,
        employee_type=employee_type,
        limit=limit,
    )
    return {
        "ok": True,
        **result,
        "message": f"Davomatdan import yakunlandi: {result['created']} yangi, {result['updated']} yangilandi, {result['linked_to_camera']} bog'lanish yaratildi.",
    }


@router.get("/api/employees/{emp_id}/attendance-calendar")
def get_employee_attendance_calendar(
    emp_id: int,
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    now = datetime.utcnow()
    target_year = int(year or now.year)
    target_month = int(month or now.month)
    days_in_month = monthrange(target_year, target_month)[1]
    month_start = datetime(target_year, target_month, 1, 0, 0, 0)
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1, 0, 0, 0)
    else:
        month_end = datetime(target_year, target_month + 1, 1, 0, 0, 0)

    org_start = emp.organization.default_start_time if emp.organization else "09:00"
    org_end = emp.organization.default_end_time if emp.organization else "18:00"
    def_h, def_m = _parse_hhmm(org_start, 9, 0)
    def_end_h, def_end_m = _parse_hhmm(org_end, 18, 0)
    exp_h, exp_m = _parse_hhmm(emp.start_time, def_h, def_m)
    exp_end_h, exp_end_m = _parse_hhmm(emp.end_time, def_end_h, def_end_m)

    logs = (
        db.query(AttendanceLog)
        .filter(
            AttendanceLog.employee_id == emp.id,
            AttendanceLog.timestamp >= month_start,
            AttendanceLog.timestamp < month_end,
        )
        .order_by(AttendanceLog.timestamp.asc(), AttendanceLog.id.asc())
        .all()
    )

    day_map: dict[str, dict] = {}
    cameras_seen: set[str] = set()
    for log in logs:
        if not log.timestamp:
            continue
        day_key = log.timestamp.strftime("%Y-%m-%d")
        row = day_map.setdefault(
            day_key,
            {
                "first_seen": log.timestamp,
                "last_seen": log.timestamp,
                "event_count": 0,
                "camera_names": set(),
            },
        )
        row["event_count"] += 1
        if log.timestamp < row["first_seen"]:
            row["first_seen"] = log.timestamp
        if log.timestamp > row["last_seen"]:
            row["last_seen"] = log.timestamp
        cam_name = (log.device.name if log.device else (log.camera_mac or "Noma'lum kamera"))
        if cam_name:
            row["camera_names"].add(str(cam_name))
            cameras_seen.add(str(cam_name))

    summary = {
        "present_days": 0,
        "absent_days": 0,
        "late_days": 0,
        "total_late_minutes": 0,
        "total_late_seconds": 0,
        "total_events": len(logs),
        "camera_count": len(cameras_seen),
    }

    days: list[dict] = []
    for day_num in range(1, days_in_month + 1):
        day_dt = datetime(target_year, target_month, day_num, 0, 0, 0)
        day_key = day_dt.strftime("%Y-%m-%d")
        found = day_map.get(day_key)
        if not found:
            summary["absent_days"] += 1
            days.append(
                {
                    "day": day_num,
                    "date": day_key,
                    "present": False,
                    "status": "absent",
                    "event_count": 0,
                    "first_seen": None,
                    "last_seen": None,
                    "expected_time": day_dt.replace(hour=exp_h, minute=exp_m).isoformat(),
                    "expected_end_time": day_dt.replace(hour=exp_end_h, minute=exp_end_m).isoformat(),
                    "late_seconds": 0,
                    "late_minutes": 0,
                    "late_human": "0 daqiqa",
                    "late_human_full": "0 daqiqa",
                    "worked_seconds": 0,
                    "worked_human": "0 daqiqa",
                    "camera_names": [],
                }
            )
            continue

        first_seen = found["first_seen"]
        last_seen = found["last_seen"]
        expected_dt = day_dt.replace(hour=exp_h, minute=exp_m)
        expected_end_dt = day_dt.replace(hour=exp_end_h, minute=exp_end_m)
        late_seconds = max(0, int((first_seen - expected_dt).total_seconds()))
        late_minutes = late_seconds // 60
        worked_seconds = max(0, int((last_seen - first_seen).total_seconds()))
        status = "late" if late_minutes > 0 else "present"

        summary["present_days"] += 1
        if late_minutes > 0:
            summary["late_days"] += 1
            summary["total_late_minutes"] += late_minutes
            summary["total_late_seconds"] += late_seconds

        days.append(
            {
                "day": day_num,
                "date": day_key,
                "present": True,
                "status": status,
                "event_count": int(found["event_count"]),
                "first_seen": first_seen.isoformat() if first_seen else None,
                "last_seen": last_seen.isoformat() if last_seen else None,
                "expected_time": expected_dt.isoformat(),
                "expected_end_time": expected_end_dt.isoformat(),
                "late_seconds": late_seconds,
                "late_minutes": late_minutes,
                "late_human": _format_duration_human(late_minutes),
                "late_human_full": _format_duration_hms(late_seconds),
                "worked_seconds": worked_seconds,
                "worked_human": _format_duration_hms(worked_seconds),
                "camera_names": sorted(list(found["camera_names"])),
            }
        )

    linked_cameras = (
        db.query(Device.id, Device.name)
        .join(EmployeeCameraLink, EmployeeCameraLink.camera_id == Device.id)
        .filter(EmployeeCameraLink.employee_id == emp.id)
        .order_by(Device.name.asc())
        .all()
    )
    linked_list = [{"id": int(row[0]), "name": str(row[1])} for row in linked_cameras]

    summary["avg_late_minutes"] = (
        int(round(summary["total_late_minutes"] / summary["late_days"]))
        if summary["late_days"] > 0
        else 0
    )
    summary["avg_late_seconds"] = (
        int(round(summary["total_late_seconds"] / summary["late_days"]))
        if summary["late_days"] > 0
        else 0
    )
    summary["total_late_human"] = _format_duration_human(summary["total_late_minutes"])
    summary["avg_late_human"] = _format_duration_human(summary["avg_late_minutes"])
    summary["total_late_human_full"] = _format_duration_hms(summary["total_late_seconds"])
    summary["avg_late_human_full"] = _format_duration_hms(summary["avg_late_seconds"])

    return {
        "ok": True,
        "employee": {
            "id": emp.id,
            "first_name": emp.first_name,
            "last_name": emp.last_name,
            "middle_name": emp.middle_name,
            "personal_id": emp.personal_id,
            "department": emp.department,
            "position": emp.position,
            "organization_id": emp.organization_id,
            "organization_name": emp.organization.name if emp.organization else None,
            "start_time": emp.start_time or f"{def_h:02d}:{def_m:02d}",
            "end_time": emp.end_time or f"{def_end_h:02d}:{def_end_m:02d}",
            "image_url": emp.image_url or "",
            "has_access": bool(emp.has_access),
        },
        "month": {"year": target_year, "month": target_month, "days_in_month": days_in_month},
        "summary": summary,
        "days": days,
        "linked_cameras": linked_list,
    }


@router.get("/api/employees/{emp_id}/logs")
def get_employee_logs(
    emp_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    base_q = db.query(AttendanceLog).filter(AttendanceLog.employee_id == emp.id)
    total = int(base_q.count() or 0)
    total_pages = max(1, (total + page_size - 1) // page_size)
    safe_page = min(page, total_pages) if total > 0 else 1
    offset = (safe_page - 1) * page_size

    rows = (
        db.query(
            AttendanceLog.id,
            AttendanceLog.timestamp,
            AttendanceLog.status,
            AttendanceLog.camera_mac,
            Device.name.label("device_name"),
        )
        .outerjoin(Device, Device.id == AttendanceLog.device_id)
        .filter(AttendanceLog.employee_id == emp.id)
        .order_by(AttendanceLog.timestamp.desc(), AttendanceLog.id.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items = [
        {
            "id": int(row.id),
            "timestamp": row.timestamp.isoformat() if row.timestamp else None,
            "status": str(row.status or ""),
            "camera_name": str(row.device_name or row.camera_mac or "-"),
        }
        for row in rows
    ]

    return {
        "ok": True,
        "employee_id": int(emp.id),
        "page": safe_page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "items": items,
    }


@router.get("/api/employees/personal-id/validate")
def validate_personal_id(
    personal_id: str = Query(..., description="7 xonali personal ID"),
    db: Session = Depends(get_db),
):
    normalized = _normalize_personal_id(personal_id)
    if not normalized:
        return {
            "valid": False,
            "available": False,
            "message": "Shaxsiy ID bo'sh bo'lmasligi kerak",
        }
    if not PERSONAL_ID_PATTERN.fullmatch(normalized):
        return {
            "valid": False,
            "available": False,
            "message": "Faqat 7 ta raqam kiriting (birinchi raqam 1-9)",
        }
    taken = _is_personal_id_taken(db, normalized)
    return {
        "valid": True,
        "available": not taken,
        "message": "ID bo'sh" if not taken else "Bu ID bazada mavjud",
    }


@router.get("/api/employees/personal-id/generate")
def generate_personal_id(db: Session = Depends(get_db)):
    return {"personal_id": _generate_unique_personal_id(db)}


@router.post("/api/employees")
def create_employee(
    first_name: str = Form(...),
    last_name: str = Form(...),
    middle_name: Optional[str] = Form(None),
    personal_id: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    position: Optional[str] = Form(None),
    employee_type: Optional[str] = Form(None),
    start_time: Optional[str] = Form(None),
    end_time: Optional[str] = Form(None),
    organization_id: Optional[int] = Form(None),
    camera_ids: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    parsed_camera_ids = _parse_camera_ids(camera_ids)
    normalized_employee_type = _normalize_employee_type(employee_type)

    normalized_personal_id = _normalize_personal_id(personal_id)
    if normalized_personal_id is None:
        normalized_personal_id = _generate_unique_personal_id(db)
    else:
        _validate_personal_id_format(normalized_personal_id)
        if _is_personal_id_taken(db, normalized_personal_id):
            raise HTTPException(status_code=409, detail="Bu Shaxsiy ID bazada allaqachon mavjud")

    image_url = None
    if image and image.filename:
        ext = image.filename.split(".")[-1]
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        image_url = f"/{UPLOAD_DIR}/{filename}"

    new_emp = Employee(
        first_name=first_name,
        last_name=last_name,
        middle_name=(middle_name.strip() if middle_name else None),
        personal_id=normalized_personal_id,
        department=department,
        position=position,
        employee_type=normalized_employee_type,
        start_time=start_time,
        end_time=end_time,
        image_url=image_url,
        organization_id=organization_id,
    )
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)

    linked_camera_ids = _save_employee_camera_links(
        db,
        employee_id=int(new_emp.id),
        camera_ids=parsed_camera_ids,
        organization_id=organization_id,
    )
    db.commit()

    return {
        "ok": True,
        "id": new_emp.id,
        "personal_id": new_emp.personal_id,
        "camera_ids": linked_camera_ids,
        "message": "Xodim qo'shildi",
    }


@router.put("/api/employees/{emp_id}")
def update_employee(
    emp_id: int,
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    middle_name: Optional[str] = Form(None),
    personal_id: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    position: Optional[str] = Form(None),
    employee_type: Optional[str] = Form(None),
    start_time: Optional[str] = Form(None),
    end_time: Optional[str] = Form(None),
    organization_id: Optional[int] = Form(None),
    camera_ids: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    if image and image.filename:
        if emp.image_url:
            old_path = os.path.join(os.getcwd(), emp.image_url.lstrip("/"))
            if os.path.exists(old_path):
                os.remove(old_path)
        ext = image.filename.split(".")[-1]
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        emp.image_url = f"/{UPLOAD_DIR}/{filename}"

    if first_name is not None:
        emp.first_name = first_name
    if last_name is not None:
        emp.last_name = last_name
    if middle_name is not None:
        emp.middle_name = middle_name.strip() or None
    if personal_id is not None:
        normalized_personal_id = _normalize_personal_id(personal_id)
        if normalized_personal_id is None:
            emp.personal_id = None
        else:
            if _is_personal_id_taken(db, normalized_personal_id, exclude_employee_id=emp_id):
                raise HTTPException(status_code=409, detail="Bu Shaxsiy ID bazada allaqachon mavjud")
            emp.personal_id = normalized_personal_id
    if department is not None:
        emp.department = department
    if position is not None:
        emp.position = position
    if employee_type is not None:
        emp.employee_type = _normalize_employee_type(employee_type)
    if start_time is not None:
        emp.start_time = start_time
    if end_time is not None:
        emp.end_time = end_time
    if organization_id is not None:
        emp.organization_id = organization_id

    linked_camera_ids: Optional[list[int]] = None
    if camera_ids is not None:
        parsed_camera_ids = _parse_camera_ids(camera_ids)
        linked_camera_ids = _save_employee_camera_links(
            db,
            employee_id=int(emp.id),
            camera_ids=parsed_camera_ids,
            organization_id=emp.organization_id,
        )

    db.commit()
    payload = {"ok": True, "message": "Xodim yangilandi"}
    if linked_camera_ids is not None:
        payload["camera_ids"] = linked_camera_ids
    return payload


@router.post("/api/employees/{emp_id}/wellbeing-note")
def save_employee_wellbeing_note(
    emp_id: int,
    note_uz: str = Body(..., embed=True),
    note_ru: str = Body(..., embed=True),
    source: Optional[str] = Body("manual", embed=True),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.id == emp_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    note_uz_clean = str(note_uz or "").strip()
    note_ru_clean = str(note_ru or "").strip()
    if not note_uz_clean or not note_ru_clean:
        raise HTTPException(status_code=422, detail="note_uz va note_ru majburiy")

    source_clean = _normalize_wellbeing_note_source(source)
    now_dt = datetime.utcnow()
    row = EmployeeWellbeingNote(
        employee_id=int(employee.id),
        note_uz=note_uz_clean,
        note_ru=note_ru_clean,
        source=source_clean,
        created_at=now_dt,
        updated_at=now_dt,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {
        "ok": True,
        "id": int(row.id),
        "employee_id": int(employee.id),
        "note_uz": row.note_uz,
        "note_ru": row.note_ru,
        "source": row.source,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/api/employees/{emp_id}/wellbeing-note/latest")
def get_latest_employee_wellbeing_note(emp_id: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == emp_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    row = (
        db.query(EmployeeWellbeingNote)
        .filter(EmployeeWellbeingNote.employee_id == emp_id)
        .order_by(EmployeeWellbeingNote.created_at.desc(), EmployeeWellbeingNote.id.desc())
        .first()
    )
    if row is None:
        return {"ok": True, "item": None}

    return {
        "ok": True,
        "item": {
            "id": int(row.id),
            "employee_id": int(row.employee_id),
            "note_uz": row.note_uz,
            "note_ru": row.note_ru,
            "source": row.source,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        },
    }


@router.post("/api/employees/{emp_id}/psychological-state")
def save_employee_psychological_state(
    emp_id: int,
    state_uz: str = Body(..., embed=True),
    state_ru: str = Body(..., embed=True),
    state_date: Optional[str] = Body(None, embed=True),
    source: Optional[str] = Body("manual", embed=True),
    note: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.id == emp_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    state_uz_clean = str(state_uz or "").strip()
    state_ru_clean = str(state_ru or "").strip()
    if not state_uz_clean or not state_ru_clean:
        raise HTTPException(status_code=422, detail="state_uz va state_ru majburiy")

    source_clean = _normalize_psychological_state_source(source)
    date_clean = str(state_date or "").strip() or datetime.utcnow().strftime("%Y-%m-%d")
    try:
        datetime.strptime(date_clean, "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=422, detail="state_date formati noto'g'ri, YYYY-MM-DD bo'lishi kerak")

    now_dt = datetime.utcnow()
    row = (
        db.query(EmployeePsychologicalState)
        .filter(
            EmployeePsychologicalState.employee_id == int(employee.id),
            EmployeePsychologicalState.state_date == date_clean,
        )
        .order_by(EmployeePsychologicalState.id.desc())
        .first()
    )

    if row is None:
        row = EmployeePsychologicalState(
            employee_id=int(employee.id),
            state_uz=state_uz_clean,
            state_ru=state_ru_clean,
            state_date=date_clean,
            source=source_clean,
            note=str(note or "").strip() or None,
            assessed_at=now_dt,
            created_at=now_dt,
            updated_at=now_dt,
        )
        db.add(row)
    else:
        row.state_uz = state_uz_clean
        row.state_ru = state_ru_clean
        row.source = source_clean
        row.note = str(note or "").strip() or None
        row.assessed_at = now_dt
        row.updated_at = now_dt

    db.commit()
    db.refresh(row)
    return {
        "ok": True,
        "id": int(row.id),
        "employee_id": int(employee.id),
        "state_uz": row.state_uz,
        "state_ru": row.state_ru,
        "state_date": row.state_date,
        "source": row.source,
        "note": row.note,
        "assessed_at": row.assessed_at.isoformat() if row.assessed_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/api/employees/{emp_id}/psychological-state/latest")
def get_latest_employee_psychological_state(emp_id: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == emp_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    row = (
        db.query(EmployeePsychologicalState)
        .filter(EmployeePsychologicalState.employee_id == int(employee.id))
        .order_by(EmployeePsychologicalState.state_date.desc(), EmployeePsychologicalState.id.desc())
        .first()
    )
    if row is None:
        return {"ok": True, "item": None}

    return {
        "ok": True,
        "item": {
            "id": int(row.id),
            "employee_id": int(row.employee_id),
            "state_uz": row.state_uz,
            "state_ru": row.state_ru,
            "state_date": row.state_date,
            "source": row.source,
            "note": row.note,
            "assessed_at": row.assessed_at.isoformat() if row.assessed_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        },
    }


@router.get("/api/employees/{emp_id}/psychological-state/history")
def get_employee_psychological_state_history(
    emp_id: int,
    limit: int = Query(30, ge=1, le=366),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.id == emp_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    rows = (
        db.query(EmployeePsychologicalState)
        .filter(EmployeePsychologicalState.employee_id == int(employee.id))
        .order_by(EmployeePsychologicalState.state_date.desc(), EmployeePsychologicalState.id.desc())
        .limit(int(limit))
        .all()
    )

    return {
        "ok": True,
        "items": [
            {
                "id": int(row.id),
                "employee_id": int(row.employee_id),
                "state_uz": row.state_uz,
                "state_ru": row.state_ru,
                "state_date": row.state_date,
                "source": row.source,
                "note": row.note,
                "assessed_at": row.assessed_at.isoformat() if row.assessed_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
            for row in rows
        ],
    }


@router.get("/api/employees/{emp_id}/camera-face-status")
def get_employee_camera_face_status(
    emp_id: int,
    camera_id: Optional[int] = Query(None),
    camera_ids: Optional[str] = Query(None),
    allow_camera_http_download: bool = Query(False),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    personal_id = str(emp.personal_id or "").strip()
    if not personal_id:
        return {
            "ok": True,
            "employee_id": int(emp.id),
            "personal_id": "",
            "local_image_exists": bool(str(emp.image_url or "").strip()),
            "local_image_url": str(emp.image_url or ""),
            "camera_face_found": False,
            "camera_sync_available": False,
            "attempts": [],
            "message": "Xodimda personal_id yo'q. Kamera holatini tekshirib bo'lmaydi.",
        }

    requested_camera_ids = _parse_camera_ids(camera_ids)
    cameras = _resolve_employee_target_cameras(
        db,
        employee=emp,
        camera_id=camera_id,
        camera_ids=requested_camera_ids,
    )
    if not cameras:
        raise HTTPException(status_code=404, detail="Xodimga mos kamera topilmadi")

    if len(cameras) == 1:
        attempts = [
            _inspect_employee_face_on_camera(
                cameras[0],
                personal_id=personal_id,
                allow_camera_http_download=allow_camera_http_download,
                import_image=False,
                quick_probe=True,
            )
        ]
    else:
        with ThreadPoolExecutor(max_workers=min(4, max(1, len(cameras)))) as pool:
            attempts = list(
                pool.map(
                    lambda cam: _inspect_employee_face_on_camera(
                        cam,
                        personal_id=personal_id,
                        allow_camera_http_download=allow_camera_http_download,
                        import_image=False,
                        quick_probe=True,
                    ),
                    cameras,
                )
            )
    payload = _build_employee_face_status_payload(emp, attempts=attempts)
    payload["message"] = (
        "Kamera bazasida rasm topildi."
        if payload.get("camera_face_found")
        else "Kamera bazasida rasm topilmadi."
    )
    return payload


@router.post("/api/employees/{emp_id}/camera-face-status/start")
def start_employee_camera_face_status_job(
    emp_id: int,
    payload: Optional[dict[str, Any]] = Body(default=None),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    camera_ids_raw = (payload or {}).get("camera_ids") if isinstance(payload, dict) else []
    allow_camera_http_download = bool((payload or {}).get("allow_camera_http_download", False))
    if not isinstance(camera_ids_raw, list):
        camera_ids_raw = []

    camera_ids: list[int] = []
    for cam_id in camera_ids_raw:
        try:
            val = int(cam_id)
        except Exception:
            continue
        if val > 0 and val not in camera_ids:
            camera_ids.append(val)

    job_id = uuid.uuid4().hex
    _set_import_job(
        job_id,
        {
            "job_id": job_id,
            "job_type": "employee_face_status",
            "status": "queued",
            "employee_id": int(emp.id),
            "created_at": _now_iso(),
            "processed_cameras": 0,
            "total_cameras": 0,
            "progress_percent": 0,
            "attempts": [],
        },
    )
    thread = threading.Thread(
        target=_run_employee_face_job,
        kwargs={
            "job_id": job_id,
            "employee_id": int(emp.id),
            "camera_ids": camera_ids,
            "allow_camera_http_download": allow_camera_http_download,
            "import_image": False,
        },
        daemon=True,
        name=f"employee-face-status-{job_id[:8]}",
    )
    thread.start()
    return {"ok": True, "job_id": job_id, "message": "ISUP rasm holati tekshiruvi boshlandi"}


@router.post("/api/employees/{emp_id}/import-face-from-camera/start")
def start_employee_face_import_job(
    emp_id: int,
    payload: Optional[dict[str, Any]] = Body(default=None),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    camera_ids_raw = (payload or {}).get("camera_ids") if isinstance(payload, dict) else []
    allow_camera_http_download = bool((payload or {}).get("allow_camera_http_download", False))
    if not isinstance(camera_ids_raw, list):
        camera_ids_raw = []

    camera_ids: list[int] = []
    for cam_id in camera_ids_raw:
        try:
            val = int(cam_id)
        except Exception:
            continue
        if val > 0 and val not in camera_ids:
            camera_ids.append(val)

    job_id = uuid.uuid4().hex
    _set_import_job(
        job_id,
        {
            "job_id": job_id,
            "job_type": "employee_face_import",
            "status": "queued",
            "employee_id": int(emp.id),
            "created_at": _now_iso(),
            "processed_cameras": 0,
            "total_cameras": 0,
            "progress_percent": 0,
            "attempts": [],
        },
    )
    thread = threading.Thread(
        target=_run_employee_face_job,
        kwargs={
            "job_id": job_id,
            "employee_id": int(emp.id),
            "camera_ids": camera_ids,
            "allow_camera_http_download": allow_camera_http_download,
            "import_image": True,
        },
        daemon=True,
        name=f"employee-face-import-{job_id[:8]}",
    )
    thread.start()
    return {"ok": True, "job_id": job_id, "message": "Kameradan rasm sync jarayoni boshlandi"}


@router.get("/api/employees/face-jobs/{job_id}")
def get_employee_face_job_status(job_id: str):
    state = _get_import_job(str(job_id or "").strip())
    if not state:
        raise HTTPException(status_code=404, detail="Job topilmadi")
    return {"ok": True, **state}


@router.post("/api/employees/{emp_id}/import-face-from-camera")
def import_employee_face_from_camera(
    emp_id: int,
    camera_id: Optional[int] = Query(None),
    camera_ids: Optional[str] = Query(None),
    overwrite: bool = Query(False),
    allow_camera_http_download: bool = Query(False),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    personal_id = str(emp.personal_id or "").strip()
    if not personal_id:
        raise HTTPException(status_code=422, detail="Xodimda personal_id yo'q")

    if emp.image_url and not overwrite:
        return {
            "ok": True,
            "employee_id": int(emp.id),
            "personal_id": personal_id,
            "skipped": True,
            "reason": "image_exists",
            "message": "Xodim rasmi allaqachon mavjud. Qayta import uchun overwrite=true yuboring.",
        }

    requested_camera_ids = _parse_camera_ids(camera_ids)
    cameras = _resolve_employee_target_cameras(
        db,
        employee=emp,
        camera_id=camera_id,
        camera_ids=requested_camera_ids,
    )
    if not cameras:
        raise HTTPException(status_code=404, detail="Xodimga mos kamera topilmadi")

    attempts: list[dict[str, Any]] = []
    for cam in cameras:
        attempt = _inspect_employee_face_on_camera(
            cam,
            personal_id=personal_id,
            allow_camera_http_download=allow_camera_http_download,
            import_image=True,
        )
        image_url = str(attempt.get("image_url") or "").strip()
        attempts.append(attempt)
        if image_url:
            emp.image_url = image_url
            db.commit()
            return {
                "ok": True,
                "employee_id": int(emp.id),
                "personal_id": personal_id,
                "image_url": image_url,
                "camera_id": int(cam.id),
                "camera_name": str(cam.name or ""),
                "attempts": attempts,
                "message": "Xodim rasmi kameradagi foydalanuvchi bazasidan sync qilindi va local bazaga saqlandi",
            }

    raise HTTPException(
        status_code=422,
        detail={
            "message": "Xodim rasmi kameradagi foydalanuvchi bazasidan olinmadi",
            "reason": "camera_face_image_unavailable",
            "attempts": attempts[:10],
        },
    )


@router.delete("/api/employees/{emp_id}")
def delete_employee(
    emp_id: int,
    delete_from_cameras: bool = Query(True),
    camera_ids: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    personal_id = str(emp.personal_id or "").strip()
    camera_sync = {
        "enabled": bool(delete_from_cameras),
        "requested": 0,
        "deleted": 0,
        "failed": 0,
        "skipped": 0,
        "details": [],
    }

    if delete_from_cameras:
        if not personal_id:
            camera_sync["enabled"] = False
            camera_sync["details"].append(
                {
                    "status": "skipped",
                    "reason": "Xodimda personal_id yo'q, kameradan o'chirib bo'lmadi",
                }
            )
        else:
            selected_camera_ids = _parse_camera_ids(camera_ids)
            linked_camera_ids = [
                int(row.camera_id)
                for row in db.query(EmployeeCameraLink.camera_id)
                .filter(EmployeeCameraLink.employee_id == emp.id)
                .all()
            ]
            if linked_camera_ids:
                base_cameras = (
                    db.query(Device)
                    .filter(Device.id.in_(linked_camera_ids))
                    .order_by(Device.id)
                    .all()
                )
            else:
                cams_q = db.query(Device)
                if emp.organization_id is not None:
                    cams_q = cams_q.filter(Device.organization_id == emp.organization_id)
                base_cameras = cams_q.order_by(Device.id).all()

            cameras = base_cameras
            if selected_camera_ids:
                base_map = {int(cam.id): cam for cam in base_cameras}
                cameras = [base_map[cam_id] for cam_id in selected_camera_ids if cam_id in base_map]
                skipped_selected = [cam_id for cam_id in selected_camera_ids if cam_id not in base_map]
                if skipped_selected:
                    camera_sync["details"].append(
                        {
                            "status": "skipped",
                            "reason": f"Tanlangan kameralardan ba'zilari xodimga bog'lanmagan yoki mavjud emas: {skipped_selected}",
                        }
                    )
            camera_sync["requested"] = len(cameras)

            for cam in cameras:
                try:
                    target_id, _, _ = _resolve_online_command_target(cam)
                except HTTPException as exc:
                    camera_sync["skipped"] += 1
                    camera_sync["details"].append(
                        {
                            "camera_id": cam.id,
                            "camera_name": cam.name,
                            "status": "skipped",
                            "error": str(exc.detail),
                        }
                    )
                    continue

                try:
                    response = _send_isup_command_or_raise(
                        target_id,
                        "delete_user",
                        {"personal_id": personal_id},
                        timeout=8.0,
                    )
                    camera_sync["deleted"] += 1
                    camera_sync["details"].append(
                        {
                            "camera_id": cam.id,
                            "camera_name": cam.name,
                            "status": "deleted",
                            "target_device_id": target_id,
                            "message": response.get("message") if isinstance(response, dict) else "",
                        }
                    )
                except HTTPException as exc:
                    camera_sync["failed"] += 1
                    camera_sync["details"].append(
                        {
                            "camera_id": cam.id,
                            "camera_name": cam.name,
                            "status": "failed",
                            "target_device_id": target_id,
                            "error": str(exc.detail),
                        }
                    )

    if emp.image_url:
        old_path = os.path.join(os.getcwd(), emp.image_url.lstrip("/"))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception:
                pass

    db.delete(emp)
    db.commit()

    message = "Xodim o'chirildi"
    if delete_from_cameras and personal_id:
        message = (
            f"{message}. Kameralarda: {camera_sync['deleted']} o'chirildi, "
            f"{camera_sync['failed']} xato, {camera_sync['skipped']} o'tkazildi."
        )

    # Frontend uchun javobni ixcham saqlaymiz.
    details = camera_sync["details"]
    camera_sync["details"] = details[:10]
    if len(details) > 10:
        camera_sync["details_truncated"] = len(details) - 10

    return {"ok": True, "message": message, "camera_sync": camera_sync}
