from calendar import monthrange
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import AttendanceLog, Device, Employee, EmployeeCameraLink

router = APIRouter()


def _parse_hhmm(value: Optional[str], default_h: int = 9, default_m: int = 0) -> tuple[int, int]:
    text = str(value or "").strip()
    if not text or ":" not in text:
        return default_h, default_m
    try:
        h_raw, m_raw = text.split(":", 1)
        h = max(0, min(23, int(h_raw)))
        m = max(0, min(59, int(m_raw)))
        return h, m
    except Exception:
        return default_h, default_m


def _format_duration_human(total_minutes: int) -> str:
    mins = max(0, int(total_minutes))
    hours, rem = divmod(mins, 60)
    if hours and rem:
        return f"{hours} soat {rem} daqiqa"
    if hours:
        return f"{hours} soat"
    return f"{rem} daqiqa"


def _format_duration_hms(total_seconds: int) -> str:
    secs = max(0, int(total_seconds))
    hours, rem = divmod(secs, 3600)
    mins, sec = divmod(rem, 60)
    parts: list[str] = []
    if hours:
        parts.append(f"{hours} soat")
    if mins:
        parts.append(f"{mins} daqiqa")
    if sec or not parts:
        parts.append(f"{sec} soniya")
    return " ".join(parts)


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
        cam_name = log.device.name if log.device else (log.camera_mac or "Noma'lum kamera")
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
        int(round(summary["total_late_minutes"] / summary["late_days"])) if summary["late_days"] > 0 else 0
    )
    summary["avg_late_seconds"] = (
        int(round(summary["total_late_seconds"] / summary["late_days"])) if summary["late_days"] > 0 else 0
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
            "department_id": emp.department_id,
            "department": emp.department,
            "position_id": emp.position_id,
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
