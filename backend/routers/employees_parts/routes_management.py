from datetime import datetime
import base64
import os
import shutil
import time
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock
from typing import Any, Optional
from urllib.parse import urljoin

import cv2
import numpy as np

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, Request, UploadFile, BackgroundTasks
from sqlalchemy import String, and_, cast, exists, false, func, or_, true
from sqlalchemy.orm import Session

from core.database import get_db
from core.models import Department, Device, Employee, EmployeeCameraLink, Organization, Position, Schedule, UserOrganizationLink, Branch, User, UserRole, FaceEmbedding
from routers.employees_parts.catalogs import (
    UNSET,
    get_catalog_items_for_org,
    get_or_create_department,
    get_or_create_position,
    normalize_catalog_name,
    parse_optional_positive_int,
    resolve_department_selection,
    resolve_position_selection,
    serialize_department_item,
    serialize_position_item,
)
from routers.employees_parts.common import (
    PERSONAL_ID_PATTERN,
    UPLOAD_DIR,
    generate_unique_personal_id,
    get_accessible_organization_or_raise,
    is_personal_id_taken,
    normalize_employee_type,
    normalize_personal_id,
    parse_camera_ids,
    resolve_effective_org_id,
    save_employee_camera_links,
    validate_personal_id_format,
)
from routers.cameras import (
    _is_not_supported_error,
    _resolve_online_command_target,
    _send_isup_command_or_raise,
)
from utils.schedule_utils import resolve_employee_schedule
from utils.face_embeddings import trigger_embedding_generation_bg

router = APIRouter()

# ─── Mobile Check-in Rate Limiting ───────────────────────────────────────────
# Bir xodim 60 soniya ichida max 5 marta urinishi mumkin
_CHECKIN_RATE_LIMIT: dict[int, list[float]] = defaultdict(list)
_CHECKIN_RATE_LOCK = Lock()
_CHECKIN_RATE_WINDOW = 60.0   # sekund
_CHECKIN_RATE_MAX = 5         # maksimal urinish soni

def _check_checkin_rate_limit(employee_id: int) -> None:
    """Rate limit tekshiruvchi — oshib ketsa HTTPException ko'taradi."""
    now = time.monotonic()
    with _CHECKIN_RATE_LOCK:
        timestamps = _CHECKIN_RATE_LIMIT[employee_id]
        # Oynadan tashqarida qolgan vaqtlarni o'chirish
        _CHECKIN_RATE_LIMIT[employee_id] = [t for t in timestamps if now - t < _CHECKIN_RATE_WINDOW]
        if len(_CHECKIN_RATE_LIMIT[employee_id]) >= _CHECKIN_RATE_MAX:
            raise HTTPException(
                status_code=429,
                detail=f"Juda ko'p urinish. {int(_CHECKIN_RATE_WINDOW)} soniya kutib qayta urinib ko'ring."
            )
        _CHECKIN_RATE_LIMIT[employee_id].append(now)

def clean_salary_options(val):
    if not val:
        return None
    if isinstance(val, list):
        cleaned = []
        for x in val:
            try:
                cleaned.append(str(int(str(x).replace(" ", "").replace(",", "").strip())))
            except ValueError:
                pass
        return ",".join(cleaned) if cleaned else None
    if isinstance(val, str):
        parts = val.split(",")
        cleaned = []
        for p in parts:
            p_clean = p.replace(" ", "").replace(",", "").strip()
            try:
                if p_clean:
                    cleaned.append(str(int(p_clean)))
            except ValueError:
                pass
        return ",".join(cleaned) if cleaned else None
    return None



def _resolve_employee_allowed_org_ids(request: Request, db: Session) -> list[int]:
    """Employees list scope.

    SuperAdmin -> hamma tashkilotlar.
    Boshqa rollar -> faqat user bilan bog'langan tashkilotlar
    (`UserOrganizationLink` yoki session.organization_id orqali).
    """
    auth_user = request.session.get("auth_user") or {}
    role = str(auth_user.get("role") or "").strip().lower()
    if role in {"superadmin", "super_admin"}:
        rows = db.query(Organization.id).all()
        return [int(row.id) for row in rows]

    org_ids: set[int] = set()

    user_id = auth_user.get("id")
    if user_id is not None:
        rows = (
            db.query(UserOrganizationLink.organization_id)
            .filter(UserOrganizationLink.user_id == int(user_id))
            .all()
        )
        for row in rows:
            if row.organization_id is not None:
                org_ids.add(int(row.organization_id))

    fallback_org_id = auth_user.get("organization_id")
    if fallback_org_id is not None:
        org_ids.add(int(fallback_org_id))

    if not org_ids and auth_user.get("name"):
        emp_org = db.query(Employee.organization_id).filter(Employee.personal_id == str(auth_user["name"])).first()
        if emp_org and emp_org.organization_id is not None:
            org_ids.add(int(emp_org.organization_id))

    if not org_ids:
        rows = db.query(Organization.id).all()
        return [int(row.id) for row in rows]

    return sorted(org_ids)


def _serialize_employee_record(
    employee: Employee,
    org_map: dict[int, str],
    cam_map: dict[int, str],
    camera_map: dict[int, list[int]],
    embedding_set: Optional[set[int]] = None,
) -> dict:
    schedule_payload = resolve_employee_schedule(employee)

    if not employee.image_url:
        has_emb = False
    elif embedding_set is not None:
        has_emb = int(employee.id) in embedding_set
    else:
        has_emb = len(employee.embeddings) > 0

    return {
        "id": employee.id,
        "uuid": employee.uuid,
        "personal_id": employee.personal_id,
        "full_name": " ".join([x for x in [employee.first_name, employee.last_name, employee.middle_name] if x]),
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "middle_name": employee.middle_name,
        "department_id": employee.department_id,
        "department": employee.department_ref.name if employee.department_ref else (employee.department or ""),
        "position_id": employee.position_id,
        "position": employee.position_ref.name if employee.position_ref else (employee.position or ""),
        "employee_type": employee.employee_type,
        "status": "Faol" if employee.has_access else "Ruxsat yo'q",
        "added_date": employee.created_at.strftime("%Y-%m-%d") if employee.created_at else "",
        "start_time": employee.start_time,
        "end_time": employee.end_time,
        "effective_start_time": schedule_payload.get("start_time"),
        "effective_end_time": schedule_payload.get("end_time"),
        "schedule_id": employee.schedule_id,
        "schedule_name": schedule_payload.get("schedule_name"),
        "schedule_type": employee.schedule_type or "organization",
        "schedule_is_flexible": bool(schedule_payload.get("is_flexible")),
        "schedule_source": schedule_payload.get("source"),
        "avatar": employee.image_url or "",
        "phone": employee.phone or "",
        "parent_phone": employee.parent_phone or "",
        "region": employee.region or "",
        "district": employee.district or "",
        "address": employee.address or "",
        "birth_date": employee.birth_date or "",
        "gender": employee.gender or "",
        "organization_id": employee.organization_id,
        "branch_id": employee.branch_id,
        "organization_name": org_map.get(int(employee.organization_id)) if employee.organization_id is not None else None,
        "salary": employee.salary,
        "camera_ids": camera_map.get(int(employee.id), []),
        "camera_names": [cam_map[cam_id] for cam_id in camera_map.get(int(employee.id), []) if cam_id in cam_map],
        "has_embedding": has_emb,
    }


def _resolve_schedule_selection(
    db: Session,
    *,
    organization_id: Optional[int],
    schedule_id_raw: Optional[str],
    allow_unset: bool = False,
):
    if schedule_id_raw is None:
        return UNSET if allow_unset else None

    raw = str(schedule_id_raw or "").strip()
    if not raw:
        return None

    schedule_id = parse_optional_positive_int(raw, field_label="Smena")
    if schedule_id is None:
        return None

    schedule = db.query(Schedule).filter(Schedule.id == int(schedule_id)).first()
    if schedule is None:
        raise HTTPException(status_code=422, detail="Tanlangan smena topilmadi")
    if organization_id is not None and int(schedule.organization_id) != int(organization_id):
        raise HTTPException(status_code=422, detail="Tanlangan smena boshqa tashkilotga tegishli")
    return schedule


def _build_employee_payload(db: Session, employees: list[Employee], allowed_org_ids: list[int]) -> list[dict]:
    employee_ids = [int(emp.id) for emp in employees]
    if not employee_ids:
        return []

    from models import FaceEmbedding

    org_rows = (
        db.query(Organization.id, Organization.name)
        .filter(Organization.id.in_(allowed_org_ids))
        .all()
        if allowed_org_ids
        else []
    )
    cam_rows = (
        db.query(Device.id, Device.name)
        .filter(Device.organization_id.in_(allowed_org_ids))
        .all()
        if allowed_org_ids
        else []
    )
    links = (
        db.query(EmployeeCameraLink.employee_id, EmployeeCameraLink.camera_id)
        .filter(EmployeeCameraLink.employee_id.in_(employee_ids))
        .all()
    )
    emb_rows = (
        db.query(FaceEmbedding.employee_id)
        .filter(FaceEmbedding.employee_id.in_(employee_ids))
        .all()
    )

    org_map = {int(row[0]): str(row[1]) for row in org_rows}
    cam_map = {int(row[0]): str(row[1]) for row in cam_rows}
    camera_map: dict[int, list[int]] = {}
    for emp_id, cam_id in links:
        camera_map.setdefault(int(emp_id), []).append(int(cam_id))

    embedding_set = {int(row[0]) for row in emb_rows if row[0] is not None}

    return [_serialize_employee_record(emp, org_map, cam_map, camera_map, embedding_set) for emp in employees]


def _camera_user_exists_fast(target_id: str, personal_id: str, *, max_scan: int = 300) -> bool:
    target = str(personal_id or "").strip()
    if not target:
        return False
    response = _send_isup_command_or_raise(
        target_id,
        "get_users",
        {
            "personal_id": target,
            "searchResultPosition": 0,
            "max_results": min(10, max_scan),
        },
        timeout=8.0,
    )
    rows = response.get("users", []) if isinstance(response, dict) else []
    if not isinstance(rows, list) or not rows:
        return False

    for row in rows:
        if not isinstance(row, dict):
            continue
        candidate = str(
            row.get("employeeNo")
            or row.get("employeeNoString")
            or row.get("personID")
            or row.get("personId")
            or ""
        ).strip()
        if candidate == target:
            return True
    return False


def _camera_face_exists_fast(target_id: str, personal_id: str, *, max_scan: int = 300) -> bool:
    target = str(personal_id or "").strip()
    if not target:
        return False

    response = _send_isup_command_or_raise(
        target_id,
        "get_face_records",
        {
            "personal_id": target,
            "all": False,
            "limit": min(6, max_scan),
            "max_results": 6,
            "include_media": False,
            "include_raw": False,
        },
        timeout=8.0,
    )
    rows = response.get("records", []) if isinstance(response, dict) else []
    if not isinstance(rows, list) or not rows:
        return False

    for row in rows:
        if not isinstance(row, dict):
            continue
        candidate = str(
            row.get("fpid")
            or row.get("FPID")
            or row.get("employeeNo")
            or row.get("employeeNoString")
            or row.get("personID")
            or row.get("personId")
            or ""
        ).strip()
        if candidate == target:
            return True
    return False


def _camera_face_image_exists_fast(target_id: str, personal_id: str) -> bool:
    target = str(personal_id or "").strip()
    if not target:
        return False
    try:
        response = _send_isup_command_or_raise(
            target_id,
            "get_face_image",
            {"personal_id": target},
            timeout=3.5,
        )
    except HTTPException as exc:
        detail_text = str(exc.detail or "")
        lowered = detail_text.lower()
        # For "not found" style errors we return False; transport/protocol errors bubble up.
        if _is_not_supported_error(detail_text):
            return False
        if "not found" in lowered or "topilmadi" in lowered or "mavjud emas" in lowered:
            return False
        raise

    if not isinstance(response, dict):
        return False
    image_b64 = str(response.get("image_b64") or "").strip()
    face_url = str(response.get("face_url") or "").strip()
    return bool(image_b64 or face_url)


def _parse_optional_positive_filter_int(raw_value: Optional[str], *, field_label: str) -> Optional[int]:
    raw = str(raw_value or "").strip()
    if not raw or raw.lower() == "all":
        return None
    try:
        parsed = int(raw)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"{field_label} ID noto'g'ri") from exc
    if parsed <= 0:
        raise HTTPException(status_code=422, detail=f"{field_label} ID musbat bo'lishi kerak")
    return parsed


def _employee_list_base_query(request: Request, db: Session):
    allowed_org_ids = _resolve_employee_allowed_org_ids(request, db)
    if not allowed_org_ids:
        return db.query(Employee).filter(false()), []
    return db.query(Employee).filter(Employee.organization_id.in_(allowed_org_ids)), allowed_org_ids


def _apply_employee_view_mode_scope(query, view_mode: Optional[str]):
    normalized_employee_type = func.lower(func.trim(func.coalesce(Employee.employee_type, "")))
    raw_view_mode = str(view_mode or "").strip().lower()
    if not raw_view_mode or raw_view_mode == "all":
        return query
    if raw_view_mode == "staff":
        return query.filter(normalized_employee_type.in_(["hodim", "oqituvchi"]))
    if raw_view_mode == "students":
        return query.filter(normalized_employee_type.in_(["", "oquvchi"]))
    raise HTTPException(status_code=422, detail="Ko'rinish turi noto'g'ri")


def _apply_employee_list_filters(
    query,
    *,
    search: Optional[str] = None,
    view_mode: Optional[str] = None,
    organization_id: Optional[str] = None,
    department: Optional[str] = None,
    position: Optional[str] = None,
    camera_id: Optional[str] = None,
    employee_type: Optional[str] = None,
):
    normalized_query = normalize_catalog_name(search)
    if normalized_query:
        q = f"%{normalized_query.casefold()}%"
        query = query.filter(
            or_(
                func.lower(func.coalesce(Employee.first_name, "")).like(q),
                func.lower(func.coalesce(Employee.last_name, "")).like(q),
                func.lower(func.coalesce(Employee.middle_name, "")).like(q),
                func.lower(func.coalesce(Employee.personal_id, "")).like(q),
                func.lower(cast(Employee.id, String)).like(q),
            )
        )

    org_id = _parse_optional_positive_filter_int(organization_id, field_label="Tashkilot")
    if org_id is not None:
        query = query.filter(Employee.organization_id == org_id)

    dept_value = normalize_catalog_name(department)
    if dept_value and dept_value.lower() != "all":
        query = query.filter(func.trim(func.coalesce(Employee.department, "")) == dept_value)

    pos_value = normalize_catalog_name(position)
    if pos_value and pos_value.lower() != "all":
        query = query.filter(func.trim(func.coalesce(Employee.position, "")) == pos_value)

    cam_id = _parse_optional_positive_filter_int(camera_id, field_label="Kamera")
    if cam_id is not None:
        query = query.filter(
            exists().where(
                and_(
                    EmployeeCameraLink.employee_id == Employee.id,
                    EmployeeCameraLink.camera_id == cam_id,
                )
            )
        )

    query = _apply_employee_view_mode_scope(query, view_mode)
    normalized_employee_type = func.lower(func.trim(func.coalesce(Employee.employee_type, "")))

    raw_type = str(employee_type or "").strip().lower()
    if raw_type and raw_type != "all":
        if raw_type == "none":
            query = query.filter(normalized_employee_type == "")
        elif raw_type == "staff":
            query = query.filter(
                normalized_employee_type.in_(["hodim", "oqituvchi"])
            )
        elif raw_type == "students":
            query = query.filter(normalized_employee_type.in_(["", "oquvchi"]))
        elif raw_type in {"oquvchi", "oqituvchi", "hodim"}:
            query = query.filter(normalized_employee_type == raw_type)
        else:
            raise HTTPException(status_code=422, detail="Xodim turi noto'g'ri")

    return query


def _unique_normalized_names(values: list[Optional[str]]) -> set[str]:
    result: set[str] = set()
    for value in values:
        name = normalize_catalog_name(value)
        if name:
            result.add(name.casefold())
    return result


def _employee_stats_payload(
    db: Session,
    filtered_query,
    *,
    total_employees: int,
    camera_id: Optional[str] = None,
) -> dict:
    if int(total_employees or 0) <= 0:
        return {
            "total_employees": int(total_employees or 0),
            "organization_count": 0,
            "department_count": 0,
            "position_count": 0,
            "camera_count": 0,
        }

    employee_scope = (
        filtered_query
        .with_entities(
            Employee.id.label("employee_id"),
            Employee.organization_id.label("organization_id"),
            Employee.department.label("department"),
            Employee.position.label("position"),
        )
        .subquery()
    )

    org_count = int(
        db.query(func.count(func.distinct(employee_scope.c.organization_id)))
        .scalar()
        or 0
    )

    cam_id = _parse_optional_positive_filter_int(camera_id, field_label="Kamera")
    if cam_id is not None:
        camera_count = 1 if int(total_employees or 0) > 0 else 0
    else:
        camera_count = int(
            db.query(func.count(func.distinct(EmployeeCameraLink.camera_id)))
            .join(employee_scope, employee_scope.c.employee_id == EmployeeCameraLink.employee_id)
            .scalar()
            or 0
        )

    department_names = _unique_normalized_names(
        [
            row[0]
            for row in (
                db.query(employee_scope.c.department)
                .filter(employee_scope.c.department.isnot(None))
                .filter(func.trim(employee_scope.c.department) != "")
                .distinct()
                .all()
            )
        ]
    )
    position_names = _unique_normalized_names(
        [
            row[0]
            for row in (
                db.query(employee_scope.c.position)
                .filter(employee_scope.c.position.isnot(None))
                .filter(func.trim(employee_scope.c.position) != "")
                .distinct()
                .all()
            )
        ]
    )

    return {
        "total_employees": int(total_employees or 0),
        "organization_count": org_count,
        "department_count": len(department_names),
        "position_count": len(position_names),
        "camera_count": camera_count,
    }


def _name_equals(column, name: Optional[str]):
    normalized = normalize_catalog_name(name)
    return func.lower(func.trim(func.coalesce(column, ""))) == str(normalized or "").casefold()


def _department_employee_filter(department: Department):
    return and_(
        Employee.organization_id == int(department.organization_id),
        or_(
            Employee.department_id == int(department.id),
            and_(
                Employee.department_id.is_(None),
                _name_equals(Employee.department, department.name),
            ),
        ),
    )


def _position_employee_filter(position: Position):
    legacy_filter = and_(
        Employee.position_id.is_(None),
        _name_equals(Employee.position, position.name),
    )
    if position.department_id is not None and position.department is not None:
        legacy_filter = and_(
            legacy_filter,
            or_(
                Employee.department_id == int(position.department_id),
                _name_equals(Employee.department, position.department.name),
            ),
        )

    return and_(
        Employee.organization_id == int(position.organization_id),
        or_(
            Employee.position_id == int(position.id),
            legacy_filter,
        ),
    )


def _department_employee_count(db: Session, department: Department) -> int:
    return int(db.query(Employee.id).filter(_department_employee_filter(department)).count() or 0)


def _position_employee_count(db: Session, position: Position) -> int:
    return int(db.query(Employee.id).filter(_position_employee_filter(position)).count() or 0)


def _get_accessible_department_or_raise(request: Request, db: Session, department_id: int) -> Department:
    department = db.query(Department).filter(Department.id == int(department_id)).first()
    if department is None:
        raise HTTPException(status_code=404, detail="Bo'lim topilmadi")
    get_accessible_organization_or_raise(request, db, int(department.organization_id))
    return department


def _get_accessible_position_or_raise(request: Request, db: Session, position_id: int) -> Position:
    position = db.query(Position).filter(Position.id == int(position_id)).first()
    if position is None:
        raise HTTPException(status_code=404, detail="Lavozim topilmadi")
    get_accessible_organization_or_raise(request, db, int(position.organization_id))
    return position


def _ensure_department_name_available(
    db: Session,
    *,
    organization_id: int,
    name: str,
    exclude_id: Optional[int] = None,
) -> None:
    query = db.query(Department.id).filter(
        Department.organization_id == int(organization_id),
        func.lower(func.trim(Department.name)) == str(name).casefold(),
    )
    if exclude_id is not None:
        query = query.filter(Department.id != int(exclude_id))
    if query.first() is not None:
        raise HTTPException(status_code=409, detail="Bu tashkilotda bunday bo'lim allaqachon bor")


def _ensure_position_name_available(
    db: Session,
    *,
    organization_id: int,
    department_id: int,
    name: str,
    exclude_id: Optional[int] = None,
) -> None:
    query = db.query(Position.id).filter(
        Position.organization_id == int(organization_id),
        Position.department_id == int(department_id),
        func.lower(func.trim(Position.name)) == str(name).casefold(),
    )
    if exclude_id is not None:
        query = query.filter(Position.id != int(exclude_id))
    if query.first() is not None:
        raise HTTPException(status_code=409, detail="Bu bo'limda bunday lavozim allaqachon bor")


def _serialize_catalog_position(db: Session, position: Position) -> dict[str, Any]:
    employee_count = _position_employee_count(db, position)
    return {
        "id": int(position.id),
        "name": str(position.name or ""),
        "organization_id": int(position.organization_id),
        "organization_name": str(position.organization.name or "") if position.organization else "",
        "department_id": int(position.department_id) if position.department_id is not None else None,
        "department_name": str(position.department.name or "") if position.department else "",
        "salary_options": position.salary_options,
        "employee_count": employee_count,
        "can_delete": employee_count == 0,
    }


def _serialize_catalog_department(
    db: Session,
    department: Department,
    positions: list[Position],
) -> dict[str, Any]:
    employee_count = _department_employee_count(db, department)
    serialized_positions = [_serialize_catalog_position(db, item) for item in positions]
    return {
        "id": int(department.id),
        "name": str(department.name or ""),
        "organization_id": int(department.organization_id),
        "organization_name": str(department.organization.name or "") if department.organization else "",
        "employee_count": employee_count,
        "position_count": len(serialized_positions),
        "positions": serialized_positions,
        "can_delete": employee_count == 0 and len(serialized_positions) == 0,
    }


def _extract_camera_user_personal_ids(users: list[dict]) -> set[str]:
    result: set[str] = set()

    def _pick_value(obj: dict, *keys: str) -> str:
        for key in keys:
            if key not in obj:
                continue
            value = obj.get(key)
            if isinstance(value, dict):
                nested = _pick_value(value, "value", "employeeNo", "employeeNoString", "personId", "personID", "userID", "userId")
                if nested:
                    return nested
                continue
            text = str(value or "").strip()
            if text:
                return text
        return ""

    for row in users:
        if not isinstance(row, dict):
            continue
        candidate = _pick_value(
            row,
            "employeeNo",
            "employeeNoString",
            "personID",
            "personId",
            "userID",
            "userId",
            "id",
        )
        if candidate:
            result.add(candidate)
    return result


def _employee_filter_options_payload(
    request: Request,
    db: Session,
    organization_id: Optional[str] = None,
    view_mode: Optional[str] = None,
) -> dict:
    allowed_org_ids = _resolve_employee_allowed_org_ids(request, db)
    if not allowed_org_ids:
        return {"organizations": [], "departments": [], "positions": [], "cameras": []}

    org_id = _parse_optional_positive_filter_int(organization_id, field_label="Tashkilot")
    if org_id is not None and org_id not in allowed_org_ids:
        return {"organizations": [], "departments": [], "positions": [], "cameras": []}

    org_filter_ids = [org_id] if org_id is not None else allowed_org_ids
    employee_scope = _apply_employee_view_mode_scope(
        db.query(
            Employee.id.label("employee_id"),
            Employee.organization_id.label("organization_id"),
            Employee.department.label("department"),
            Employee.position.label("position"),
        ).filter(Employee.organization_id.in_(org_filter_ids)),
        view_mode,
    ).subquery()

    org_rows = (
        db.query(Organization.id, Organization.name)
        .join(employee_scope, employee_scope.c.organization_id == Organization.id)
        .distinct()
        .order_by(Organization.id.asc())
        .all()
    )
    org_rows = sorted(org_rows, key=lambda r: (r[1] or "").lower())

    camera_rows = (
        db.query(Device.id, Device.name, Device.organization_id)
        .join(EmployeeCameraLink, EmployeeCameraLink.camera_id == Device.id)
        .join(employee_scope, employee_scope.c.employee_id == EmployeeCameraLink.employee_id)
        .distinct()
        .order_by(Device.id.asc())
        .all()
    )
    camera_rows = sorted(camera_rows, key=lambda r: (r[1] or "").lower())

    dept_rows = (
        db.query(employee_scope.c.organization_id, employee_scope.c.department)
        .filter(employee_scope.c.department.isnot(None))
        .filter(func.trim(employee_scope.c.department) != "")
        .distinct()
        .order_by(employee_scope.c.organization_id.asc())
        .all()
    )
    dept_rows = sorted(dept_rows, key=lambda r: (r[0], (r[1] or "").lower()))

    pos_rows = (
        db.query(employee_scope.c.organization_id, employee_scope.c.department, employee_scope.c.position)
        .filter(employee_scope.c.position.isnot(None))
        .filter(func.trim(employee_scope.c.position) != "")
        .distinct()
        .order_by(employee_scope.c.organization_id.asc())
        .all()
    )
    pos_rows = sorted(pos_rows, key=lambda r: (r[0], (r[1] or "").lower(), (r[2] or "").lower()))

    return {
        "organizations": [{"id": int(row[0]), "name": str(row[1] or "")} for row in org_rows],
        "departments": [
            {"organization_id": int(row[0]), "name": str(row[1] or "")}
            for row in dept_rows
        ],
        "positions": [
            {"organization_id": int(row[0]), "department": str(row[1] or ""), "name": str(row[2] or "")}
            for row in pos_rows
        ],
        "cameras": [
            {"id": int(row[0]), "name": str(row[1] or ""), "organization_id": int(row[2]) if row[2] is not None else None}
            for row in camera_rows
        ],
    }


@router.post("/api/employees/clear-images")
def clear_employee_images(
    request: Request,
    db: Session = Depends(get_db),
    organization_id: int = Body(..., embed=True),
    min_size_kb: float = Body(10.0, embed=True),  # minimum file size threshold in KB
):
    """
    SuperAdmin only: Sifatsiz (juda kichik) xodim rasmlarini o'chiradi.
    Faqat local /static/uploads/... yo'lidagi rasmlarni tekshiradi.
    Rasmni DB dan ham, serverdan ham tozalaydi.
    """
    auth_user = request.session.get("auth_user") or {}
    role = str(auth_user.get("role") or "").strip().lower()
    if role not in {"superadmin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Faqat SuperAdmin uchun ruxsat berilgan")

    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    employees = db.query(Employee).filter(Employee.organization_id == organization_id).all()

    cleared = 0
    skipped = 0
    errors = []
    min_bytes = int(min_size_kb * 1024)

    for emp in employees:
        if not emp.image_url:
            continue

        # Faqat local static fayllarni tekshiramiz
        url = emp.image_url.strip()
        if not url.startswith("/static/") and not url.startswith("static/"):
            skipped += 1
            continue

        # Fayl yo'lini aniqlash
        rel_path = url.lstrip("/")  # "static/uploads/employees/xxx.jpg"
        abs_path = os.path.join(os.path.dirname(__file__), "..", "..", rel_path)
        abs_path = os.path.normpath(abs_path)

        try:
            if not os.path.isfile(abs_path):
                # Fayl yo'q — DB dan ham tozalaymiz
                emp.image_url = None
                db.query(FaceEmbedding).filter(FaceEmbedding.employee_id == emp.id).delete()
                cleared += 1
                continue

            file_size = os.path.getsize(abs_path)
            if file_size < min_bytes:
                # Sifatsiz rasm — faylni o'chirib, DB ni tozalaymiz
                os.remove(abs_path)
                emp.image_url = None
                db.query(FaceEmbedding).filter(FaceEmbedding.employee_id == emp.id).delete()
                cleared += 1
            else:
                skipped += 1
        except Exception as e:
            errors.append({"employee_id": emp.id, "error": str(e)})

    db.commit()

    return {
        "ok": True,
        "cleared": cleared,
        "skipped": skipped,
        "errors": errors,
        "organization": org.name,
    }


@router.get("/api/employees/stats")

def get_employees_stats(
    request: Request,
    db: Session = Depends(get_db),
    organization_id: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    position_id: Optional[int] = Query(None),
    has_access: Optional[bool] = Query(None),
    has_face: Optional[str] = Query(None, description="'yes' yoki 'no'"),
    employee_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """Xodimlar statistikasi: jami, yuz bor/yo'q, bo'limlar, lavozimlar, jins, barcha filtrlar bilan."""
    allowed_org_ids = _resolve_employee_allowed_org_ids(request, db)
    if not allowed_org_ids:
        return {"ok": True, "total": 0, "with_face": 0, "without_face": 0,
                "departments": 0, "positions": 0, "male": 0, "female": 0}

    query = db.query(Employee).filter(Employee.organization_id.in_(allowed_org_ids))

    if organization_id is not None:
        org_obj = db.query(Organization).filter(Organization.uuid == str(organization_id)).first()
        if org_obj is None and str(organization_id).isdigit():
            org_obj = db.query(Organization).filter(Organization.id == int(organization_id)).first()
        if org_obj is not None and int(org_obj.id) in allowed_org_ids:
            query = query.filter(Employee.organization_id == int(org_obj.id))
        else:
            return {"ok": True, "total": 0, "with_face": 0, "without_face": 0,
                    "departments": 0, "positions": 0, "male": 0, "female": 0}

    if department_id is not None:
        query = query.filter(Employee.department_id == int(department_id))

    if position_id is not None:
        query = query.filter(Employee.position_id == int(position_id))

    if has_face is not None:
        if has_face.lower() == 'yes':
            query = query.filter(Employee.image_url.isnot(None), Employee.image_url != "")
        elif has_face.lower() == 'no':
            query = query.filter(
                or_(Employee.image_url.is_(None), Employee.image_url == "")
            )

    if has_access is not None:
        query = query.filter(Employee.has_access == has_access)

    type_filter = (employee_type or "").strip().lower()
    if type_filter == "students":
        query = query.filter(func.lower(func.coalesce(Employee.employee_type, "")).in_(["oquvchi", "talaba", "student"]))
    elif type_filter == "staff":
        query = query.filter(
            or_(
                Employee.employee_type.is_(None),
                func.trim(Employee.employee_type) == "",
                func.lower(func.trim(Employee.employee_type)).in_(
                    ["hodim", "oqituvchi", "employee", "staff", "teacher"]
                ),
            )
        )
    elif type_filter:
        query = query.filter(func.lower(func.trim(Employee.employee_type)) == type_filter)

    search_clean = (search or "").strip().lower()
    if search_clean:
        like = f"%{search_clean}%"
        query = query.filter(
            or_(
                func.lower(Employee.first_name).like(like),
                func.lower(Employee.last_name).like(like),
                func.lower(Employee.middle_name).like(like),
                func.lower(Employee.personal_id).like(like),
                func.lower(func.coalesce(Employee.department, "")).like(like),
                func.lower(func.coalesce(Employee.position, "")).like(like),
            )
        )

    total = int(query.with_entities(func.count(Employee.id)).scalar() or 0)
    with_face = int(query.filter(Employee.image_url.isnot(None), Employee.image_url != "").with_entities(func.count(Employee.id)).scalar() or 0)
    without_face = total - with_face
    male = int(query.filter(func.lower(func.coalesce(Employee.gender, "")) == "male").with_entities(func.count(Employee.id)).scalar() or 0)
    female = int(query.filter(func.lower(func.coalesce(Employee.gender, "")) == "female").with_entities(func.count(Employee.id)).scalar() or 0)

    # unique departments and positions
    depts_q = query.filter(Employee.department_id.isnot(None)).with_entities(Employee.department_id).distinct()
    departments = int(depts_q.count() or 0)
    pos_q = query.filter(Employee.position_id.isnot(None)).with_entities(Employee.position_id).distinct()
    positions = int(pos_q.count() or 0)

    return {
        "ok": True,
        "total": total,
        "with_face": with_face,
        "without_face": without_face,
        "departments": departments,
        "positions": positions,
        "male": male,
        "female": female,
    }


@router.get("/api/employees")
def get_employees(
    request: Request,
    db: Session = Depends(get_db),
    organization_id: Optional[str] = Query(None),
    department_id: Optional[int] = Query(None),
    position_id: Optional[int] = Query(None),
    has_access: Optional[bool] = Query(None),
    has_face: Optional[str] = Query(None, description="'yes' yoki 'no'"),
    employee_type: Optional[str] = Query(None, description="hodim | oqituvchi | oquvchi | talaba"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    paginate: bool = Query(True, description="False bo'lsa eski format (faqat list) qaytadi"),
):
    """Xodimlar ro'yxati, paginatsiya bilan.

    Backward compatibility: agar `paginate=false` berilsa, eski format (list) qaytadi.
    Aks holda `{ items, total, page, page_size, total_pages }` qaytadi.
    """
    allowed_org_ids = _resolve_employee_allowed_org_ids(request, db)
    if not allowed_org_ids:
        if paginate:
            return {"items": [], "total": 0, "page": 1, "page_size": page_size, "total_pages": 0}
        return []

    query = db.query(Employee).filter(Employee.organization_id.in_(allowed_org_ids))

    if organization_id is not None:
        org_obj = db.query(Organization).filter(Organization.uuid == str(organization_id)).first()
        if org_obj is None and str(organization_id).isdigit():
            org_obj = db.query(Organization).filter(Organization.id == int(organization_id)).first()
        
        if org_obj is not None:
            resolved_org_id = int(org_obj.id)
            if resolved_org_id in allowed_org_ids:
                query = query.filter(Employee.organization_id == resolved_org_id)
            else:
                if paginate:
                    return {"items": [], "total": 0, "page": 1, "page_size": page_size, "total_pages": 0}
                return []
        else:
            if paginate:
                return {"items": [], "total": 0, "page": 1, "page_size": page_size, "total_pages": 0}
            return []

    if department_id is not None:
        query = query.filter(Employee.department_id == int(department_id))

    if position_id is not None:
        query = query.filter(Employee.position_id == int(position_id))

    if has_face is not None:
        if has_face.lower() == 'yes':
            query = query.filter(Employee.image_url.isnot(None), Employee.image_url != "")
        elif has_face.lower() == 'no':
            query = query.filter(
                or_(Employee.image_url.is_(None), Employee.image_url == "")
            )

    if has_access is not None:
        query = query.filter(Employee.has_access == has_access)

    type_filter = (employee_type or "").strip().lower()
    if type_filter == "students":
        query = query.filter(func.lower(func.coalesce(Employee.employee_type, "")).in_(["oquvchi", "talaba", "student"]))
    elif type_filter == "staff":
        # hodim, oqituvchi, employee, staff, teacher yoki tipsiz
        query = query.filter(
            or_(
                Employee.employee_type.is_(None),
                func.trim(Employee.employee_type) == "",
                func.lower(func.trim(Employee.employee_type)).in_(
                    ["hodim", "oqituvchi", "employee", "staff", "teacher"]
                ),
            )
        )
    elif type_filter:
        query = query.filter(func.lower(func.trim(Employee.employee_type)) == type_filter)

    search_clean = (search or "").strip().lower()
    if search_clean:
        like = f"%{search_clean}%"
        query = query.filter(
            or_(
                func.lower(Employee.first_name).like(like),
                func.lower(Employee.last_name).like(like),
                func.lower(Employee.middle_name).like(like),
                func.lower(Employee.personal_id).like(like),
                func.lower(func.coalesce(Employee.department, "")).like(like),
                func.lower(func.coalesce(Employee.position, "")).like(like),
            )
        )

    if not paginate:
        employees = query.order_by(Employee.id.desc()).all()
        return _build_employee_payload(db, employees, allowed_org_ids)

    total = query.with_entities(func.count(Employee.id)).scalar() or 0
    total_pages = (int(total) + int(page_size) - 1) // int(page_size) if total else 0
    safe_page = max(1, min(int(page), total_pages or 1))

    employees = (
        query.order_by(Employee.id.desc())
        .offset((safe_page - 1) * int(page_size))
        .limit(int(page_size))
        .all()
    )
    return {
        "items": _build_employee_payload(db, employees, allowed_org_ids),
        "total": int(total),
        "page": safe_page,
        "page_size": int(page_size),
        "total_pages": int(total_pages),
    }


@router.get("/api/employees/filter-options")
def get_employee_filter_options(
    request: Request,
    organization_id: Optional[str] = Query(None),
    view_mode: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return {
        "ok": True,
        **_employee_filter_options_payload(request, db, organization_id=organization_id, view_mode=view_mode),
    }


@router.get("/api/employee-catalogs")
def get_employee_catalogs_management(
    request: Request,
    organization_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    allowed_org_ids = _resolve_employee_allowed_org_ids(request, db)
    if not allowed_org_ids:
        return {
            "ok": True,
            "organizations": [],
            "departments": [],
            "positions": [],
            "summary": {"organizations": 0, "departments": 0, "positions": 0, "employees": 0},
        }

    org_id = _parse_optional_positive_filter_int(organization_id, field_label="Tashkilot")
    if org_id is not None and org_id not in allowed_org_ids:
        raise HTTPException(status_code=403, detail="Bu tashkilotga ruxsat yo'q")

    org_ids = [org_id] if org_id is not None else allowed_org_ids
    all_organizations = (
        db.query(Organization)
        .filter(Organization.id.in_(allowed_org_ids))
        .order_by(func.lower(Organization.name).asc(), Organization.id.asc())
        .all()
    )
    scoped_organizations = (
        db.query(Organization)
        .filter(Organization.id.in_(org_ids))
        .order_by(func.lower(Organization.name).asc(), Organization.id.asc())
        .all()
    )
    departments = (
        db.query(Department)
        .filter(Department.organization_id.in_(org_ids))
        .order_by(func.lower(Department.name).asc(), Department.id.asc())
        .all()
    )
    positions = (
        db.query(Position)
        .filter(Position.organization_id.in_(org_ids))
        .order_by(func.lower(Position.name).asc(), Position.id.asc())
        .all()
    )
    positions_by_department: dict[int, list[Position]] = {}
    for position in positions:
        if position.department_id is not None:
            positions_by_department.setdefault(int(position.department_id), []).append(position)

    serialized_departments = [
        _serialize_catalog_department(db, department, positions_by_department.get(int(department.id), []))
        for department in departments
    ]
    serialized_positions = [_serialize_catalog_position(db, position) for position in positions]
    employees_count = int(db.query(Employee.id).filter(Employee.organization_id.in_(org_ids)).count() or 0)

    return {
        "ok": True,
        "organizations": [{"id": int(item.id), "name": str(item.name or "")} for item in all_organizations],
        "departments": serialized_departments,
        "positions": serialized_positions,
        "summary": {
            "organizations": len(scoped_organizations),
            "departments": len(serialized_departments),
            "positions": len(serialized_positions),
            "employees": employees_count,
        },
    }


@router.post("/api/employee-catalogs/departments")
def create_catalog_department(
    request: Request,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    organization_id = parse_optional_positive_int((payload or {}).get("organization_id"), field_label="Tashkilot")
    if organization_id is None:
        raise HTTPException(status_code=422, detail="Bo'lim qo'shish uchun tashkilot tanlang")
    org = get_accessible_organization_or_raise(request, db, int(organization_id))
    name = normalize_catalog_name((payload or {}).get("name"))
    if not name:
        raise HTTPException(status_code=422, detail="Bo'lim nomi bo'sh bo'lmasligi kerak")
    _ensure_department_name_available(db, organization_id=int(org.id), name=name)
    department = Department(name=name, organization_id=int(org.id))
    db.add(department)
    db.commit()
    db.refresh(department)
    return {"ok": True, "item": serialize_department_item(department)}


@router.put("/api/employee-catalogs/departments/{department_id}")
def update_catalog_department(
    department_id: int,
    request: Request,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    department = _get_accessible_department_or_raise(request, db, int(department_id))
    name = normalize_catalog_name((payload or {}).get("name"))
    if not name:
        raise HTTPException(status_code=422, detail="Bo'lim nomi bo'sh bo'lmasligi kerak")
    _ensure_department_name_available(
        db,
        organization_id=int(department.organization_id),
        name=name,
        exclude_id=int(department.id),
    )
    old_name = str(department.name or "")
    department.name = name
    db.query(Employee).filter(
        Employee.organization_id == int(department.organization_id),
        or_(
            Employee.department_id == int(department.id),
            and_(Employee.department_id.is_(None), _name_equals(Employee.department, old_name)),
        ),
    ).update(
        {Employee.department: name, Employee.department_id: int(department.id)},
        synchronize_session=False,
    )
    db.commit()
    db.refresh(department)
    return {"ok": True, "item": serialize_department_item(department)}


@router.delete("/api/employee-catalogs/departments/{department_id}")
def delete_catalog_department(
    department_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    department = _get_accessible_department_or_raise(request, db, int(department_id))
    employee_count = _department_employee_count(db, department)
    position_count = int(db.query(Position.id).filter(Position.department_id == int(department.id)).count() or 0)
    if employee_count > 0:
        raise HTTPException(status_code=409, detail="Bu bo'limga xodim birikkan, o'chirish mumkin emas")
    if position_count > 0:
        raise HTTPException(status_code=409, detail="Bu bo'limga lavozimlar birikkan, avval lavozimlarni o'chiring")
    db.delete(department)
    db.commit()
    return {"ok": True, "deleted": True}


@router.post("/api/employee-catalogs/positions")
def create_catalog_position(
    request: Request,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    organization_id = parse_optional_positive_int((payload or {}).get("organization_id"), field_label="Tashkilot")
    department_id = parse_optional_positive_int((payload or {}).get("department_id"), field_label="Bo'lim")
    if organization_id is None:
        raise HTTPException(status_code=422, detail="Lavozim qo'shish uchun tashkilot tanlang")
    if department_id is None:
        raise HTTPException(status_code=422, detail="Lavozim qo'shish uchun bo'lim tanlang")
    org = get_accessible_organization_or_raise(request, db, int(organization_id))
    department = (
        db.query(Department)
        .filter(Department.id == int(department_id), Department.organization_id == int(org.id))
        .first()
    )
    if department is None:
        raise HTTPException(status_code=422, detail="Tanlangan bo'lim shu tashkilotga tegishli emas")
    name = normalize_catalog_name((payload or {}).get("name"))
    if not name:
        raise HTTPException(status_code=422, detail="Lavozim nomi bo'sh bo'lmasligi kerak")
    _ensure_position_name_available(
        db,
        organization_id=int(org.id),
        department_id=int(department.id),
        name=name,
    )
    salary_options = clean_salary_options((payload or {}).get("salary_options"))
    position = Position(
        name=name,
        organization_id=int(org.id),
        department_id=int(department.id),
        salary_options=salary_options
    )
    db.add(position)
    db.commit()
    db.refresh(position)
    return {"ok": True, "item": serialize_position_item(position)}


@router.put("/api/employee-catalogs/positions/{position_id}")
def update_catalog_position(
    position_id: int,
    request: Request,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    position = _get_accessible_position_or_raise(request, db, int(position_id))
    department_id = parse_optional_positive_int((payload or {}).get("department_id"), field_label="Bo'lim")
    if department_id is None:
        raise HTTPException(status_code=422, detail="Lavozim uchun bo'lim tanlang")
    department = (
        db.query(Department)
        .filter(Department.id == int(department_id), Department.organization_id == int(position.organization_id))
        .first()
    )
    if department is None:
        raise HTTPException(status_code=422, detail="Tanlangan bo'lim shu tashkilotga tegishli emas")
    name = normalize_catalog_name((payload or {}).get("name"))
    if not name:
        raise HTTPException(status_code=422, detail="Lavozim nomi bo'sh bo'lmasligi kerak")
    _ensure_position_name_available(
        db,
        organization_id=int(position.organization_id),
        department_id=int(department.id),
        name=name,
        exclude_id=int(position.id),
    )
    if "salary_options" in payload:
        position.salary_options = clean_salary_options(payload.get("salary_options"))
    old_name = str(position.name or "")
    old_department = position.department
    position.name = name
    position.department_id = int(department.id)
    legacy_department_filter = (
        or_(
            Employee.department_id == int(old_department.id),
            _name_equals(Employee.department, old_department.name),
        )
        if old_department
        else true()
    )
    db.query(Employee).filter(
        Employee.organization_id == int(position.organization_id),
        or_(
            Employee.position_id == int(position.id),
            and_(
                Employee.position_id.is_(None),
                _name_equals(Employee.position, old_name),
                legacy_department_filter,
            ),
        ),
    ).update(
        {
            Employee.position: name,
            Employee.position_id: int(position.id),
            Employee.department: str(department.name or ""),
            Employee.department_id: int(department.id),
        },
        synchronize_session=False,
    )
    db.commit()
    db.refresh(position)
    return {"ok": True, "item": serialize_position_item(position)}


@router.delete("/api/employee-catalogs/positions/{position_id}")
def delete_catalog_position(
    position_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    position = _get_accessible_position_or_raise(request, db, int(position_id))
    employee_count = _position_employee_count(db, position)
    if employee_count > 0:
        raise HTTPException(status_code=409, detail="Bu lavozimga xodim birikkan, o'chirish mumkin emas")
    db.delete(position)
    db.commit()
    return {"ok": True, "deleted": True}


@router.get("/api/employees/search")
def search_employees(
    request: Request,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    query: Optional[str] = Query(None),
    view_mode: Optional[str] = Query(None),
    organization_id: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    position: Optional[str] = Query(None),
    camera_id: Optional[str] = Query(None),
    employee_type: Optional[str] = Query(None),
):
    base_query, allowed_org_ids = _employee_list_base_query(request, db)
    if not allowed_org_ids:
        return {
            "ok": True,
            "items": [],
            "page": page,
            "page_size": page_size,
            "total": 0,
            "total_pages": 1,
            "stats": {
                "total_employees": 0,
                "organization_count": 0,
                "department_count": 0,
                "position_count": 0,
                "camera_count": 0,
            },
        }

    filtered_query = _apply_employee_list_filters(
        base_query,
        search=query,
        view_mode=view_mode,
        organization_id=organization_id,
        department=department,
        position=position,
        camera_id=camera_id,
        employee_type=employee_type,
    )
    total = int(filtered_query.count())
    total_pages = max(1, (total + page_size - 1) // page_size)
    current_page = min(page, total_pages)
    employees = (
        filtered_query
        .order_by(
            func.lower(func.coalesce(Employee.first_name, "")).asc(),
            func.lower(func.coalesce(Employee.last_name, "")).asc(),
            func.lower(func.coalesce(Employee.middle_name, "")).asc(),
            Employee.id.desc(),
        )
        .offset((current_page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "ok": True,
        "items": _build_employee_payload(db, employees, allowed_org_ids),
        "page": current_page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "stats": _employee_stats_payload(
            db,
            filtered_query,
            total_employees=total,
            camera_id=camera_id,
        ),
    }


@router.get("/api/employees/personal-id/validate")
def validate_personal_id(
    personal_id: str = Query(..., description="7 xonali personal ID"),
    allow_legacy: bool = Query(False),
    exclude_employee_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    normalized = normalize_personal_id(personal_id)
    if not normalized:
        return {
            "valid": False,
            "available": False,
            "message": "Shaxsiy ID bo'sh bo'lmasligi kerak",
        }
    if not allow_legacy and not PERSONAL_ID_PATTERN.fullmatch(normalized):
        return {
            "valid": False,
            "available": False,
            "message": "Faqat 7 ta raqam kiriting (birinchi raqam 1-9)",
        }
    taken = is_personal_id_taken(db, normalized, exclude_employee_id=exclude_employee_id)
    return {
        "valid": True,
        "available": not taken,
        "message": "ID bo'sh" if not taken else "Bu ID bazada mavjud",
    }


@router.get("/api/employees/personal-id/generate")
def generate_personal_id(db: Session = Depends(get_db)):
    return {"personal_id": generate_unique_personal_id(db)}


# ─── Employee Status Records Endpoints ─────────────────────────────────────
from models import EmployeeStatusRecord
from pydantic import BaseModel
from datetime import date as date_type

class StatusRecordCreate(BaseModel):
    employee_id: int
    status_type: str  # "vacation", "business_trip", "sick_leave", "resigned", "suspended"
    start_date: date_type
    end_date: Optional[date_type] = None
    comment: Optional[str] = None

@router.get("/api/employees/status-records")
def get_status_records(
    employee_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(EmployeeStatusRecord)
    if employee_id is not None:
        query = query.filter(EmployeeStatusRecord.employee_id == employee_id)
    records = query.order_by(EmployeeStatusRecord.start_date.desc()).all()
    
    res = []
    for r in records:
        emp_name = ""
        emp_pos = ""
        if r.employee:
            emp_name = f"{r.employee.last_name or ''} {r.employee.first_name or ''} {r.employee.middle_name or ''}".strip()
            emp_pos = r.employee.position_ref.name if r.employee.position_ref else (r.employee.position or "")
        res.append({
            "id": r.id,
            "uuid": r.uuid,
            "employee_id": r.employee_id,
            "employee_name": emp_name,
            "employee_position": emp_pos,
            "status_type": r.status_type,
            "start_date": r.start_date.isoformat(),
            "end_date": r.end_date.isoformat() if r.end_date else None,
            "comment": r.comment,
            "document_url": r.document_url if hasattr(r, "document_url") else None,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
    return res


@router.get("/api/employees/{emp_id}")
def get_employee(emp_id: str, request: Request, db: Session = Depends(get_db)):
    """Bitta xodim ma'lumotlari (form uchun)."""
    allowed_org_ids = _resolve_employee_allowed_org_ids(request, db)
    if emp_id.isdigit():
        emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    else:
        emp = db.query(Employee).filter(Employee.uuid == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    if allowed_org_ids and emp.organization_id is not None and int(emp.organization_id) not in allowed_org_ids:
        raise HTTPException(status_code=403, detail="Bu xodimga ruxsat yo'q")

    org_rows = (
        db.query(Organization.id, Organization.name)
        .filter(Organization.id.in_(allowed_org_ids))
        .all()
        if allowed_org_ids
        else []
    )
    cam_rows = (
        db.query(Device.id, Device.name)
        .filter(Device.organization_id.in_(allowed_org_ids))
        .all()
        if allowed_org_ids
        else []
    )
    links = (
        db.query(EmployeeCameraLink.employee_id, EmployeeCameraLink.camera_id)
        .filter(EmployeeCameraLink.employee_id == int(emp.id))
        .all()
    )

    org_map = {int(r[0]): str(r[1]) for r in org_rows}
    cam_map = {int(r[0]): str(r[1]) for r in cam_rows}
    camera_map: dict[int, list[int]] = {int(emp.id): []}
    for emp_id_row, cam_id_row in links:
        camera_map[int(emp_id_row)].append(int(cam_id_row))

    return {"ok": True, "item": _serialize_employee_record(emp, org_map, cam_map, camera_map)}


@router.get("/api/employees/{emp_id}/camera-status")
def get_employee_camera_status(
    emp_id: str,
    request: Request,
    organization_id: Optional[str] = Query(None),
    personal_id: Optional[str] = Query(None),
    camera_ids: Optional[str] = Query(None),
    scan_scope: str = Query("linked"),
    db: Session = Depends(get_db),
):
    if emp_id.isdigit():
        emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    else:
        emp = db.query(Employee).filter(Employee.uuid == emp_id).first()
    if emp is None:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    if emp.organization_id is not None:
        get_accessible_organization_or_raise(request, db, int(emp.organization_id))

    effective_personal_id = str(normalize_personal_id(personal_id) or emp.personal_id or "").strip()

    cams_q = db.query(Device)
    if organization_id is not None:
        org_obj = get_accessible_organization_or_raise(request, db, organization_id)
        cams_q = cams_q.filter(Device.organization_id == int(org_obj.id))
    elif emp.organization_id is not None:
        cams_q = cams_q.filter(Device.organization_id == int(emp.organization_id))

    cameras = cams_q.order_by(Device.name.asc(), Device.id.asc()).all()

    requested_camera_ids: Optional[set[int]] = None
    raw_camera_ids = str(camera_ids or "").strip()
    if raw_camera_ids:
        requested_camera_ids = set()
        for part in raw_camera_ids.split(","):
            token = str(part or "").strip()
            if not token:
                continue
            try:
                parsed = int(token)
            except Exception:
                continue
            if parsed > 0:
                requested_camera_ids.add(parsed)
    linked_camera_ids = {
        int(row.camera_id)
        for row in db.query(EmployeeCameraLink.camera_id)
        .filter(EmployeeCameraLink.employee_id == int(emp.id))
        .all()
        if row.camera_id is not None
    }
    cameras_by_id = {int(cam.id): cam for cam in cameras}
    scan_scope_token = str(scan_scope or "linked").strip().lower()
    if scan_scope_token not in {"linked", "organization"}:
        scan_scope_token = "linked"

    if requested_camera_ids:
        check_camera_ids = sorted([cam_id for cam_id in requested_camera_ids if cam_id in cameras_by_id])
    elif scan_scope_token == "organization":
        check_camera_ids = sorted(cameras_by_id.keys())
    else:
        check_camera_ids = sorted([cam_id for cam_id in linked_camera_ids if cam_id in cameras_by_id])

    cameras_to_check = [cameras_by_id[cam_id] for cam_id in check_camera_ids]

    def _check_one_camera(work_item: dict) -> dict:
        status_row = {
            "camera_id": int(work_item.get("camera_id") or 0),
            "camera_name": str(work_item.get("camera_name") or ""),
            "is_online": bool(work_item.get("is_online")),
            "is_linked": bool(work_item.get("is_linked")),
            "checked": True,
            "user_exists": False,
            "face_image_exists": False,
            "face_record_exists": False,
            "status": "unknown",
            "error": "",
        }

        target_id = str(work_item.get("target_id") or "").strip()
        if not target_id:
            status_row["status"] = str(work_item.get("status") or "error")
            status_row["error"] = str(work_item.get("error") or "")
            return status_row

        try:
            face_exists = _camera_face_exists_fast(target_id, effective_personal_id)
            user_exists = bool(face_exists)
            if not user_exists:
                user_exists = _camera_user_exists_fast(target_id, effective_personal_id)

            status_row["user_exists"] = bool(user_exists)
            status_row["face_record_exists"] = bool(face_exists)
            status_row["face_image_exists"] = bool(status_row["face_record_exists"])
            if status_row["face_image_exists"] and not status_row["user_exists"]:
                # Some devices paginate users oddly; if face exists for personal_id, user effectively exists.
                status_row["user_exists"] = True
            status_row["status"] = "ok"
        except HTTPException as exc:
            detail_text = str(exc.detail)
            if _is_not_supported_error(detail_text):
                status_row["status"] = "unsupported"
            else:
                status_row["status"] = "error"
            status_row["error"] = detail_text
        return status_row

    statuses_by_id: dict[int, dict] = {}
    work_items: list[dict] = []
    for cam in cameras_to_check:
        cam_id = int(cam.id)
        base_row = {
            "camera_id": cam_id,
            "camera_name": str(cam.name or ""),
            "is_online": bool(cam.is_online),
            "is_linked": True,
            "target_id": "",
            "status": "unknown",
            "error": "",
        }
        if not effective_personal_id:
            base_row["status"] = "missing_personal_id"
            statuses_by_id[cam_id] = _check_one_camera(base_row)
            continue
        try:
            target_id, _, _ = _resolve_online_command_target(cam)
            base_row["target_id"] = str(target_id or "")
            work_items.append(base_row)
        except HTTPException as exc:
            base_row["status"] = "offline"
            base_row["error"] = str(exc.detail)
            statuses_by_id[cam_id] = _check_one_camera(base_row)

    max_workers = max(1, min(4, len(work_items) or 1))
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        future_map = {pool.submit(_check_one_camera, item): item for item in work_items}
        for future in as_completed(future_map):
            item = future_map[future]
            cam_id = int(item.get("camera_id") or 0)
            try:
                statuses_by_id[cam_id] = future.result()
            except Exception as exc:
                statuses_by_id[cam_id] = {
                    "camera_id": cam_id,
                    "camera_name": str(item.get("camera_name") or ""),
                    "is_online": bool(item.get("is_online")),
                    "is_linked": True,
                    "checked": True,
                    "user_exists": False,
                    "face_image_exists": False,
                    "face_record_exists": False,
                    "status": "error",
                    "error": str(exc),
                }

    statuses: list[dict] = []
    for cam in cameras:
        cam_id = int(cam.id)
        row = statuses_by_id.get(cam_id)
        if row is not None:
            statuses.append(row)
            continue
        statuses.append(
            {
                "camera_id": cam_id,
                "camera_name": str(cam.name or ""),
                "is_online": bool(cam.is_online),
                "is_linked": cam_id in linked_camera_ids,
                "checked": False,
                "user_exists": False,
                "face_image_exists": False,
                "face_record_exists": False,
                "status": "not_linked",
                "error": "",
            }
        )

    summary = {
        "scan_scope": scan_scope_token,
        "total_cameras": len(statuses),
        "linked_cameras": sum(1 for row in statuses if bool(row.get("is_linked"))),
        "checked_cameras": sum(1 for row in statuses if bool(row.get("checked"))),
        "online_cameras": sum(1 for row in statuses if bool(row.get("is_online"))),
        "user_found_cameras": sum(1 for row in statuses if bool(row.get("user_exists"))),
        "face_found_cameras": sum(1 for row in statuses if bool(row.get("face_image_exists") or row.get("face_record_exists"))),
        "complete_cameras": sum(
            1
            for row in statuses
            if bool(row.get("user_exists")) and bool(row.get("face_image_exists") or row.get("face_record_exists"))
        ),
        "issue_cameras": sum(
            1
            for row in statuses
            if str(row.get("status") or "") in {"missing_personal_id", "offline", "unsupported", "error", "timeout"}
        ),
    }

    return {
        "ok": True,
        "employee_id": int(emp.id),
        "personal_id": effective_personal_id,
        "summary": summary,
        "statuses": statuses,
    }


@router.get("/api/organizations/{organization_id}/employee-catalogs")
def get_employee_catalogs(
    organization_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    org = get_accessible_organization_or_raise(request, db, organization_id)
    payload = get_catalog_items_for_org(db, int(org.id))
    return {
        "ok": True,
        "organization": {"id": int(org.id), "name": str(org.name or "")},
        **payload,
    }


@router.post("/api/organizations/{organization_id}/departments")
def create_department(
    organization_id: str,
    request: Request,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    org = get_accessible_organization_or_raise(request, db, organization_id)
    name = normalize_catalog_name((payload or {}).get("name"))
    if not name:
        raise HTTPException(status_code=422, detail="Bo'lim nomi bo'sh bo'lmasligi kerak")
    item = get_or_create_department(db, organization_id=int(org.id), name=name)
    db.commit()
    db.refresh(item)
    return {"ok": True, "item": serialize_department_item(item)}


@router.post("/api/organizations/{organization_id}/positions")
def create_position(
    organization_id: str,
    request: Request,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    org = get_accessible_organization_or_raise(request, db, organization_id)
    name = normalize_catalog_name((payload or {}).get("name"))
    department_id = parse_optional_positive_int((payload or {}).get("department_id"), field_label="Bo'lim")
    if not name:
        raise HTTPException(status_code=422, detail="Lavozim nomi bo'sh bo'lmasligi kerak")
    if department_id is None:
        raise HTTPException(status_code=422, detail="Lavozim qo'shish uchun bo'lim tanlanishi kerak")
    department = (
        db.query(Department)
        .filter(Department.id == int(department_id), Department.organization_id == int(org.id))
        .first()
    )
    if department is None:
        raise HTTPException(status_code=422, detail="Tanlangan bo'lim shu tashkilotga tegishli emas")
    item = get_or_create_position(
        db,
        organization_id=int(org.id),
        department_id=int(department.id),
        name=name,
    )
    if "salary_options" in payload:
        item.salary_options = clean_salary_options(payload.get("salary_options"))
    db.commit()
    db.refresh(item)
    return {"ok": True, "item": serialize_position_item(item)}


def sync_employee_to_cameras_bg(
    employee_id: int,
    camera_ids: list[int],
    base_url: str,
):
    """Background task to sync employee and face to multiple cameras."""
    from core.database import SessionLocal
    db = SessionLocal()
    try:
        emp = db.query(Employee).filter(Employee.id == employee_id).first()
        if not emp:
            print(f"[BG SYNC] Employee {employee_id} not found in DB")
            return

        personal_id = str(emp.personal_id or "").strip()
        if not personal_id:
            print(f"[BG SYNC] Employee {employee_id} has no personal_id, cannot sync")
            return

        face_url = None
        if emp.image_url:
            face_url = urljoin(base_url, str(emp.image_url).lstrip("/"))

        for cam_id in camera_ids:
            cam = db.query(Device).filter(Device.id == cam_id).first()
            if not cam:
                print(f"[BG SYNC] Camera {cam_id} not found in DB")
                continue

            try:
                target_id, _, _ = _resolve_online_command_target(cam)
                print(f"[BG SYNC] Pushing user {personal_id} to camera {cam.name or cam.id}")
                
                # 1. Add user
                _send_isup_command_or_raise(
                    target_id,
                    "add_user",
                    {
                        "first_name": str(emp.first_name or ""),
                        "last_name": str(emp.last_name or ""),
                        "personal_id": personal_id,
                    },
                    timeout=12.0,
                )

                # 2. Set face (only if face_url exists)
                if face_url:
                    print(f"[BG SYNC] Pushing face to camera {cam.name or cam.id}")
                    _send_isup_command_or_raise(
                        target_id,
                        "set_face",
                        {
                            "personal_id": personal_id,
                            "face_url": face_url,
                            "allow_http_fallback": True,
                        },
                        timeout=10.0,
                    )
                print(f"[BG SYNC] Sync successful for employee {personal_id} on camera {cam.name or cam.id}")
            except Exception as cam_exc:
                print(f"[BG SYNC ERROR] Failed syncing employee {personal_id} to camera {cam.name or cam.id}: {cam_exc}")
    except Exception as exc:
        print(f"[BG SYNC GLOBAL ERROR] Failed syncing employee {employee_id} to cameras: {exc}")
    finally:
        db.close()


@router.post("/api/employees")
def create_employee(
    request: Request,
    background_tasks: BackgroundTasks,
    first_name: str = Form(...),
    last_name: str = Form(...),
    middle_name: Optional[str] = Form(None),
    personal_id: Optional[str] = Form(None),
    schedule_id: Optional[str] = Form(None),
    schedule_type: Optional[str] = Form(None),
    department_id: Optional[str] = Form(None),
    position_id: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    position: Optional[str] = Form(None),
    employee_type: Optional[str] = Form(None),
    start_time: Optional[str] = Form(None),
    end_time: Optional[str] = Form(None),
    organization_id: Optional[int] = Form(None),
    branch_id: Optional[int] = Form(None),
    camera_ids: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    phone: Optional[str] = Form(None),
    parent_phone: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    district: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    birth_date: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    salary: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    parsed_camera_ids = parse_camera_ids(camera_ids)
    normalized_employee_type = normalize_employee_type(employee_type)
    resolved_org_id = resolve_effective_org_id(request, db, organization_id)
    if resolved_org_id is None:
        raise HTTPException(status_code=422, detail="Xodim/talaba qo'shish uchun tashkilot tanlanishi shart")

    # Auto-assign default branch if none selected
    if resolved_org_id is not None:
        if branch_id is None:
            branches = db.query(Branch).filter(Branch.organization_id == resolved_org_id).order_by(Branch.id).all()
            if not branches:
                org_obj = db.query(Organization).filter(Organization.id == resolved_org_id).first()
                if org_obj:
                    default_branch = Branch(
                        organization_id=resolved_org_id,
                        name="Asosiy filial",
                        address=org_obj.address,
                        latitude=org_obj.latitude,
                        longitude=org_obj.longitude,
                        radius=org_obj.radius or 100,
                    )
                    db.add(default_branch)
                    db.commit()
                    db.refresh(default_branch)
                    branch_id = default_branch.id
            else:
                branch_id = branches[0].id

    # Schedule Type validation & clean
    st = str(schedule_type or "").strip().lower()
    if st not in {"organization", "shift", "individual"}:
        st = "organization"

    if st == "organization":
        schedule_id = None
        start_time = None
        end_time = None
    elif st == "shift":
        start_time = None
        end_time = None
    elif st == "individual":
        schedule_id = None

    schedule_item = _resolve_schedule_selection(
        db,
        organization_id=resolved_org_id,
        schedule_id_raw=schedule_id,
    )
    if isinstance(schedule_item, Schedule) and resolved_org_id is None:
        resolved_org_id = int(schedule_item.organization_id)

    normalized_personal_id = normalize_personal_id(personal_id)
    if normalized_personal_id is None:
        normalized_personal_id = generate_unique_personal_id(db)
    else:
        validate_personal_id_format(normalized_personal_id)
        if is_personal_id_taken(db, normalized_personal_id):
            raise HTTPException(status_code=409, detail="Bu Shaxsiy ID bazada allaqachon mavjud")

    department_item = resolve_department_selection(
        db,
        organization_id=resolved_org_id,
        department_id_raw=department_id,
        department_name_raw=department,
    )
    position_item = resolve_position_selection(
        db,
        organization_id=resolved_org_id,
        department_id=int(department_item.id) if isinstance(department_item, Department) else None,
        position_id_raw=position_id,
        position_name_raw=position,
    )

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
        schedule_id=int(schedule_item.id) if isinstance(schedule_item, Schedule) else None,
        schedule_type=st,
        department_id=int(department_item.id) if isinstance(department_item, Department) else None,
        department=department_item.name if isinstance(department_item, Department) else None,
        position_id=int(position_item.id) if isinstance(position_item, Position) else None,
        position=position_item.name if isinstance(position_item, Position) else None,
        employee_type=normalized_employee_type,
        start_time=start_time,
        end_time=end_time,
        image_url=image_url,
        phone=(phone.strip() if phone else None),
        parent_phone=(parent_phone.strip() if parent_phone else None),
        region=(region.strip() if region else None),
        district=(district.strip() if district else None),
        address=(address.strip() if address else None),
        birth_date=(birth_date.strip() if birth_date else None),
        gender=(gender.strip() if gender else None),
        organization_id=resolved_org_id,
        branch_id=branch_id,
        salary=salary,
    )
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)

    # Auto-create user account: username = personal_id, password = 'bioface'
    if new_emp.personal_id:
        try:
            import bcrypt
            existing_user = db.query(User).filter(User.name == str(new_emp.personal_id)).first()
            if not existing_user:
                hashed_pw = bcrypt.hashpw(b'bioface', bcrypt.gensalt()).decode('utf-8')
                auto_user = User(
                    name=str(new_emp.personal_id),
                    email=f"{new_emp.personal_id}@bioface.local",
                    hashed_password=hashed_pw,
                    role=UserRole.tashkilot_admin,
                    status="active",
                    is_staff=False,
                    organization_id=resolved_org_id,
                    branch_id=branch_id,
                )
                db.add(auto_user)
                db.commit()
        except Exception as _ue:
            print(f"[AUTO USER] Failed to create user for employee {new_emp.personal_id}: {_ue}")

    linked_camera_ids = save_employee_camera_links(
        db,
        employee_id=int(new_emp.id),
        camera_ids=parsed_camera_ids,
        organization_id=resolved_org_id,
    )
    db.commit()

    if linked_camera_ids:
        background_tasks.add_task(
            sync_employee_to_cameras_bg,
            employee_id=int(new_emp.id),
            camera_ids=linked_camera_ids,
            base_url=str(request.base_url),
        )
    if new_emp.image_url:
        trigger_embedding_generation_bg(employee_id=int(new_emp.id))

    return {
        "ok": True,
        "id": new_emp.id,
        "personal_id": new_emp.personal_id,
        "schedule_id": new_emp.schedule_id,
        "camera_ids": linked_camera_ids,
        "message": "Xodim qo'shildi",
    }


@router.put("/api/employees/{emp_id}")
def update_employee(
    emp_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    middle_name: Optional[str] = Form(None),
    personal_id: Optional[str] = Form(None),
    schedule_id: Optional[str] = Form(None),
    schedule_type: Optional[str] = Form(None),
    department_id: Optional[str] = Form(None),
    position_id: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    position: Optional[str] = Form(None),
    employee_type: Optional[str] = Form(None),
    start_time: Optional[str] = Form(None),
    end_time: Optional[str] = Form(None),
    organization_id: Optional[int] = Form(None),
    branch_id: Optional[int] = Form(None),
    camera_ids: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    phone: Optional[str] = Form(None),
    parent_phone: Optional[str] = Form(None),
    region: Optional[str] = Form(None),
    district: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    birth_date: Optional[str] = Form(None),
    gender: Optional[str] = Form(None),
    salary: Optional[int] = Form(None),
    db: Session = Depends(get_db),
):
    if emp_id.isdigit():
        emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    else:
        emp = db.query(Employee).filter(Employee.uuid == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    # Schedule Type validation & clean
    if schedule_type is not None:
        st = str(schedule_type or "").strip().lower()
        if st not in {"organization", "shift", "individual"}:
            st = "organization"
        emp.schedule_type = st
    else:
        st = emp.schedule_type or "organization"

    if st == "organization":
        emp.schedule_id = None
        emp.start_time = None
        emp.end_time = None
        schedule_id = None
        start_time = None
        end_time = None
    elif st == "shift":
        emp.start_time = None
        emp.end_time = None
        start_time = None
        end_time = None
    elif st == "individual":
        emp.schedule_id = None
        schedule_id = None
    if emp.organization_id is not None:
        get_accessible_organization_or_raise(request, db, int(emp.organization_id))

    has_new_image_upload = bool(image and image.filename)
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
        # Shaxsiy ID bir marta yaratilgandan song o'zgartirib bo'lmaydi
        if emp.personal_id:
            pass  # already set — immutable, skip update
        else:
            normalized_personal_id = normalize_personal_id(personal_id)
            if normalized_personal_id is None:
                emp.personal_id = None
            else:
                if is_personal_id_taken(db, normalized_personal_id, exclude_employee_id=emp.id):
                    raise HTTPException(status_code=409, detail="Bu Shaxsiy ID bazada allaqachon mavjud")
                emp.personal_id = normalized_personal_id
    if employee_type is not None:
        emp.employee_type = normalize_employee_type(employee_type)
    if start_time is not None:
        emp.start_time = start_time
    if end_time is not None:
        emp.end_time = end_time
    if phone is not None:
        emp.phone = phone.strip() or None
    if parent_phone is not None:
        emp.parent_phone = parent_phone.strip() or None
    if region is not None:
        emp.region = region.strip() or None
    if district is not None:
        emp.district = district.strip() or None
    if address is not None:
        emp.address = address.strip() or None
    if birth_date is not None:
        emp.birth_date = birth_date.strip() or None
    if gender is not None:
        emp.gender = gender.strip() or None
    if salary is not None:
        emp.salary = salary if salary != 0 else None

    original_org_id = int(emp.organization_id) if emp.organization_id is not None else None
    original_department_id = int(emp.department_id) if emp.department_id is not None else None
    resolved_org_id = original_org_id
    if organization_id is not None:
        resolved_org_id = resolve_effective_org_id(request, db, organization_id)
        emp.organization_id = resolved_org_id
    if resolved_org_id is None:
        raise HTTPException(status_code=422, detail="Xodim/talaba uchun tashkilot tanlanishi shart")
    org_changed = resolved_org_id != original_org_id

    if branch_id is not None:
        emp.branch_id = branch_id
    elif org_changed:
        # Organization changed, auto-assign first branch of the new organization
        branches = db.query(Branch).filter(Branch.organization_id == resolved_org_id).order_by(Branch.id).all()
        if not branches:
            org_obj = db.query(Organization).filter(Organization.id == resolved_org_id).first()
            if org_obj:
                default_branch = Branch(
                    organization_id=resolved_org_id,
                    name="Asosiy filial",
                    address=org_obj.address,
                    latitude=org_obj.latitude,
                    longitude=org_obj.longitude,
                    radius=org_obj.radius or 100,
                )
                db.add(default_branch)
                db.commit()
                db.refresh(default_branch)
                emp.branch_id = default_branch.id
        else:
            emp.branch_id = branches[0].id

    schedule_item = _resolve_schedule_selection(
        db,
        organization_id=resolved_org_id,
        schedule_id_raw=schedule_id,
        allow_unset=True,
    )
    if isinstance(schedule_item, Schedule) and resolved_org_id is None:
        resolved_org_id = int(schedule_item.organization_id)
        emp.organization_id = resolved_org_id
        org_changed = resolved_org_id != original_org_id
    if schedule_item is UNSET:
        if org_changed and emp.schedule_id is not None:
            current_schedule = db.query(Schedule).filter(Schedule.id == int(emp.schedule_id)).first()
            if current_schedule is None or int(current_schedule.organization_id) != int(resolved_org_id or 0):
                emp.schedule_id = None
    else:
        emp.schedule_id = int(schedule_item.id) if isinstance(schedule_item, Schedule) else None

    department_item = resolve_department_selection(
        db,
        organization_id=resolved_org_id,
        department_id_raw=department_id,
        department_name_raw=department,
        allow_unset=True,
    )
    if department_item is UNSET:
        if org_changed:
            emp.department_id = None
            emp.department = None
    else:
        emp.department_id = int(department_item.id) if isinstance(department_item, Department) else None
        emp.department = department_item.name if isinstance(department_item, Department) else None
    current_department_id = int(emp.department_id) if emp.department_id is not None else None
    department_changed = current_department_id != original_department_id

    position_item = resolve_position_selection(
        db,
        organization_id=resolved_org_id,
        department_id=current_department_id,
        position_id_raw=position_id,
        position_name_raw=position,
        allow_unset=True,
    )
    if position_item is UNSET:
        if org_changed or department_changed:
            emp.position_id = None
            emp.position = None
    else:
        emp.position_id = int(position_item.id) if isinstance(position_item, Position) else None
        emp.position = position_item.name if isinstance(position_item, Position) else None

    linked_camera_ids: Optional[list[int]] = None
    if camera_ids is not None:
        parsed_camera_ids = parse_camera_ids(camera_ids)
        linked_camera_ids = save_employee_camera_links(
            db,
            employee_id=int(emp.id),
            camera_ids=parsed_camera_ids,
            organization_id=resolved_org_id,
        )
    # Auto-create user account if missing: username = personal_id, password = 'bioface'
    if emp.personal_id:
        try:
            import bcrypt
            existing_user = db.query(User).filter(User.name == str(emp.personal_id)).first()
            if not existing_user:
                hashed_pw = bcrypt.hashpw(b'bioface', bcrypt.gensalt()).decode('utf-8')
                auto_user = User(
                    name=str(emp.personal_id),
                    email=f"{emp.personal_id}@bioface.local",
                    hashed_password=hashed_pw,
                    role=UserRole.tashkilot_admin,
                    status="active",
                    is_staff=False,
                    organization_id=resolved_org_id,
                    branch_id=emp.branch_id,
                )
                db.add(auto_user)
        except Exception as _ue:
            print(f"[AUTO USER] Failed to create user for employee {emp.personal_id} in update: {_ue}")

    db.commit()

    if emp.image_url:
        trigger_embedding_generation_bg(employee_id=int(emp.id))

    if linked_camera_ids is not None:
        personal_id = str(emp.personal_id or "").strip()
        if linked_camera_ids and not personal_id:
            raise HTTPException(status_code=422, detail="Kameraga saqlash uchun Shaxsiy ID majburiy")

    if linked_camera_ids:
        background_tasks.add_task(
            sync_employee_to_cameras_bg,
            employee_id=int(emp.id),
            camera_ids=linked_camera_ids,
            base_url=str(request.base_url),
        )

    payload = {"ok": True, "message": "Xodim yangilandi"}
    if linked_camera_ids is not None:
        payload["camera_ids"] = linked_camera_ids
        payload["camera_sync"] = {
            "requested": len(linked_camera_ids),
            "synced": 0,
            "failed": 0,
            "details": [],
            "queued": True,
            "message": "Kamera sinxronizatsiyasi fon rejimida boshlandi",
        }
    payload["schedule_id"] = emp.schedule_id
    return payload


@router.delete("/api/employees/{emp_id}")
def delete_employee(
    emp_id: str,
    delete_from_cameras: bool = Query(True),
    camera_ids: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    if emp_id.isdigit():
        emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    else:
        emp = db.query(Employee).filter(Employee.uuid == emp_id).first()
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
            selected_camera_ids = parse_camera_ids(camera_ids)
            linked_camera_ids = [
                int(row.camera_id)
                for row in db.query(EmployeeCameraLink.camera_id)
                .filter(EmployeeCameraLink.employee_id == emp.id)
                .all()
            ]
            if linked_camera_ids:
                base_cameras = db.query(Device).filter(Device.id.in_(linked_camera_ids)).order_by(Device.id).all()
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

    details = camera_sync["details"]
    camera_sync["details"] = details[:10]
    if len(details) > 10:
        camera_sync["details_truncated"] = len(details) - 10

    return {"ok": True, "message": message, "camera_sync": camera_sync}


# ─── Mobile Geo + Face Attendance Check-in ──────────────────────────

_face_analysis_app = None

def get_face_analysis_app():
    global _face_analysis_app
    if _face_analysis_app is None:
        import onnxruntime
        from insightface.app import FaceAnalysis

        # Locate site-packages of the virtual environment to find NVIDIA library paths
        import os
        import sys
        venv_path = sys.prefix
        site_packages = os.path.join(venv_path, "lib", "python3.12", "site-packages")
        nvidia_dir = os.path.join(site_packages, "nvidia")

        nvidia_libs = []
        if os.path.exists(nvidia_dir):
            for folder in os.listdir(nvidia_dir):
                lib_path = os.path.join(nvidia_dir, folder, "lib")
                if os.path.exists(lib_path):
                    nvidia_libs.append(lib_path)

        if nvidia_libs:
            additional = ":".join(nvidia_libs)
            current_ld = os.environ.get("LD_LIBRARY_PATH", "")
            if current_ld:
                os.environ["LD_LIBRARY_PATH"] = additional + ":" + current_ld
            else:
                os.environ["LD_LIBRARY_PATH"] = additional

        available = onnxruntime.get_available_providers()
        if "CUDAExecutionProvider" in available:
            try:
                app = FaceAnalysis(name="buffalo_l", providers=["CUDAExecutionProvider"])
                app.prepare(ctx_id=0, det_size=(640, 640))
                _face_analysis_app = app
            except Exception:
                app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
                app.prepare(ctx_id=-1, det_size=(640, 640))
                _face_analysis_app = app
        else:
            app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
            app.prepare(ctx_id=-1, det_size=(640, 640))
            _face_analysis_app = app

    return _face_analysis_app


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    import math
    R = 6371000.0  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


@router.post("/api/employees/mobile-checkin")
async def mobile_checkin(
    request: Request,
    employee_id: int = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    check_type: str = Form("in"),
    mobile_device_id: str = Form(None),
    device_uuid: str = Form(None),
    image: UploadFile = File(None),
    image_base64: str = Form(None),
    db: Session = Depends(get_db),
):
    from models import FaceEmbedding, AttendanceLog
    from utils.time_utils import now_tashkent

    # 0. Rate Limiting — brute-force himoya
    _check_checkin_rate_limit(employee_id)

    # 1. Fetch Employee
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    mobile_device = (
        str(mobile_device_id or "").strip()
        or str(device_uuid or "").strip()
        or str(request.headers.get("X-Device-ID") or "").strip()
        or str(request.headers.get("X-Mobile-Device-ID") or "").strip()
    )
    if not mobile_device:
        # Avtomatik fallback: Mobil ilova yoki Web-dan qurilma ID kelmaganda ham xodim ID-sidan foydalanib o'tkazadi
        mobile_device = f"device_emp_{emp.personal_id or emp.id}"

    # 2. Verify Geofence (Branch / Organization Location)
    if latitude == 0.0 and longitude == 0.0:
        raise HTTPException(status_code=400, detail="Qurilmadan GPS koordinatalari olinmadi. GPS-ni yoqing va qayta urinib ko'ring.")

    branch = db.query(Branch).filter(Branch.id == emp.branch_id).first() if emp.branch_id else None
    org = db.query(Organization).filter(Organization.id == emp.organization_id).first() if emp.organization_id else None

    target_lat = None
    target_lng = None
    base_radius = 100.0

    if branch and branch.latitude is not None and branch.longitude is not None:
        target_lat = float(branch.latitude)
        target_lng = float(branch.longitude)
        base_radius = float(branch.radius or 100.0)
    elif org and org.latitude is not None and org.longitude is not None:
        target_lat = float(org.latitude)
        target_lng = float(org.longitude)
        base_radius = float(org.radius or 100.0)

    if target_lat is not None and target_lng is not None:
        distance = calculate_haversine_distance(latitude, longitude, target_lat, target_lng)
        radius = base_radius  # Bazada kiritilgan aniq radius

        if distance > radius:
            raise HTTPException(
                status_code=403,
                detail=f"⚠️ Siz belgilangan geo-hududda emassiz! Filialgacha masofa: {int(distance)} metr. Ruxsat etilgan radius: {int(radius)} metr."
            )



    # 3. Verify Face Embedding
    existing_emb = db.query(FaceEmbedding).filter(FaceEmbedding.employee_id == employee_id).first()
    if not existing_emb:
        raise HTTPException(status_code=400, detail="Xodimning yuz embedding ma'lumotlari ro'yxatdan o'tmagan")

    # Read uploaded image bytes
    if image_base64:
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]
        try:
            contents = base64.b64decode(image_base64)
        except Exception:
            raise HTTPException(status_code=400, detail="Base64 rasm formati noto'g'ri")
    elif image:
        contents = await image.read()
    else:
        raise HTTPException(status_code=400, detail="Rasm yuborilmadi")

    # Rasm hajmini cheklash (max 10MB)
    MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Rasm hajmi 10MB dan oshmasligi kerak")

    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Yuklangan rasmni o'qib bo'lmadi")

    # Extract embedding
    app = get_face_analysis_app()
    faces = app.get(img)
    if not faces:
        raise HTTPException(status_code=400, detail="Rasmda yuz aniqlanmadi")

    best_face = max(faces, key=lambda x: float(x.det_score or 0.0))
    uploaded_emb = best_face.normed_embedding
    if uploaded_emb is None:
        raise HTTPException(status_code=400, detail="Yuz embedding ma'lumotlarini hisoblab bo'lmadi")

    # Calculate similarity (Cosine Similarity)
    reg_emb = np.array(existing_emb.embedding_data)
    dot_product = np.dot(reg_emb, uploaded_emb)
    norm_reg = np.linalg.norm(reg_emb)
    norm_up = np.linalg.norm(uploaded_emb)
    similarity = float(dot_product / (norm_reg * norm_up))

    # Threshold for buffalo_l similarity.
    # 0.40 — juda past, xavfsizroq chegara: 0.45
    # Yuqori chegara yaxshiroq himoya beradi.
    THRESHOLD = 0.45
    if similarity < THRESHOLD:
        raise HTTPException(
            status_code=401,
            detail=f"Yuz mos kelmadi (o'xshashlik: {similarity:.2f}, minimal: {THRESHOLD})"
        )

    # 4. Save Snapshot & Run Psychology Analysis
    snapshot_url = None
    psychological_state_key = None
    psychological_state_confidence = None
    emotion_scores_json = None
    wellbeing_note_uz = None
    wellbeing_note_ru = None
    wellbeing_note_source = None
    liveness_score = None
    liveness_status = None

    if contents:
        import uuid
        import json
        file_name = f"{uuid.uuid4().hex}.webp"
        file_path = os.path.join("static", "uploads", file_name)
        try:
            from utils.image_utils import compress_to_webp
            webp_bytes = compress_to_webp(contents)
        except Exception:
            webp_bytes = contents
        with open(file_path, "wb") as file_object:
            file_object.write(webp_bytes)
        snapshot_url = f"/static/uploads/{file_name}"

        # Check liveness (anti-spoofing)
        try:
            from utils.liveness_utils import check_liveness
            liveness_score, liveness_status = check_liveness(file_path)
            if liveness_status == "spoof":
                if os.path.exists(file_path):
                    os.remove(file_path)
                raise HTTPException(
                    status_code=400,
                    detail=f"Yuz haqiqiyligi (Liveness) tasdiqlanmadi ({liveness_score * 100:.0f}%). Iltimos, ekrandan yoki qog'ozdan suratga tushirmang!"
                )
        except HTTPException:
            raise
        except Exception as e:
            print("Liveness check error in mobile checkin:", e)

        # Run psychological state / emotion analysis
        try:
            from pathlib import Path
            from routers.cameras_parts.psychology_utils import detect_psychological_profile
            psychological_profile = detect_psychological_profile(Path(file_path))
            psychological_state_key = str(psychological_profile.get("state_key") or "") or None
            psychological_state_confidence = psychological_profile.get("confidence")
            emotion_scores = dict(psychological_profile.get("emotion_scores") or {})
            emotion_scores_json = json.dumps(emotion_scores) if emotion_scores else None
            wellbeing_note_uz = str(psychological_profile.get("profile_text_uz") or "") or None
            wellbeing_note_ru = str(psychological_profile.get("profile_text_ru") or "") or None
            wellbeing_note_source = "ai_vision"
        except Exception:
            pass

    person_id = str(emp.personal_id or "").strip() or None
    person_name = " ".join(
        part for part in [emp.first_name, emp.last_name, emp.middle_name] if part and str(part).strip()
    ).strip() or None

    log = AttendanceLog(
        employee_id=employee_id,
        person_id=person_id,
        person_name=person_name,
        timestamp=now_tashkent(),
        status="aniqlandi",
        direction="mobile_out" if str(check_type or "").lower().strip() == "out" else "mobile_in",
        snapshot_url=snapshot_url,
        psychological_state_key=psychological_state_key,
        psychological_state_confidence=psychological_state_confidence,
        emotion_scores_json=emotion_scores_json,
        wellbeing_note_uz=wellbeing_note_uz,
        wellbeing_note_ru=wellbeing_note_ru,
        wellbeing_note_source=wellbeing_note_source,
        latitude=latitude,
        longitude=longitude,
        attendance_source="mobile",
        mobile_device_id=mobile_device,
        mobile_distance_m=round(distance, 2),
        mobile_similarity=similarity,
        face_confidence=similarity,
        review_status="auto",
        liveness_score=liveness_score,
        liveness_status=liveness_status,
    )
    db.add(log)
    
    # Update employee's last known location on checkin
    emp.last_latitude = latitude
    emp.last_longitude = longitude
    emp.last_location_time = datetime.now()
    
    db.commit()

    return {
        "ok": True,
        "message": "Davomat muvaffaqiyatli qayd etildi",
        "distance": round(distance, 1),
        "similarity": round(similarity, 2),
        "timestamp": log.timestamp.isoformat()
    }


# ─── Employee Status Records Endpoints ─── (GET moved to prevent route conflicts)

@router.post("/api/employees/status-records")
def create_status_record(
    employee_id: int = Form(...),
    status_type: str = Form(...),
    start_date: str = Form(...),
    end_date: Optional[str] = Form(None),
    comment: Optional[str] = Form(None),
    document: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    import os
    import shutil
    import uuid as uuid_lib
    from datetime import datetime as datetime_type

    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
        
    try:
        start_date_parsed = datetime_type.strptime(start_date, "%Y-%m-%d").date()
        end_date_parsed = None
        if end_date and end_date.strip():
            end_date_parsed = datetime_type.strptime(end_date.strip(), "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Sana formati noto'g'ri (YYYY-MM-DD bo'lishi kerak)")

    document_url = None
    if document and document.filename:
        os.makedirs("static/status_documents", exist_ok=True)
        ext = os.path.splitext(document.filename)[1]
        unique_filename = f"{uuid_lib.uuid4()}{ext}"
        file_path = f"static/status_documents/{unique_filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(document.file, buffer)
        document_url = f"/static/status_documents/{unique_filename}"

    rec = EmployeeStatusRecord(
        employee_id=employee_id,
        status_type=status_type,
        start_date=start_date_parsed,
        end_date=end_date_parsed,
        comment=comment,
        document_url=document_url
    )
    db.add(rec)
    
    if status_type == "resigned":
        emp.has_access = False
        
    db.commit()
    return {"ok": True, "id": rec.id, "uuid": rec.uuid, "document_url": document_url}

@router.delete("/api/employees/status-records/{record_id}")
def delete_status_record(
    record_id: int,
    db: Session = Depends(get_db)
):
    rec = db.query(EmployeeStatusRecord).filter(EmployeeStatusRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Ma'lumot topilmadi")
    
    if rec.status_type == "resigned":
        emp = db.query(Employee).filter(Employee.id == rec.employee_id).first()
        if emp:
            emp.has_access = True
            
    db.delete(rec)
    db.commit()
    return {"ok": True}
