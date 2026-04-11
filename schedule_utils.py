from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any, Optional

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from models import Employee, Holiday, Schedule


DEFAULT_START_TIME = "09:00"
DEFAULT_END_TIME = "18:00"
ATTENDANCE_GRACE_MINUTES = 15


def normalize_hhmm(value: Optional[str], fallback: str) -> str:
    raw = str(value or "").strip()
    if not raw:
        raw = str(fallback or "").strip()
    if ":" not in raw:
        raw = fallback
    hour, minute = parse_hhmm(raw, fallback=fallback)
    return f"{hour:02d}:{minute:02d}"


def parse_hhmm(value: Optional[str], fallback: str = DEFAULT_START_TIME) -> tuple[int, int]:
    raw = str(value or "").strip() or str(fallback or "").strip() or DEFAULT_START_TIME
    if ":" not in raw:
        raw = fallback or DEFAULT_START_TIME
    try:
        hour_str, minute_str = raw.split(":", 1)
        hour = max(0, min(23, int(hour_str)))
        minute = max(0, min(59, int(minute_str)))
        return hour, minute
    except Exception:
        if raw != fallback:
            return parse_hhmm(fallback, fallback=DEFAULT_START_TIME)
        return 9, 0


def combine_day_and_hhmm(target_day: date | datetime, value: Optional[str], fallback: str) -> datetime:
    if isinstance(target_day, datetime):
        base_day = target_day.date()
    else:
        base_day = target_day
    hour, minute = parse_hhmm(value, fallback=fallback)
    return datetime.combine(base_day, time(hour=hour, minute=minute))


def serialize_schedule_row(schedule: Schedule) -> dict[str, Any]:
    return {
        "id": int(schedule.id),
        "name": str(schedule.name or ""),
        "start_time": normalize_hhmm(schedule.start_time, DEFAULT_START_TIME),
        "end_time": normalize_hhmm(schedule.end_time, DEFAULT_END_TIME),
        "is_flexible": bool(schedule.is_flexible),
        "organization_id": int(schedule.organization_id),
        "created_at": schedule.created_at.isoformat() if schedule.created_at else None,
        "updated_at": schedule.updated_at.isoformat() if schedule.updated_at else None,
    }


def resolve_employee_schedule(employee: Employee) -> dict[str, Any]:
    organization = getattr(employee, "organization", None)
    schedule = getattr(employee, "schedule", None)
    default_start = normalize_hhmm(
        getattr(organization, "default_start_time", None),
        DEFAULT_START_TIME,
    )
    default_end = normalize_hhmm(
        getattr(organization, "default_end_time", None),
        DEFAULT_END_TIME,
    )
    schedule_start = normalize_hhmm(getattr(schedule, "start_time", None), default_start)
    schedule_end = normalize_hhmm(getattr(schedule, "end_time", None), default_end)
    has_override = bool(str(getattr(employee, "start_time", "") or "").strip() or str(getattr(employee, "end_time", "") or "").strip())
    start_time = normalize_hhmm(getattr(employee, "start_time", None), schedule_start)
    end_time = normalize_hhmm(getattr(employee, "end_time", None), schedule_end)
    schedule_name = str(getattr(schedule, "name", "") or "").strip()

    if has_override:
        source = "employee_override"
    elif schedule is not None:
        source = "schedule"
    else:
        source = "organization_default"

    return {
        "schedule_id": int(schedule.id) if schedule is not None and schedule.id is not None else None,
        "schedule_name": schedule_name or ("Asosiy smena" if source == "organization_default" else ""),
        "start_time": start_time,
        "end_time": end_time,
        "default_start_time": default_start,
        "default_end_time": default_end,
        "schedule_start_time": schedule_start,
        "schedule_end_time": schedule_end,
        "is_flexible": bool(getattr(schedule, "is_flexible", False)),
        "has_override": has_override,
        "source": source,
    }


def get_expected_start_dt(employee: Employee, target_day: date | datetime) -> datetime:
    schedule_payload = resolve_employee_schedule(employee)
    return combine_day_and_hhmm(target_day, schedule_payload["start_time"], DEFAULT_START_TIME)


def get_expected_end_dt(employee: Employee, target_day: date | datetime) -> datetime:
    schedule_payload = resolve_employee_schedule(employee)
    return combine_day_and_hhmm(target_day, schedule_payload["end_time"], DEFAULT_END_TIME)


def get_attendance_deadline(employee: Employee, target_day: date | datetime, grace_minutes: int = ATTENDANCE_GRACE_MINUTES) -> datetime:
    schedule_payload = resolve_employee_schedule(employee)
    base_dt = (
        combine_day_and_hhmm(target_day, schedule_payload["end_time"], DEFAULT_END_TIME)
        if schedule_payload["is_flexible"]
        else combine_day_and_hhmm(target_day, schedule_payload["start_time"], DEFAULT_START_TIME)
    )
    return base_dt + timedelta(minutes=max(0, int(grace_minutes or 0)))


def get_late_minutes(employee: Employee, target_day: date | datetime, first_seen: datetime | None) -> int:
    if first_seen is None:
        return 0
    schedule_payload = resolve_employee_schedule(employee)
    if schedule_payload["is_flexible"]:
        return 0
    expected_dt = combine_day_and_hhmm(target_day, schedule_payload["start_time"], DEFAULT_START_TIME)
    return max(0, int((first_seen - expected_dt).total_seconds() // 60))


def is_late_arrival(employee: Employee, target_day: date | datetime, first_seen: datetime | None) -> bool:
    return get_late_minutes(employee, target_day, first_seen) > 0


def serialize_holiday_row(holiday: Holiday) -> dict[str, Any]:
    return {
        "id": int(holiday.id),
        "title": str(holiday.title or ""),
        "date": holiday.date.isoformat() if holiday.date else None,
        "organization_id": int(holiday.organization_id) if holiday.organization_id is not None else None,
        "is_weekend": bool(holiday.is_weekend),
        "created_at": holiday.created_at.isoformat() if holiday.created_at else None,
        "updated_at": holiday.updated_at.isoformat() if holiday.updated_at else None,
    }


def is_holiday_for_org(db: Session, target_day: date, organization_id: Optional[int]) -> bool:
    if target_day is None:
        return False
    query = db.query(Holiday.id).filter(Holiday.date == target_day)
    if organization_id is None:
        query = query.filter(Holiday.organization_id.is_(None))
    else:
        query = query.filter(
            or_(
                Holiday.organization_id.is_(None),
                Holiday.organization_id == int(organization_id),
            )
        )
    return query.first() is not None


def load_holiday_dates(
    db: Session,
    *,
    start_date: date,
    end_date: date,
    organization_ids: Optional[list[int]] = None,
) -> dict[int | None, set[str]]:
    query = db.query(Holiday).filter(
        and_(
            Holiday.date >= start_date,
            Holiday.date <= end_date,
        )
    )
    if organization_ids:
        query = query.filter(
            or_(
                Holiday.organization_id.is_(None),
                Holiday.organization_id.in_(organization_ids),
            )
        )
    rows = query.all()
    payload: dict[int | None, set[str]] = {}
    for row in rows:
        key = int(row.organization_id) if row.organization_id is not None else None
        payload.setdefault(key, set()).add(row.date.isoformat())
    return payload
