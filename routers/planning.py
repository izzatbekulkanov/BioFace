from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from attendance_monitor import attendance_monitor, get_attendance_monitor_status
from database import get_db
from models import Employee, Holiday, Schedule, TelegramContact
from routers.employees_parts.common import get_accessible_organization_or_raise, resolve_allowed_org_ids
from schedule_utils import normalize_hhmm, resolve_employee_schedule, serialize_holiday_row, serialize_schedule_row


router = APIRouter()


def _is_super_admin(request: Request) -> bool:
    auth_user = request.session.get("auth_user") or {}
    role = str(auth_user.get("role") or "").strip().lower()
    return role in {"superadmin", "super_admin"}


def _validate_language(value: Optional[str]) -> str:
    normalized = str(value or "uz").strip().lower() or "uz"
    return "ru" if normalized == "ru" else "uz"


def _parse_date_or_raise(value: Optional[str]) -> date:
    raw = str(value or "").strip()
    if not raw:
        raise HTTPException(status_code=422, detail="Sana majburiy")
    try:
        return date.fromisoformat(raw)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Sana formati YYYY-MM-DD bo'lishi kerak") from exc


def _get_schedule_or_raise(db: Session, schedule_id: int) -> Schedule:
    schedule = db.query(Schedule).filter(Schedule.id == int(schedule_id)).first()
    if schedule is None:
        raise HTTPException(status_code=404, detail="Smena topilmadi")
    return schedule


def _get_employee_or_raise(db: Session, employee_id: int) -> Employee:
    employee = db.query(Employee).filter(Employee.id == int(employee_id)).first()
    if employee is None:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    return employee


class SchedulePayload(BaseModel):
    name: str = Field(..., min_length=1)
    start_time: str = "09:00"
    end_time: str = "18:00"
    is_flexible: bool = False


class HolidayPayload(BaseModel):
    title: str = Field(..., min_length=1)
    date: str
    organization_id: Optional[int] = None
    is_weekend: bool = False


class TelegramContactPayload(BaseModel):
    telegram_chat_id: str = Field(..., min_length=1)
    label: Optional[str] = None
    language: Optional[str] = "uz"
    is_active: bool = True


class BulkScheduleAssignPayload(BaseModel):
    employee_ids: list[int] = Field(default_factory=list)
    schedule_id: Optional[int] = None
    clear_overrides: bool = True


def _serialize_shift_row(employee: Employee) -> dict:
    schedule_payload = resolve_employee_schedule(employee)
    source = str(schedule_payload.get("source") or "organization_default")
    return {
        "id": int(employee.id),
        "schedule_id": schedule_payload.get("schedule_id"),
        "schedule_name": schedule_payload.get("schedule_name"),
        "schedule_is_flexible": bool(schedule_payload.get("is_flexible")),
        "start_time": str(schedule_payload.get("start_time") or "09:00"),
        "end_time": str(schedule_payload.get("end_time") or "18:00"),
        "shift_source": "custom" if source == "employee_override" else ("schedule" if source == "schedule" else "organization"),
        "shift_source_label": "Shaxsiy" if source == "employee_override" else ("Smena" if source == "schedule" else "Tashkilot"),
    }


@router.get("/api/organizations/{organization_id}/schedules")
def list_schedules_for_organization(
    organization_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    org = get_accessible_organization_or_raise(request, db, int(organization_id))
    schedules = (
        db.query(
            Schedule,
            func.count(Employee.id).label("employee_count"),
        )
        .outerjoin(Employee, Employee.schedule_id == Schedule.id)
        .filter(Schedule.organization_id == int(org.id))
        .group_by(Schedule.id)
        .order_by(func.lower(Schedule.name).asc(), Schedule.id.asc())
        .all()
    )
    items = []
    for schedule, employee_count in schedules:
        payload = serialize_schedule_row(schedule)
        payload["employee_count"] = int(employee_count or 0)
        items.append(payload)
    return {
        "ok": True,
        "organization": {"id": int(org.id), "name": str(org.name or "")},
        "items": items,
    }


@router.post("/api/organizations/{organization_id}/schedules")
def create_schedule_for_organization(
    organization_id: int,
    request: Request,
    payload: SchedulePayload,
    db: Session = Depends(get_db),
):
    org = get_accessible_organization_or_raise(request, db, int(organization_id))
    name = str(payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Smena nomi bo'sh bo'lmasligi kerak")
    existing = (
        db.query(Schedule.id)
        .filter(
            Schedule.organization_id == int(org.id),
            func.lower(func.trim(Schedule.name)) == name.casefold(),
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Bu tashkilotda shunday smena allaqachon bor")

    item = Schedule(
        name=name,
        start_time=normalize_hhmm(payload.start_time, "09:00"),
        end_time=normalize_hhmm(payload.end_time, "18:00"),
        is_flexible=bool(payload.is_flexible),
        organization_id=int(org.id),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"ok": True, "item": {**serialize_schedule_row(item), "employee_count": 0}}


@router.put("/api/schedules/{schedule_id}")
def update_schedule(
    schedule_id: int,
    request: Request,
    payload: SchedulePayload,
    db: Session = Depends(get_db),
):
    item = _get_schedule_or_raise(db, schedule_id)
    get_accessible_organization_or_raise(request, db, int(item.organization_id))
    name = str(payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Smena nomi bo'sh bo'lmasligi kerak")
    existing = (
        db.query(Schedule.id)
        .filter(
            Schedule.organization_id == int(item.organization_id),
            Schedule.id != int(item.id),
            func.lower(func.trim(Schedule.name)) == name.casefold(),
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Bu tashkilotda shunday smena allaqachon bor")

    item.name = name
    item.start_time = normalize_hhmm(payload.start_time, "09:00")
    item.end_time = normalize_hhmm(payload.end_time, "18:00")
    item.is_flexible = bool(payload.is_flexible)
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    employee_count = int(db.query(Employee.id).filter(Employee.schedule_id == int(item.id)).count() or 0)
    return {"ok": True, "item": {**serialize_schedule_row(item), "employee_count": employee_count}}


@router.delete("/api/schedules/{schedule_id}")
def delete_schedule(
    schedule_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    item = _get_schedule_or_raise(db, schedule_id)
    get_accessible_organization_or_raise(request, db, int(item.organization_id))
    employee_count = int(db.query(Employee.id).filter(Employee.schedule_id == int(item.id)).count() or 0)
    if employee_count > 0:
        raise HTTPException(status_code=409, detail="Bu smenaga xodimlar bog'langan. Avval ulardan ajrating.")
    db.delete(item)
    db.commit()
    return {"ok": True, "message": "Smena o'chirildi"}


@router.post("/api/schedules/bulk-assign")
def bulk_assign_schedule(
    request: Request,
    payload: BulkScheduleAssignPayload,
    db: Session = Depends(get_db),
):
    employee_ids = sorted({int(employee_id) for employee_id in payload.employee_ids if int(employee_id) > 0})
    if not employee_ids:
        raise HTTPException(status_code=422, detail="Kamida bitta xodim tanlanishi kerak")

    employees = (
        db.query(Employee)
        .options(selectinload(Employee.organization), selectinload(Employee.schedule))
        .filter(Employee.id.in_(employee_ids))
        .order_by(Employee.id.asc())
        .all()
    )
    if len(employees) != len(employee_ids):
        raise HTTPException(status_code=404, detail="Ba'zi xodimlar topilmadi")

    organization_ids = {int(employee.organization_id) for employee in employees if employee.organization_id is not None}
    if not organization_ids:
        raise HTTPException(status_code=422, detail="Tanlangan xodimlarda tashkilot bog'lanmagan")

    if payload.schedule_id is not None and len(organization_ids) != 1:
        raise HTTPException(status_code=422, detail="Tayyor smena bir vaqtning o'zida faqat bitta tashkilot uchun qo'llanadi")

    for organization_id in organization_ids:
        get_accessible_organization_or_raise(request, db, int(organization_id))

    schedule_item: Optional[Schedule] = None
    if payload.schedule_id is not None:
        schedule_item = _get_schedule_or_raise(db, int(payload.schedule_id))
        schedule_org_id = int(schedule_item.organization_id)
        if organization_ids != {schedule_org_id}:
            raise HTTPException(status_code=422, detail="Tanlangan smena boshqa tashkilotga tegishli")
        get_accessible_organization_or_raise(request, db, schedule_org_id)

    clear_overrides = bool(payload.clear_overrides)
    for employee in employees:
        employee.schedule_id = int(schedule_item.id) if schedule_item is not None else None
        employee.schedule = schedule_item
        if clear_overrides:
            employee.start_time = None
            employee.end_time = None

    db.commit()

    refreshed = (
        db.query(Employee)
        .options(selectinload(Employee.organization), selectinload(Employee.schedule))
        .filter(Employee.id.in_(employee_ids))
        .order_by(Employee.id.asc())
        .all()
    )
    return {
        "ok": True,
        "updated_count": len(refreshed),
        "schedule": serialize_schedule_row(schedule_item) if schedule_item is not None else None,
        "clear_overrides": clear_overrides,
        "items": [_serialize_shift_row(employee) for employee in refreshed],
    }


@router.get("/api/holidays")
def list_holidays(
    request: Request,
    organization_id: Optional[int] = Query(None),
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
):
    allowed_org_ids = resolve_allowed_org_ids(request, db)
    is_super_admin = _is_super_admin(request)
    if organization_id is not None:
        if organization_id not in allowed_org_ids and not is_super_admin:
            raise HTTPException(status_code=403, detail="Bu tashkilotga ruxsat yo'q")

    query = db.query(Holiday)
    if organization_id is not None:
        query = query.filter(or_(Holiday.organization_id.is_(None), Holiday.organization_id == int(organization_id)))
    elif not is_super_admin:
        if allowed_org_ids:
            query = query.filter(or_(Holiday.organization_id.is_(None), Holiday.organization_id.in_(allowed_org_ids)))
        else:
            query = query.filter(Holiday.organization_id.is_(None))

    if year is not None:
        year_prefix = f"{int(year):04d}"
        query = query.filter(func.strftime("%Y", Holiday.date) == year_prefix)
    if month is not None:
        month_prefix = f"{int(month):02d}"
        query = query.filter(func.strftime("%m", Holiday.date) == month_prefix)

    rows = query.order_by(Holiday.date.asc(), Holiday.organization_id.asc(), Holiday.id.asc()).all()
    return {"ok": True, "items": [serialize_holiday_row(row) for row in rows]}


@router.post("/api/holidays")
def create_holiday(
    request: Request,
    payload: HolidayPayload,
    db: Session = Depends(get_db),
):
    org_id = payload.organization_id
    if org_id is not None:
        get_accessible_organization_or_raise(request, db, int(org_id))
    elif not _is_super_admin(request):
        raise HTTPException(status_code=403, detail="Global bayramni faqat SuperAdmin qo'sha oladi")

    holiday_date = _parse_date_or_raise(payload.date)
    title = str(payload.title or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="Bayram nomi bo'sh bo'lmasligi kerak")

    exists = (
        db.query(Holiday.id)
        .filter(
            Holiday.date == holiday_date,
            func.lower(func.trim(Holiday.title)) == title.casefold(),
            (
                Holiday.organization_id.is_(None)
                if org_id is None
                else Holiday.organization_id == int(org_id)
            ),
        )
        .first()
    )
    if exists is not None:
        raise HTTPException(status_code=409, detail="Bu sana uchun shunday bayram allaqachon mavjud")

    row = Holiday(
        title=title,
        date=holiday_date,
        organization_id=int(org_id) if org_id is not None else None,
        is_weekend=bool(payload.is_weekend),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"ok": True, "item": serialize_holiday_row(row)}


@router.put("/api/holidays/{holiday_id}")
def update_holiday(
    holiday_id: int,
    request: Request,
    payload: HolidayPayload,
    db: Session = Depends(get_db),
):
    row = db.query(Holiday).filter(Holiday.id == int(holiday_id)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Bayram topilmadi")
    if row.organization_id is not None:
        get_accessible_organization_or_raise(request, db, int(row.organization_id))
    elif not _is_super_admin(request):
        raise HTTPException(status_code=403, detail="Global bayramni faqat SuperAdmin tahrirlay oladi")

    new_org_id = int(payload.organization_id) if payload.organization_id is not None else None
    if new_org_id is not None:
        get_accessible_organization_or_raise(request, db, new_org_id)
    elif (row.organization_id is None or row.organization_id is not None) and not _is_super_admin(request):
        raise HTTPException(status_code=403, detail="Global bayramni faqat SuperAdmin tahrirlay oladi")

    holiday_date = _parse_date_or_raise(payload.date)
    title = str(payload.title or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="Bayram nomi bo'sh bo'lmasligi kerak")

    duplicate = (
        db.query(Holiday.id)
        .filter(
            Holiday.id != int(row.id),
            Holiday.date == holiday_date,
            func.lower(func.trim(Holiday.title)) == title.casefold(),
            Holiday.organization_id.is_(None) if new_org_id is None else Holiday.organization_id == int(new_org_id),
        )
        .first()
    )
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="Bu sana uchun shunday bayram allaqachon mavjud")

    row.title = title
    row.date = holiday_date
    row.organization_id = new_org_id
    row.is_weekend = bool(payload.is_weekend)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {"ok": True, "item": serialize_holiday_row(row)}


@router.delete("/api/holidays/{holiday_id}")
def delete_holiday(
    holiday_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    row = db.query(Holiday).filter(Holiday.id == int(holiday_id)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Bayram topilmadi")
    if row.organization_id is not None:
        get_accessible_organization_or_raise(request, db, int(row.organization_id))
    elif not _is_super_admin(request):
        raise HTTPException(status_code=403, detail="Global bayramni faqat SuperAdmin o'chira oladi")
    db.delete(row)
    db.commit()
    return {"ok": True, "message": "Bayram o'chirildi"}


@router.get("/api/employees/{employee_id}/telegram-contacts")
def list_employee_telegram_contacts(
    employee_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    employee = _get_employee_or_raise(db, employee_id)
    if employee.organization_id is not None:
        get_accessible_organization_or_raise(request, db, int(employee.organization_id))
    rows = (
        db.query(TelegramContact)
        .filter(TelegramContact.employee_id == int(employee.id))
        .order_by(TelegramContact.is_active.desc(), TelegramContact.id.asc())
        .all()
    )
    return {
        "ok": True,
        "employee_id": int(employee.id),
        "items": [
            {
                "id": int(row.id),
                "employee_id": int(row.employee_id),
                "telegram_chat_id": str(row.telegram_chat_id or ""),
                "label": str(row.label or ""),
                "language": str(row.language or "uz"),
                "is_active": bool(row.is_active),
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
            for row in rows
        ],
    }


@router.post("/api/employees/{employee_id}/telegram-contacts")
def create_employee_telegram_contact(
    employee_id: int,
    request: Request,
    payload: TelegramContactPayload,
    db: Session = Depends(get_db),
):
    employee = _get_employee_or_raise(db, employee_id)
    if employee.organization_id is not None:
        get_accessible_organization_or_raise(request, db, int(employee.organization_id))
    chat_id = str(payload.telegram_chat_id or "").strip()
    if not chat_id:
        raise HTTPException(status_code=422, detail="Telegram chat ID majburiy")
    exists = (
        db.query(TelegramContact.id)
        .filter(
            TelegramContact.employee_id == int(employee.id),
            TelegramContact.telegram_chat_id == chat_id,
        )
        .first()
    )
    if exists is not None:
        raise HTTPException(status_code=409, detail="Bu Telegram chat ID allaqachon bog'langan")
    row = TelegramContact(
        employee_id=int(employee.id),
        telegram_chat_id=chat_id,
        label=str(payload.label or "").strip() or None,
        language=_validate_language(payload.language),
        is_active=bool(payload.is_active),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "ok": True,
        "item": {
            "id": int(row.id),
            "employee_id": int(row.employee_id),
            "telegram_chat_id": str(row.telegram_chat_id or ""),
            "label": str(row.label or ""),
            "language": str(row.language or "uz"),
            "is_active": bool(row.is_active),
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        },
    }


@router.put("/api/employees/{employee_id}/telegram-contacts/{contact_id}")
def update_employee_telegram_contact(
    employee_id: int,
    contact_id: int,
    request: Request,
    payload: TelegramContactPayload,
    db: Session = Depends(get_db),
):
    employee = _get_employee_or_raise(db, employee_id)
    if employee.organization_id is not None:
        get_accessible_organization_or_raise(request, db, int(employee.organization_id))
    row = (
        db.query(TelegramContact)
        .filter(
            TelegramContact.id == int(contact_id),
            TelegramContact.employee_id == int(employee.id),
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Telegram kontakt topilmadi")
    chat_id = str(payload.telegram_chat_id or "").strip()
    if not chat_id:
        raise HTTPException(status_code=422, detail="Telegram chat ID majburiy")
    duplicate = (
        db.query(TelegramContact.id)
        .filter(
            TelegramContact.employee_id == int(employee.id),
            TelegramContact.id != int(row.id),
            TelegramContact.telegram_chat_id == chat_id,
        )
        .first()
    )
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="Bu Telegram chat ID allaqachon bog'langan")
    row.telegram_chat_id = chat_id
    row.label = str(payload.label or "").strip() or None
    row.language = _validate_language(payload.language)
    row.is_active = bool(payload.is_active)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {
        "ok": True,
        "item": {
            "id": int(row.id),
            "employee_id": int(row.employee_id),
            "telegram_chat_id": str(row.telegram_chat_id or ""),
            "label": str(row.label or ""),
            "language": str(row.language or "uz"),
            "is_active": bool(row.is_active),
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        },
    }


@router.delete("/api/employees/{employee_id}/telegram-contacts/{contact_id}")
def delete_employee_telegram_contact(
    employee_id: int,
    contact_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    employee = _get_employee_or_raise(db, employee_id)
    if employee.organization_id is not None:
        get_accessible_organization_or_raise(request, db, int(employee.organization_id))
    row = (
        db.query(TelegramContact)
        .filter(
            TelegramContact.id == int(contact_id),
            TelegramContact.employee_id == int(employee.id),
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Telegram kontakt topilmadi")
    db.delete(row)
    db.commit()
    return {"ok": True, "message": "Telegram kontakt o'chirildi"}


@router.get("/api/attendance-monitor/status")
def attendance_monitor_status():
    return {"ok": True, "status": get_attendance_monitor_status()}


@router.post("/api/attendance-monitor/run")
def attendance_monitor_run():
    result = attendance_monitor.run_once()
    return {"ok": True, "result": result, "status": get_attendance_monitor_status()}
