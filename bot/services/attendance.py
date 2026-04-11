from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import cast

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import SessionLocal, ensure_schema
from models import AttendanceLog, Employee
from schedule_utils import get_late_minutes, is_holiday_for_org, resolve_employee_schedule


@dataclass(frozen=True)
class DailyAttendanceSummary:
    date_label: str
    total_events: int
    first_seen: datetime | None
    last_seen: datetime | None
    status: str
    late_seconds: int
    worked_seconds: int
    camera_names: list[str]


@dataclass(frozen=True)
class MonthlyAttendanceDay:
    date_label: str
    day: int
    status: str
    first_seen: datetime | None
    last_seen: datetime | None
    late_seconds: int
    worked_seconds: int
    event_count: int
    camera_names: list[str]


@dataclass(frozen=True)
class MonthlyAttendanceSummary:
    year: int
    month: int
    days_in_month: int
    present_days: int
    absent_days: int
    late_days: int
    total_events: int
    total_late_seconds: int
    total_late_minutes: int
    avg_late_seconds: int
    avg_late_minutes: int
    camera_count: int


@dataclass(frozen=True)
class AttendanceDetails:
    employee: Employee
    month_summary: MonthlyAttendanceSummary
    days: list[MonthlyAttendanceDay]
    today_summary: DailyAttendanceSummary | None


def _start_end_of_day(target_day: date) -> tuple[datetime, datetime]:
    start = datetime(target_day.year, target_day.month, target_day.day, 0, 0, 0)
    end = start + timedelta(days=1)
    return start, end


def _parse_time(value: str | None, fallback: str) -> tuple[int, int]:
    raw = (value or fallback or "09:00").strip()
    if ":" not in raw:
        return 9, 0
    hour_str, minute_str = raw.split(":", 1)
    try:
        return max(0, min(23, int(hour_str))), max(0, min(59, int(minute_str)))
    except Exception:
        return 9, 0


def _employee_expected_times(employee: Employee) -> tuple[str, str]:
    schedule_payload = resolve_employee_schedule(employee)
    return (
        str(schedule_payload.get("start_time") or "09:00"),
        str(schedule_payload.get("end_time") or "18:00"),
    )


def get_employee_attendance_details(employee_id: int, target_date: date | None = None) -> AttendanceDetails | None:
    ensure_schema()
    target_date = target_date or date.today()
    month_start = datetime(target_date.year, target_date.month, 1)
    if target_date.month == 12:
        next_month = datetime(target_date.year + 1, 1, 1)
    else:
        next_month = datetime(target_date.year, target_date.month + 1, 1)

    with SessionLocal() as db:
        employee = (
            db.execute(
                select(Employee)
                .options(selectinload(Employee.organization))
                .where(Employee.id == employee_id)
            )
            .scalar_one_or_none()
        )
        if employee is None:
            return None

        start_time, end_time = _employee_expected_times(employee)
        exp_h, exp_m = _parse_time(start_time, "09:00")
        exp_end_h, exp_end_m = _parse_time(end_time, "18:00")

        logs = (
            db.execute(
                select(AttendanceLog)
                .options(selectinload(AttendanceLog.device))
                .where(
                    AttendanceLog.employee_id == employee.id,
                    AttendanceLog.timestamp >= month_start,
                    AttendanceLog.timestamp < next_month,
                )
                .order_by(AttendanceLog.timestamp.asc(), AttendanceLog.id.asc())
            )
            .scalars()
            .all()
        )

        cameras_seen: set[str] = set()
        day_map: dict[str, dict] = defaultdict(
            lambda: {
                "event_count": 0,
                "first_seen": None,
                "last_seen": None,
                "camera_names": set(),
            }
        )
        for log in logs:
            day_key = (log.timestamp or month_start).date().isoformat()
            row = day_map[day_key]
            row["event_count"] += 1
            if row["first_seen"] is None or (log.timestamp and log.timestamp < row["first_seen"]):
                row["first_seen"] = log.timestamp
            if row["last_seen"] is None or (log.timestamp and log.timestamp > row["last_seen"]):
                row["last_seen"] = log.timestamp
            cam_name = log.device.name if log.device and log.device.name else (log.camera_mac or "Noma'lum kamera")
            row["camera_names"].add(str(cam_name))
            cameras_seen.add(str(cam_name))

        days_in_month = (next_month.date() - timedelta(days=1)).day
        present_days = len(day_map)
        total_events = len(logs)
        late_days = 0
        total_late_seconds = 0
        total_late_minutes = 0
        calendar_days: list[MonthlyAttendanceDay] = []

        for day_num in range(1, days_in_month + 1):
            day_dt = datetime(target_date.year, target_date.month, day_num, 0, 0, 0)
            day_key = day_dt.strftime("%Y-%m-%d")
            if is_holiday_for_org(db, day_dt.date(), employee.organization_id):
                calendar_days.append(
                    MonthlyAttendanceDay(
                        date_label=day_key,
                        day=day_num,
                        status="holiday",
                        first_seen=None,
                        last_seen=None,
                        late_seconds=0,
                        worked_seconds=0,
                        event_count=0,
                        camera_names=[],
                    )
                )
                continue
            found = day_map.get(day_key)
            if not found or found["first_seen"] is None or found["last_seen"] is None:
                calendar_days.append(
                    MonthlyAttendanceDay(
                        date_label=day_key,
                        day=day_num,
                        status="absent",
                        first_seen=None,
                        last_seen=None,
                        late_seconds=0,
                        worked_seconds=0,
                        event_count=0,
                        camera_names=[],
                    )
                )
                continue
            expected_dt = day_dt.replace(hour=exp_h, minute=exp_m)
            first_seen = cast(datetime, found["first_seen"])
            late_seconds = max(0, int(get_late_minutes(employee, day_dt.date(), first_seen) * 60))
            worked_seconds = max(0, int((cast(datetime, found["last_seen"]) - first_seen).total_seconds()))
            status = "late" if late_seconds > 0 else "present"
            if late_seconds > 0:
                late_days += 1
                total_late_seconds += late_seconds
                total_late_minutes += late_seconds // 60
            calendar_days.append(
                MonthlyAttendanceDay(
                    date_label=day_key,
                    day=day_num,
                    status=status,
                    first_seen=first_seen,
                    last_seen=cast(datetime, found["last_seen"]),
                    late_seconds=late_seconds,
                    worked_seconds=worked_seconds,
                    event_count=int(found["event_count"]),
                    camera_names=sorted(list(found["camera_names"])),
                )
            )

        today_logs = [log for log in logs if log.timestamp and log.timestamp.date() == target_date]
        today_summary = None
        if today_logs:
            first_seen = cast(datetime, today_logs[0].timestamp)
            last_seen = cast(datetime, today_logs[-1].timestamp)
            expected_dt = datetime(target_date.year, target_date.month, target_date.day, exp_h, exp_m)
            late_seconds = max(0, int(get_late_minutes(employee, target_date, first_seen) * 60))
            worked_seconds = max(0, int((last_seen - first_seen).total_seconds()))
            today_summary = DailyAttendanceSummary(
                date_label=target_date.isoformat(),
                total_events=len(today_logs),
                first_seen=first_seen,
                last_seen=last_seen,
                status="late" if late_seconds > 0 else "present",
                late_seconds=late_seconds,
                worked_seconds=worked_seconds,
                camera_names=sorted(
                    {
                        (log.device.name if log.device and log.device.name else (log.camera_mac or "Noma'lum kamera"))
                        for log in today_logs
                    }
                ),
            )
        else:
            status_value = "holiday" if is_holiday_for_org(db, target_date, employee.organization_id) else "absent"
            today_summary = DailyAttendanceSummary(
                date_label=target_date.isoformat(),
                total_events=0,
                first_seen=None,
                last_seen=None,
                status=status_value,
                late_seconds=0,
                worked_seconds=0,
                camera_names=[],
            )

        month_summary = MonthlyAttendanceSummary(
            year=target_date.year,
            month=target_date.month,
            days_in_month=days_in_month,
            present_days=present_days,
            absent_days=max(
                0,
                days_in_month
                - present_days
                - sum(1 for day in calendar_days if day.status == "holiday"),
            ),
            late_days=late_days,
            total_events=total_events,
            total_late_seconds=total_late_seconds,
            total_late_minutes=total_late_minutes,
            avg_late_seconds=int(round(total_late_seconds / late_days)) if late_days else 0,
            avg_late_minutes=int(round(total_late_minutes / late_days)) if late_days else 0,
            camera_count=len(cameras_seen),
        )
        return AttendanceDetails(employee=employee, month_summary=month_summary, days=calendar_days, today_summary=today_summary)


def get_employee_today_summary(employee_id: int, target_date: date | None = None) -> DailyAttendanceSummary | None:
    details = get_employee_attendance_details(employee_id=employee_id, target_date=target_date)
    return details.today_summary if details else None

