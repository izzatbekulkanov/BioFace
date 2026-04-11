import os
import base64
import json
import re
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import AttendanceLog, Device, Employee, EmployeeCameraLink
from routers.employees_parts.common import (
    ISUP_SNAPSHOT_INDEX_PATH,
    get_import_job as _get_import_job,
    now_iso as _now_iso,
    parse_camera_ids as _parse_camera_ids,
    resolve_employee_target_cameras as _resolve_employee_target_cameras,
    set_import_job as _set_import_job,
    update_import_job as _update_import_job,
)
from routers.employees_parts.routes_attendance import router as attendance_router
from routers.employees_parts.routes_imports import router as imports_router
from routers.employees_parts.routes_management import router as management_router
from routers.employees_parts.routes_profile import router as profile_router
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
)

router = APIRouter()
router.include_router(management_router)
router.include_router(imports_router)
router.include_router(attendance_router)
router.include_router(profile_router)


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
        for key in ["FaceDataRecord", "FaceInfo", "UserInfoDetail", "UserInfo"]:
            val = payload.get(key)
            if isinstance(val, dict):
                candidates.append(val)
        for key in ["FaceInfoSearch", "UserInfoSearch", "UserInfoDetailSearch"]:
            val = payload.get(key)
            if isinstance(val, dict):
                sub_list = val.get("FaceInfo") or val.get("UserInfoDetail") or val.get("UserInfo")
                if isinstance(sub_list, list):
                    candidates.extend([x for x in sub_list if isinstance(x, dict)])
        candidates.append(payload)

    parsed_text = _try_parse_json_text(text_payload)
    if isinstance(parsed_text, dict):
        match_list = parsed_text.get("MatchList")
        if isinstance(match_list, list):
            candidates.extend([x for x in match_list if isinstance(x, dict)])
        for key in ["FaceDataRecord", "FaceInfo", "UserInfoDetail", "UserInfo"]:
            val = parsed_text.get(key)
            if isinstance(val, dict):
                candidates.append(val)
        for key in ["FaceInfoSearch", "UserInfoSearch", "UserInfoDetailSearch"]:
            val = parsed_text.get(key)
            if isinstance(val, dict):
                sub_list = val.get("FaceInfo") or val.get("UserInfoDetail") or val.get("UserInfo")
                if isinstance(sub_list, list):
                    candidates.extend([x for x in sub_list if isinstance(x, dict)])
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
            f"/ISAPI/Intelligent/FDLib/FDSearch/picture?faceLibType=blackFD&FDID=1&FPID={personal_id}",
            None,
        ),
        (
            "/ISAPI/AccessControl/FaceInfo/download?format=json",
            {
                "FaceInfoDownloadCond": {
                    "searchID": "1",
                    "EmployeeNoList": [{"employeeNo": personal_id}]
                }
            },
        ),
        (
            "/ISAPI/AccessControl/FaceInfo/Search?format=json",
            {
                "FaceInfoSearchCond": {
                    "searchID": "1",
                    "searchResultPosition": 0,
                    "maxResults": 1,
                    "EmployeeNoList": [{"employeeNo": personal_id}]
                }
            },
        ),
        (
            "/ISAPI/AccessControl/UserInfoDetail/Search?format=json",
            {
                "UserInfoDetailSearchCond": {
                    "searchID": "1",
                    "searchResultPosition": 0,
                    "maxResults": 1,
                    "EmployeeNoList": [{"employeeNo": personal_id}]
                }
            },
        ),
        (
            "/ISAPI/Intelligent/FDLib/FDSearch?format=json",
            {
                "FDSearchCond": {
                    "searchID": "1",
                    "searchResultPosition": 0,
                    "maxResults": 1,
                    "faceLibType": "blackFD",
                    "FDID": "1",
                    "FPID": personal_id,
                }
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
                url = f"{conn['base_url']}{path}"
                if body is None:
                    response = client.get(url)
                else:
                    response = client.post(url, json=body)
            
            # Agar rasm to'g'ridan to'g'ri binar qaytsa:
            content_type = str(response.headers.get("Content-Type", "")).lower()
            if "image" in content_type:
                return response.content, None, f"direct_image_get: {path}"

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
    db_emp_id: Optional[int] = None,
    allow_http_fallback: bool = False,
    timeout: float = 15.0,
) -> tuple[Optional[bytes], Optional[str]]:
    try:
        payload = _send_isup_command_or_raise(
            target_id,
            "get_face_image",
            {
                "personal_id": personal_id,
                "db_emp_id": db_emp_id,
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
    db_emp_id: Optional[int] = None,
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
            db_emp_id=db_emp_id,
            allow_http_fallback=allow_camera_http_download,
            timeout=15.0 if quick_probe else 35.0,
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
                db_emp_id=int(emp.id) if emp else None,
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

