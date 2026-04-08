from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import SessionLocal, ensure_schema
from models import Employee, EmployeeWellbeingNote
from time_utils import today_tashkent_range


def normalize_personal_id(value: str | None) -> str:
    return (value or "").strip()


def find_employee_by_id(employee_id: int | str | None):
    if employee_id is None:
        return None
    try:
        safe_id = int(employee_id)
    except Exception:
        return None

    ensure_schema()
    with SessionLocal() as db:
        statement = (
            select(Employee)
            .options(selectinload(Employee.organization))
            .where(Employee.id == safe_id)
        )
        return db.execute(statement).scalar_one_or_none()


def find_employee_by_personal_id(personal_id: str | None):
    identifier = normalize_personal_id(personal_id)
    if not identifier:
        return None

    ensure_schema()
    with SessionLocal() as db:
        statement = (
            select(Employee)
            .options(selectinload(Employee.organization))
            .where(Employee.personal_id == identifier)
        )
        return db.execute(statement).scalar_one_or_none()


def get_latest_employee_wellbeing_note(employee_id: int | None):
    if employee_id is None:
        return None

    ensure_schema()
    with SessionLocal() as db:
        statement = (
            select(EmployeeWellbeingNote)
            .where(EmployeeWellbeingNote.employee_id == int(employee_id))
            .order_by(EmployeeWellbeingNote.created_at.desc(), EmployeeWellbeingNote.id.desc())
        )
        return db.execute(statement).scalars().first()


def get_today_employee_wellbeing_note(employee_id: int | None):
    if employee_id is None:
        return None

    start_dt, end_dt = today_tashkent_range()
    ensure_schema()
    with SessionLocal() as db:
        statement = (
            select(EmployeeWellbeingNote)
            .where(
                EmployeeWellbeingNote.employee_id == int(employee_id),
                EmployeeWellbeingNote.created_at >= start_dt,
                EmployeeWellbeingNote.created_at < end_dt,
            )
            .order_by(EmployeeWellbeingNote.created_at.desc(), EmployeeWellbeingNote.id.desc())
        )
        return db.execute(statement).scalars().first()


