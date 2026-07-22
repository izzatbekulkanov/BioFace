from calendar import monthrange
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import AttendanceLog, Device, Employee, EmployeeCameraLink
from utils.schedule_utils import (
    get_expected_end_dt,
    get_expected_start_dt,
    get_late_minutes,
    is_holiday_for_org,
    resolve_employee_schedule,
)
from utils.time_utils import now_tashkent

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
    emp_id: str,
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    db: Session = Depends(get_db),
):
    if emp_id.isdigit():
        emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    else:
        emp = db.query(Employee).filter(Employee.uuid == emp_id).first()
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

    schedule_payload = resolve_employee_schedule(emp)

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

    from models import EmployeeStatusRecord
    from sqlalchemy import or_

    status_records = (
        db.query(EmployeeStatusRecord)
        .filter(
            EmployeeStatusRecord.employee_id == emp.id,
            EmployeeStatusRecord.start_date <= month_end.date(),
            or_(
                EmployeeStatusRecord.end_date == None,
                EmployeeStatusRecord.end_date >= month_start.date()
            )
        )
        .all()
    )

    days: list[dict] = []
    for day_num in range(1, days_in_month + 1):
        day_dt = datetime(target_year, target_month, day_num, 0, 0, 0)
        day_key = day_dt.strftime("%Y-%m-%d")
        day_date_val = day_dt.date()
        is_weekend = day_dt.weekday() == 6
        is_holiday = is_holiday_for_org(db, day_date_val, emp.organization_id) or is_weekend

        # Check for active status record
        active_status = None
        for r in status_records:
            if r.start_date <= day_date_val and (r.end_date is None or r.end_date >= day_date_val):
                active_status = r.status_type
                break

        found = day_map.get(day_key)

        if active_status:
            days.append(
                {
                    "day": day_num,
                    "date": day_key,
                    "present": False,
                    "status": active_status,
                    "event_count": 0,
                    "first_seen": None,
                    "last_seen": None,
                    "expected_time": None,
                    "expected_end_time": None,
                    "late_seconds": 0,
                    "late_minutes": 0,
                    "late_human": "0 daqiqa",
                    "late_human_full": "0 daqiqa",
                    "worked_seconds": 0,
                    "worked_human": "0 daqiqa",
                    "camera_names": [],
                    "is_holiday": is_holiday,
                }
            )
            continue

        if is_holiday and not found:
            days.append(
                {
                    "day": day_num,
                    "date": day_key,
                    "present": False,
                    "status": "holiday",
                    "event_count": 0,
                    "first_seen": None,
                    "last_seen": None,
                    "expected_time": None,
                    "expected_end_time": None,
                    "late_seconds": 0,
                    "late_minutes": 0,
                    "late_human": "0 daqiqa",
                    "late_human_full": "0 daqiqa",
                    "worked_seconds": 0,
                    "worked_human": "0 daqiqa",
                    "camera_names": [],
                    "is_holiday": True,
                }
            )
            continue

        if not found:
            today_date = now_tashkent().date()
            if day_dt.date() > today_date:
                days.append(
                    {
                        "day": day_num,
                        "date": day_key,
                        "present": False,
                        "status": "pending",
                        "event_count": 0,
                        "first_seen": None,
                        "last_seen": None,
                        "expected_time": get_expected_start_dt(emp, day_dt.date()).isoformat(),
                        "expected_end_time": get_expected_end_dt(emp, day_dt.date()).isoformat(),
                        "late_seconds": 0,
                        "late_minutes": 0,
                        "late_human": "0 daqiqa",
                        "late_human_full": "0 daqiqa",
                        "worked_seconds": 0,
                        "worked_human": "0 daqiqa",
                        "camera_names": [],
                    }
                )
            else:
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
                        "expected_time": get_expected_start_dt(emp, day_dt.date()).isoformat(),
                        "expected_end_time": get_expected_end_dt(emp, day_dt.date()).isoformat(),
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
        
        if is_holiday:
            expected_time_val = None
            expected_end_time_val = None
            late_minutes = 0
            late_seconds = 0
            status = "present"
        else:
            expected_time_val = get_expected_start_dt(emp, day_dt.date()).isoformat()
            expected_end_time_val = get_expected_end_dt(emp, day_dt.date()).isoformat()
            expected_end = get_expected_end_dt(emp, day_dt.date())
            if first_seen >= expected_end:
                status = "absent"
                late_minutes = 0
                late_seconds = 0
            else:
                late_minutes = get_late_minutes(emp, day_dt.date(), first_seen)
                late_seconds = late_minutes * 60
                late_minutes = late_seconds // 60
                status = "late" if late_minutes > 0 else "present"

        worked_seconds = max(0, int((last_seen - first_seen).total_seconds()))

        if status == "absent":
            summary["absent_days"] += 1
        else:
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
                "expected_time": expected_time_val,
                "expected_end_time": expected_end_time_val,
                "late_seconds": late_seconds,
                "late_minutes": late_minutes,
                "late_human": _format_duration_human(late_minutes),
                "late_human_full": _format_duration_hms(late_seconds),
                "worked_seconds": worked_seconds,
                "worked_human": _format_duration_hms(worked_seconds),
                "camera_names": sorted(list(found["camera_names"])),
                "is_holiday": is_holiday,
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
            "start_time": schedule_payload.get("start_time") or "09:00",
            "end_time": schedule_payload.get("end_time") or "18:00",
            "schedule_id": schedule_payload.get("schedule_id"),
            "schedule_name": schedule_payload.get("schedule_name"),
            "schedule_is_flexible": bool(schedule_payload.get("is_flexible")),
            "image_url": emp.image_url or "",
            "has_access": bool(emp.has_access),
            "salary": emp.salary,
        },
        "month": {
            "year": target_year,
            "month": target_month,
            "days_in_month": days_in_month,
            "today": now_tashkent().strftime("%Y-%m-%d"),
        },
        "summary": summary,
        "days": days,
        "linked_cameras": linked_list,
    }


@router.get("/api/employees/{emp_id}/logs")
def get_employee_logs(
    emp_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    if emp_id.isdigit():
        emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    else:
        emp = db.query(Employee).filter(Employee.uuid == emp_id).first()
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
            AttendanceLog.direction,
            AttendanceLog.device_id,
            AttendanceLog.latitude,
            AttendanceLog.longitude,
            AttendanceLog.liveness_score,
            AttendanceLog.liveness_status,
            Device.name.label("device_name"),
            Device.direction.label("device_direction"),
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
            "camera_name": str(row.device_name or (emp.branch.name if emp.branch else None) or row.camera_mac or "-"),
            "direction": str(row.direction or row.device_direction or "in"),
            "latitude": row.latitude,
            "longitude": row.longitude,
            "liveness_score": row.liveness_score,
            "liveness_status": row.liveness_status,
        }
        for row in rows
    ]


    # --- Excuse / special-case records for this employee ---
    from models import EmployeeStatusRecord
    _excuse_lbl = {
        "vacation":      {"uz": "Ta'til",         "ru": "Otpusk"},
        "sick_leave":    {"uz": "Kasallik",        "ru": "Bolnichnyy"},
        "business_trip": {"uz": "Xizmat safari",  "ru": "Komandirovka"},
        "suspended":     {"uz": "To'xtatilgan",   "ru": "Otstranyon"},
        "resigned":      {"uz": "Ishdan ketgan",  "ru": "Uvolen"},
        "excuse":        {"uz": "Sababli",        "ru": "Uvazh. prichina"},
        "remote_work":   {"uz": "Masofaviy ish",  "ru": "Udalyonnaya rabota"},
        "day_off":       {"uz": "Dam olish kuni", "ru": "Otgul"},
    }
    _excuse_rows = (
        db.query(EmployeeStatusRecord)
        .filter(EmployeeStatusRecord.employee_id == emp.id)
        .order_by(EmployeeStatusRecord.start_date.desc())
        .all()
    )
    excuse_items = []
    for _er in _excuse_rows:
        _lbl = _excuse_lbl.get(_er.status_type, {"uz": _er.status_type, "ru": _er.status_type})
        excuse_items.append({
            "id":           _er.id,
            "status_type":  _er.status_type,
            "label_uz":     _lbl["uz"],
            "label_ru":     _lbl["ru"],
            "start_date":   _er.start_date.isoformat() if _er.start_date else None,
            "end_date":     _er.end_date.isoformat()   if _er.end_date   else None,
            "comment":      _er.comment or "",
            "document_url": _er.document_url or "",
        })

    return {
        "ok": True,
        "employee_id": int(emp.id),
        "page": safe_page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
        "items": items,
        "excuse_records": excuse_items,
    }


# ─────────────────────────────────────────────────────────────────────────────
# EXCUSE / SPECIAL-CASE RECORDS  (Sababli va maxsus holatlar)
# ─────────────────────────────────────────────────────────────────────────────

_EXCUSE_LABELS = {
    "vacation":      {"uz": "Ta'til",         "ru": "Otpusk"},
    "sick_leave":    {"uz": "Kasallik",        "ru": "Bolnichnyy"},
    "business_trip": {"uz": "Xizmat safari",  "ru": "Komandirovka"},
    "suspended":     {"uz": "To'xtatilgan",   "ru": "Otstranyon"},
    "resigned":      {"uz": "Ishdan ketgan",  "ru": "Uvolen"},
    "excuse":        {"uz": "Sababli",        "ru": "Uvazh. prichina"},
    "remote_work":   {"uz": "Masofaviy ish",  "ru": "Udalyonnaya rabota"},
    "day_off":       {"uz": "Dam olish kuni", "ru": "Otgul"},
}


@router.get("/api/employees/{emp_id}/excuse-records")
def get_excuse_records(
    emp_id: str,
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    from models import EmployeeStatusRecord
    from sqlalchemy import or_

    if emp_id.isdigit():
        emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    else:
        emp = db.query(Employee).filter(Employee.uuid == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    q = db.query(EmployeeStatusRecord).filter(EmployeeStatusRecord.employee_id == emp.id)
    if year and month:
        from datetime import date as date_cls
        from calendar import monthrange as _mr
        _, days_in = _mr(year, month)
        p_start = date_cls(year, month, 1)
        p_end = date_cls(year, month, days_in)
        q = q.filter(
            EmployeeStatusRecord.start_date <= p_end,
            or_(
                EmployeeStatusRecord.end_date == None,
                EmployeeStatusRecord.end_date >= p_start
            )
        )

    records = q.order_by(EmployeeStatusRecord.start_date.desc()).all()
    items = []
    for r in records:
        lbl = _EXCUSE_LABELS.get(r.status_type, {"uz": r.status_type, "ru": r.status_type})
        items.append({
            "id":           r.id,
            "uuid":         r.uuid,
            "status_type":  r.status_type,
            "label_uz":     lbl["uz"],
            "label_ru":     lbl["ru"],
            "start_date":   r.start_date.isoformat() if r.start_date else None,
            "end_date":     r.end_date.isoformat()   if r.end_date   else None,
            "comment":      r.comment or "",
            "document_url": r.document_url or "",
            "created_at":   r.created_at.isoformat() if r.created_at else None,
        })

    return {"ok": True, "total": len(items), "items": items}


@router.post("/api/employees/{emp_id}/excuse-records")
def create_excuse_record(
    emp_id: str,
    payload: dict,
    db: Session = Depends(get_db),
):
    from models import EmployeeStatusRecord
    from datetime import date as date_cls

    if emp_id.isdigit():
        emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    else:
        emp = db.query(Employee).filter(Employee.uuid == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    status_type = payload.get("status_type")
    start_date_str = payload.get("start_date")
    if not status_type or not start_date_str:
        raise HTTPException(status_code=400, detail="status_type va start_date majburiy")

    if status_type not in _EXCUSE_LABELS:
        raise HTTPException(
            status_code=400,
            detail=f"Notogri status_type. Mumkin: {list(_EXCUSE_LABELS.keys())}"
        )

    try:
        start_date = date_cls.fromisoformat(start_date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="start_date formati: YYYY-MM-DD")

    end_date = None
    if payload.get("end_date"):
        try:
            end_date = date_cls.fromisoformat(payload["end_date"])
        except ValueError:
            raise HTTPException(status_code=400, detail="end_date formati: YYYY-MM-DD")

    record = EmployeeStatusRecord(
        employee_id=emp.id,
        status_type=status_type,
        start_date=start_date,
        end_date=end_date,
        comment=payload.get("comment"),
        document_url=payload.get("document_url"),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    lbl = _EXCUSE_LABELS.get(status_type, {"uz": status_type, "ru": status_type})
    return {
        "ok": True,
        "message": "Yozuv muvaffaqiyatli qoshildi",
        "record": {
            "id":           record.id,
            "uuid":         record.uuid,
            "status_type":  record.status_type,
            "label_uz":     lbl["uz"],
            "label_ru":     lbl["ru"],
            "start_date":   record.start_date.isoformat(),
            "end_date":     record.end_date.isoformat() if record.end_date else None,
            "comment":      record.comment or "",
            "document_url": record.document_url or "",
            "created_at":   record.created_at.isoformat() if record.created_at else None,
        }
    }


@router.delete("/api/employees/{emp_id}/excuse-records/{record_id}")
def delete_excuse_record(
    emp_id: str,
    record_id: int,
    db: Session = Depends(get_db),
):
    from models import EmployeeStatusRecord

    if emp_id.isdigit():
        emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    else:
        emp = db.query(Employee).filter(Employee.uuid == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    record = db.query(EmployeeStatusRecord).filter(
        EmployeeStatusRecord.id == record_id,
        EmployeeStatusRecord.employee_id == emp.id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Yozuv topilmadi")

    db.delete(record)
    db.commit()
    return {"ok": True, "message": "Yozuv ochirildi"}
