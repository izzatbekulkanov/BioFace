import os
import shutil
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Optional
from urllib.parse import urljoin

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, Request, UploadFile
from sqlalchemy import String, and_, cast, exists, false, func, or_, true
from sqlalchemy.orm import Session

from database import get_db
from models import Department, Device, Employee, EmployeeCameraLink, Organization, Position, UserOrganizationLink
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

router = APIRouter()


def _resolve_employee_allowed_org_ids(request: Request, db: Session) -> list[int]:
    """Employees list scope: only organizations explicitly linked to the current user."""
    auth_user = request.session.get("auth_user") or {}
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

    return sorted(org_ids)


def _serialize_employee_record(employee: Employee, org_map: dict[int, str], cam_map: dict[int, str], camera_map: dict[int, list[int]]) -> dict:
    return {
        "id": employee.id,
        "personal_id": employee.personal_id,
        "full_name": " ".join([x for x in [employee.first_name, employee.last_name, employee.middle_name] if x]),
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "middle_name": employee.middle_name,
        "department_id": employee.department_id,
        "department": employee.department,
        "position_id": employee.position_id,
        "position": employee.position,
        "employee_type": employee.employee_type,
        "status": "Faol" if employee.has_access else "Ruxsat yo'q",
        "added_date": employee.created_at.strftime("%Y-%m-%d") if employee.created_at else "",
        "start_time": employee.start_time,
        "end_time": employee.end_time,
        "avatar": employee.image_url or "",
        "organization_id": employee.organization_id,
        "organization_name": org_map.get(int(employee.organization_id)) if employee.organization_id is not None else None,
        "camera_ids": camera_map.get(int(employee.id), []),
        "camera_names": [cam_map[cam_id] for cam_id in camera_map.get(int(employee.id), []) if cam_id in cam_map],
    }


def _build_employee_payload(db: Session, employees: list[Employee], allowed_org_ids: list[int]) -> list[dict]:
    employee_ids = [int(emp.id) for emp in employees]
    if not employee_ids:
        return []

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

    org_map = {int(row[0]): str(row[1]) for row in org_rows}
    cam_map = {int(row[0]): str(row[1]) for row in cam_rows}
    camera_map: dict[int, list[int]] = {}
    for emp_id, cam_id in links:
        camera_map.setdefault(int(emp_id), []).append(int(cam_id))
    return [_serialize_employee_record(emp, org_map, cam_map, camera_map) for emp in employees]


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


def _apply_employee_list_filters(
    query,
    *,
    search: Optional[str] = None,
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

    raw_type = str(employee_type or "").strip().lower()
    if raw_type and raw_type != "all":
        if raw_type == "none":
            query = query.filter(func.trim(func.coalesce(Employee.employee_type, "")) == "")
        elif raw_type in {"oquvchi", "oqituvchi", "hodim"}:
            query = query.filter(func.lower(func.coalesce(Employee.employee_type, "")) == raw_type)
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
    allowed_org_ids: list[int],
    *,
    total_employees: int,
    organization_id: Optional[str] = None,
    department: Optional[str] = None,
    position: Optional[str] = None,
    camera_id: Optional[str] = None,
) -> dict:
    org_id = _parse_optional_positive_filter_int(organization_id, field_label="Tashkilot")
    if org_id is not None and org_id not in allowed_org_ids:
        org_filter_ids: list[int] = []
    else:
        org_filter_ids = [org_id] if org_id is not None else allowed_org_ids

    if not org_filter_ids:
        return {
            "total_employees": int(total_employees or 0),
            "organization_count": 0,
            "department_count": 0,
            "position_count": 0,
            "camera_count": 0,
        }

    department_filter = normalize_catalog_name(department)
    if department_filter and department_filter.lower() == "all":
        department_filter = ""
    position_filter = normalize_catalog_name(position)
    if position_filter and position_filter.lower() == "all":
        position_filter = ""

    org_count = int(
        db.query(func.count(Organization.id))
        .filter(Organization.id.in_(org_filter_ids))
        .scalar()
        or 0
    )

    camera_query = db.query(Device.id).filter(Device.organization_id.in_(org_filter_ids))
    cam_id = _parse_optional_positive_filter_int(camera_id, field_label="Kamera")
    if cam_id is not None:
        camera_query = camera_query.filter(Device.id == cam_id)
    camera_count = int(camera_query.count() or 0)

    department_names = _unique_normalized_names(
        [row[0] for row in db.query(Department.name).filter(Department.organization_id.in_(org_filter_ids)).all()]
    )
    department_names.update(
        _unique_normalized_names(
            [
                row[0]
                for row in (
                    db.query(Employee.department)
                    .filter(Employee.organization_id.in_(org_filter_ids))
                    .filter(Employee.department.isnot(None))
                    .filter(func.trim(Employee.department) != "")
                    .distinct()
                    .all()
                )
            ]
        )
    )
    if department_filter:
        department_names = {name for name in department_names if name == department_filter.casefold()}

    position_query = (
        db.query(Position.name)
        .outerjoin(Department, Department.id == Position.department_id)
        .filter(Position.organization_id.in_(org_filter_ids))
    )
    if department_filter:
        position_query = position_query.filter(func.trim(func.coalesce(Department.name, "")) == department_filter)
    position_names = _unique_normalized_names([row[0] for row in position_query.all()])
    legacy_position_query = (
        db.query(Employee.position)
        .filter(Employee.organization_id.in_(org_filter_ids))
        .filter(Employee.position.isnot(None))
        .filter(func.trim(Employee.position) != "")
    )
    if department_filter:
        legacy_position_query = legacy_position_query.filter(
            func.trim(func.coalesce(Employee.department, "")) == department_filter
        )
    position_names.update(
        _unique_normalized_names([row[0] for row in legacy_position_query.distinct().all()])
    )
    if position_filter:
        position_names = {name for name in position_names if name == position_filter.casefold()}

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


def _employee_filter_options_payload(request: Request, db: Session, organization_id: Optional[str] = None) -> dict:
    allowed_org_ids = _resolve_employee_allowed_org_ids(request, db)
    if not allowed_org_ids:
        return {"organizations": [], "departments": [], "positions": [], "cameras": []}

    org_id = _parse_optional_positive_filter_int(organization_id, field_label="Tashkilot")
    if org_id is not None and org_id not in allowed_org_ids:
        return {"organizations": [], "departments": [], "positions": [], "cameras": []}

    org_filter_ids = [org_id] if org_id is not None else allowed_org_ids
    org_rows = (
        db.query(Organization.id, Organization.name)
        .filter(Organization.id.in_(org_filter_ids))
        .order_by(func.lower(Organization.name).asc(), Organization.id.asc())
        .all()
    )
    camera_rows = (
        db.query(Device.id, Device.name, Device.organization_id)
        .filter(Device.organization_id.in_(org_filter_ids))
        .order_by(func.lower(Device.name).asc(), Device.id.asc())
        .all()
    )
    dept_rows = (
        db.query(Employee.organization_id, Employee.department)
        .filter(Employee.organization_id.in_(org_filter_ids))
        .filter(Employee.department.isnot(None))
        .filter(func.trim(Employee.department) != "")
        .distinct()
        .order_by(Employee.organization_id.asc(), func.lower(Employee.department).asc())
        .all()
    )
    pos_rows = (
        db.query(Employee.organization_id, Employee.department, Employee.position)
        .filter(Employee.organization_id.in_(org_filter_ids))
        .filter(Employee.position.isnot(None))
        .filter(func.trim(Employee.position) != "")
        .distinct()
        .order_by(Employee.organization_id.asc(), func.lower(Employee.department).asc(), func.lower(Employee.position).asc())
        .all()
    )
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


@router.get("/api/employees")
def get_employees(request: Request, db: Session = Depends(get_db)):
    allowed_org_ids = _resolve_employee_allowed_org_ids(request, db)
    if not allowed_org_ids:
        return []

    employees = (
        db.query(Employee)
        .filter(Employee.organization_id.in_(allowed_org_ids))
        .order_by(Employee.id.desc())
        .all()
    )
    return _build_employee_payload(db, employees, allowed_org_ids)


@router.get("/api/employees/filter-options")
def get_employee_filter_options(request: Request, organization_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    return {"ok": True, **_employee_filter_options_payload(request, db, organization_id=organization_id)}


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
    position = Position(name=name, organization_id=int(org.id), department_id=int(department.id))
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
            allowed_org_ids,
            total_employees=total,
            organization_id=organization_id,
            department=department,
            position=position,
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


@router.get("/api/employees/{emp_id}/camera-status")
def get_employee_camera_status(
    emp_id: int,
    request: Request,
    organization_id: Optional[int] = Query(None),
    personal_id: Optional[str] = Query(None),
    camera_ids: Optional[str] = Query(None),
    scan_scope: str = Query("linked"),
    db: Session = Depends(get_db),
):
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if emp is None:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    if emp.organization_id is not None:
        get_accessible_organization_or_raise(request, db, int(emp.organization_id))

    effective_personal_id = str(normalize_personal_id(personal_id) or emp.personal_id or "").strip()

    cams_q = db.query(Device)
    if organization_id is not None:
        get_accessible_organization_or_raise(request, db, int(organization_id))
        cams_q = cams_q.filter(Device.organization_id == int(organization_id))
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
    organization_id: int,
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
    organization_id: int,
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
    organization_id: int,
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
    db.commit()
    db.refresh(item)
    return {"ok": True, "item": serialize_position_item(item)}


@router.post("/api/employees")
def create_employee(
    request: Request,
    first_name: str = Form(...),
    last_name: str = Form(...),
    middle_name: Optional[str] = Form(None),
    personal_id: Optional[str] = Form(None),
    department_id: Optional[str] = Form(None),
    position_id: Optional[str] = Form(None),
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
    parsed_camera_ids = parse_camera_ids(camera_ids)
    normalized_employee_type = normalize_employee_type(employee_type)
    resolved_org_id = resolve_effective_org_id(request, db, organization_id)

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
        department_id=int(department_item.id) if isinstance(department_item, Department) else None,
        department=department_item.name if isinstance(department_item, Department) else None,
        position_id=int(position_item.id) if isinstance(position_item, Position) else None,
        position=position_item.name if isinstance(position_item, Position) else None,
        employee_type=normalized_employee_type,
        start_time=start_time,
        end_time=end_time,
        image_url=image_url,
        organization_id=resolved_org_id,
    )
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)

    linked_camera_ids = save_employee_camera_links(
        db,
        employee_id=int(new_emp.id),
        camera_ids=parsed_camera_ids,
        organization_id=resolved_org_id,
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
    request: Request,
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    middle_name: Optional[str] = Form(None),
    personal_id: Optional[str] = Form(None),
    department_id: Optional[str] = Form(None),
    position_id: Optional[str] = Form(None),
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
        normalized_personal_id = normalize_personal_id(personal_id)
        if normalized_personal_id is None:
            emp.personal_id = None
        else:
            if is_personal_id_taken(db, normalized_personal_id, exclude_employee_id=emp_id):
                raise HTTPException(status_code=409, detail="Bu Shaxsiy ID bazada allaqachon mavjud")
            emp.personal_id = normalized_personal_id
    if employee_type is not None:
        emp.employee_type = normalize_employee_type(employee_type)
    if start_time is not None:
        emp.start_time = start_time
    if end_time is not None:
        emp.end_time = end_time

    original_org_id = int(emp.organization_id) if emp.organization_id is not None else None
    original_department_id = int(emp.department_id) if emp.department_id is not None else None
    resolved_org_id = original_org_id
    if organization_id is not None:
        resolved_org_id = resolve_effective_org_id(request, db, organization_id)
        emp.organization_id = resolved_org_id
    org_changed = resolved_org_id != original_org_id

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

    db.commit()

    camera_sync: Optional[dict] = None
    if linked_camera_ids is not None:
        camera_sync = {
            "requested": len(linked_camera_ids),
            "synced": 0,
            "failed": 0,
            "details": [],
        }
        personal_id = str(emp.personal_id or "").strip()
        if linked_camera_ids and not personal_id:
            raise HTTPException(status_code=422, detail="Kameraga saqlash uchun Shaxsiy ID majburiy")

        face_url = None
        if has_new_image_upload and emp.image_url:
            base_url = str(request.base_url)
            face_url = urljoin(base_url, str(emp.image_url).lstrip("/"))

        for cam_id in linked_camera_ids:
            cam = db.query(Device).filter(Device.id == int(cam_id)).first()
            if cam is None:
                camera_sync["failed"] += 1
                camera_sync["details"].append(
                    {
                        "camera_id": int(cam_id),
                        "status": "failed",
                        "error": "Kamera topilmadi",
                    }
                )
                continue

            try:
                target_id, _, _ = _resolve_online_command_target(cam)
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

                if face_url:
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

                camera_sync["synced"] += 1
                camera_sync["details"].append(
                    {
                        "camera_id": int(cam.id),
                        "camera_name": str(cam.name or ""),
                        "status": "synced",
                    }
                )
            except HTTPException as exc:
                camera_sync["failed"] += 1
                camera_sync["details"].append(
                    {
                        "camera_id": int(cam.id),
                        "camera_name": str(cam.name or ""),
                        "status": "failed",
                        "error": str(exc.detail),
                    }
                )

        if camera_sync["failed"] > 0:
            failed_names = ", ".join(
                str(row.get("camera_name") or f"#{row.get('camera_id')}")
                for row in camera_sync["details"]
                if row.get("status") == "failed"
            )
            raise HTTPException(
                status_code=502,
                detail=f"Kameraga saqlashda xatolik: {failed_names}",
            )

    payload = {"ok": True, "message": "Xodim yangilandi"}
    if linked_camera_ids is not None:
        payload["camera_ids"] = linked_camera_ids
    if camera_sync is not None:
        payload["camera_sync"] = camera_sync
    return payload


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
