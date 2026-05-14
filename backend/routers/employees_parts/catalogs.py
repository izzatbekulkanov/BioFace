from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Department, Position

UNSET = object()


def normalize_catalog_name(value: Optional[str]) -> Optional[str]:
    collapsed = " ".join(str(value or "").strip().split())
    return collapsed or None


def parse_optional_positive_int(value: Optional[str], *, field_label: str) -> Optional[int]:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        parsed = int(raw)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"{field_label} ID noto'g'ri") from exc
    if parsed <= 0:
        raise HTTPException(status_code=422, detail=f"{field_label} ID musbat bo'lishi kerak")
    return parsed


def serialize_department_item(item: Department) -> dict[str, Any]:
    return {
        "id": int(item.id),
        "name": str(item.name or ""),
        "organization_id": int(item.organization_id),
    }


def serialize_position_item(item: Position) -> dict[str, Any]:
    return {
        "id": int(item.id),
        "name": str(item.name or ""),
        "organization_id": int(item.organization_id),
        "department_id": int(item.department_id) if item.department_id is not None else None,
    }


def get_catalog_items_for_org(db: Session, organization_id: int) -> dict[str, list[dict[str, Any]]]:
    departments = (
        db.query(Department)
        .filter(Department.organization_id == int(organization_id))
        .order_by(func.lower(Department.name).asc(), Department.id.asc())
        .all()
    )
    positions = (
        db.query(Position)
        .filter(Position.organization_id == int(organization_id))
        .order_by(func.lower(Position.name).asc(), Position.id.asc())
        .all()
    )
    return {
        "departments": [serialize_department_item(item) for item in departments],
        "positions": [serialize_position_item(item) for item in positions],
    }


def get_or_create_department(db: Session, *, organization_id: int, name: str) -> Department:
    normalized_name = normalize_catalog_name(name)
    if not normalized_name:
        raise HTTPException(status_code=422, detail="Bo'lim nomi bo'sh bo'lmasligi kerak")

    item = (
        db.query(Department)
        .filter(
            Department.organization_id == int(organization_id),
            func.lower(func.trim(Department.name)) == normalized_name.casefold(),
        )
        .first()
    )
    if item is not None:
        return item

    item = Department(name=normalized_name, organization_id=int(organization_id))
    db.add(item)
    db.flush()
    return item


def get_or_create_position(
    db: Session,
    *,
    organization_id: int,
    department_id: int,
    name: str,
) -> Position:
    normalized_name = normalize_catalog_name(name)
    if not normalized_name:
        raise HTTPException(status_code=422, detail="Lavozim nomi bo'sh bo'lmasligi kerak")

    item = (
        db.query(Position)
        .filter(
            Position.organization_id == int(organization_id),
            Position.department_id == int(department_id),
            func.lower(func.trim(Position.name)) == normalized_name.casefold(),
        )
        .first()
    )
    if item is not None:
        return item

    item = Position(
        name=normalized_name,
        organization_id=int(organization_id),
        department_id=int(department_id),
    )
    db.add(item)
    db.flush()
    return item


def resolve_department_selection(
    db: Session,
    *,
    organization_id: Optional[int],
    department_id_raw: Optional[str],
    department_name_raw: Optional[str],
    allow_unset: bool = False,
) -> Department | None | object:
    if department_id_raw is None and department_name_raw is None:
        return UNSET if allow_unset else None

    department_id = parse_optional_positive_int(department_id_raw, field_label="Bo'lim")
    department_name = normalize_catalog_name(department_name_raw)

    if department_id is None and department_name is None:
        return None
    if organization_id is None:
        raise HTTPException(status_code=422, detail="Bo'lim tanlash uchun avval tashkilotni tanlang")

    if department_id is not None:
        item = (
            db.query(Department)
            .filter(
                Department.id == department_id,
                Department.organization_id == int(organization_id),
            )
            .first()
        )
        if item is None:
            raise HTTPException(status_code=422, detail="Tanlangan bo'lim shu tashkilotga tegishli emas")
        return item

    return get_or_create_department(db, organization_id=int(organization_id), name=department_name)


def resolve_position_selection(
    db: Session,
    *,
    organization_id: Optional[int],
    department_id: Optional[int],
    position_id_raw: Optional[str],
    position_name_raw: Optional[str],
    allow_unset: bool = False,
) -> Position | None | object:
    if position_id_raw is None and position_name_raw is None:
        return UNSET if allow_unset else None

    position_id = parse_optional_positive_int(position_id_raw, field_label="Lavozim")
    position_name = normalize_catalog_name(position_name_raw)

    if position_id is None and position_name is None:
        return None
    if organization_id is None:
        raise HTTPException(status_code=422, detail="Lavozim tanlash uchun avval tashkilotni tanlang")
    if department_id is None:
        raise HTTPException(status_code=422, detail="Lavozim tanlash uchun avval bo'limni tanlang")

    if position_id is not None:
        item = (
            db.query(Position)
            .filter(
                Position.id == position_id,
                Position.organization_id == int(organization_id),
                Position.department_id == int(department_id),
            )
            .first()
        )
        if item is None:
            raise HTTPException(status_code=422, detail="Tanlangan lavozim shu bo'limga tegishli emas")
        return item

    return get_or_create_position(
        db,
        organization_id=int(organization_id),
        department_id=int(department_id),
        name=position_name,
    )
