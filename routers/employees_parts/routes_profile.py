from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import AttendanceLog, Device, Employee, EmployeeCameraLink, EmployeePsychologicalState, EmployeeWellbeingNote
from routers.cameras_parts.psychology_utils import (
    EMOTION_DISPLAY_ORDER,
    build_psychological_profile,
    serialize_emotion_scores,
)
from routers.employees_parts.common import (
    infer_state_key_from_labels,
    normalize_psychological_state_source,
    normalize_wellbeing_note_source,
    serialize_psychological_state_row,
)
from schedule_utils import get_late_minutes, is_holiday_for_org, resolve_employee_schedule

router = APIRouter()


def _parse_hhmm(value: Optional[str], default_h: int = 9, default_m: int = 0) -> tuple[int, int]:
    text = str(value or "").strip()
    if not text or ":" not in text:
        return default_h, default_m
    try:
        raw_h, raw_m = text.split(":", 1)
        hour = max(0, min(23, int(raw_h)))
        minute = max(0, min(59, int(raw_m)))
        return hour, minute
    except Exception:
        return default_h, default_m


def _month_bounds(year: int, month: int) -> tuple[datetime, datetime]:
    start = datetime(year, month, 1, 0, 0, 0)
    if month == 12:
        end = datetime(year + 1, 1, 1, 0, 0, 0)
    else:
        end = datetime(year, month + 1, 1, 0, 0, 0)
    return start, end


def _humanize_seconds(total_seconds: int) -> str:
    secs = max(0, int(total_seconds or 0))
    hours = secs // 3600
    mins = (secs % 3600) // 60
    if hours and mins:
        return f"{hours} soat {mins} daqiqa"
    if hours:
        return f"{hours} soat"
    return f"{mins} daqiqa"


def _build_lateness_period(
    db: Session,
    *,
    employee: Employee,
    start_dt: datetime,
    end_dt: datetime,
) -> dict[str, Any]:
    logs = (
        db.query(AttendanceLog)
        .filter(
            AttendanceLog.employee_id == int(employee.id),
            AttendanceLog.timestamp >= start_dt,
            AttendanceLog.timestamp < end_dt,
        )
        .order_by(AttendanceLog.timestamp.asc(), AttendanceLog.id.asc())
        .all()
    )

    first_seen_by_day: dict[str, datetime] = {}
    for log in logs:
        ts = log.timestamp
        if ts is None:
            continue
        day_key = ts.strftime("%Y-%m-%d")
        prev = first_seen_by_day.get(day_key)
        if prev is None or ts < prev:
            first_seen_by_day[day_key] = ts

    late_days = 0
    late_seconds = 0
    for day_key, first_seen in first_seen_by_day.items():
        try:
            base = datetime.strptime(day_key, "%Y-%m-%d")
        except Exception:
            continue
        if is_holiday_for_org(db, base.date(), employee.organization_id):
            continue
        delta = max(0, int(get_late_minutes(employee, base.date(), first_seen) * 60))
        if delta > 0:
            late_days += 1
            late_seconds += delta

    return {
        "from": start_dt.strftime("%Y-%m-%d"),
        "to": (end_dt - timedelta(seconds=1)).strftime("%Y-%m-%d"),
        "event_count": len(logs),
        "attendance_days": len(first_seen_by_day),
        "late_days": int(late_days),
        "late_seconds": int(late_seconds),
        "late_hours": round(float(late_seconds) / 3600.0, 2),
        "late_human": _humanize_seconds(late_seconds),
    }


@router.post("/api/employees/{emp_id}/wellbeing-note")
def save_employee_wellbeing_note(
    emp_id: int,
    note_uz: str = Body(..., embed=True),
    note_ru: str = Body(..., embed=True),
    source: Optional[str] = Body("manual", embed=True),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.id == emp_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    note_uz_clean = str(note_uz or "").strip()
    note_ru_clean = str(note_ru or "").strip()
    if not note_uz_clean or not note_ru_clean:
        raise HTTPException(status_code=422, detail="note_uz va note_ru majburiy")

    source_clean = normalize_wellbeing_note_source(source)
    now_dt = datetime.utcnow()
    row = EmployeeWellbeingNote(
        employee_id=int(employee.id),
        note_uz=note_uz_clean,
        note_ru=note_ru_clean,
        source=source_clean,
        created_at=now_dt,
        updated_at=now_dt,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {
        "ok": True,
        "id": int(row.id),
        "employee_id": int(employee.id),
        "note_uz": row.note_uz,
        "note_ru": row.note_ru,
        "source": row.source,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/api/employees/{emp_id}/wellbeing-note/latest")
def get_latest_employee_wellbeing_note(emp_id: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == emp_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    row = (
        db.query(EmployeeWellbeingNote)
        .filter(EmployeeWellbeingNote.employee_id == emp_id)
        .order_by(EmployeeWellbeingNote.created_at.desc(), EmployeeWellbeingNote.id.desc())
        .first()
    )
    if row is None:
        return {"ok": True, "item": None}

    return {
        "ok": True,
        "item": {
            "id": int(row.id),
            "employee_id": int(row.employee_id),
            "note_uz": row.note_uz,
            "note_ru": row.note_ru,
            "source": row.source,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        },
    }


@router.post("/api/employees/{emp_id}/psychological-state")
def save_employee_psychological_state(
    emp_id: int,
    state_uz: Optional[str] = Body(None, embed=True),
    state_ru: Optional[str] = Body(None, embed=True),
    state_key: Optional[str] = Body(None, embed=True),
    confidence: Optional[float] = Body(None, embed=True),
    emotion_scores: Any = Body(None, embed=True),
    state_date: Optional[str] = Body(None, embed=True),
    source: Optional[str] = Body("manual", embed=True),
    note: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.id == emp_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    state_uz_clean = str(state_uz or "").strip()
    state_ru_clean = str(state_ru or "").strip()
    state_key_clean = str(state_key or "").strip()
    inferred_state_key = state_key_clean or infer_state_key_from_labels(state_uz_clean, state_ru_clean) or ""
    profile = build_psychological_profile(
        inferred_state_key,
        confidence=confidence,
        emotion_scores=emotion_scores,
    )
    if not state_uz_clean:
        state_uz_clean = str(profile.get("state_uz") or "").strip()
    if not state_ru_clean:
        state_ru_clean = str(profile.get("state_ru") or "").strip()
    if not state_uz_clean or not state_ru_clean:
        raise HTTPException(status_code=422, detail="state_uz va state_ru majburiy")

    source_clean = normalize_psychological_state_source(source)
    date_clean = str(state_date or "").strip() or datetime.utcnow().strftime("%Y-%m-%d")
    try:
        datetime.strptime(date_clean, "%Y-%m-%d")
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="state_date formati noto'g'ri, YYYY-MM-DD bo'lishi kerak",
        ) from exc

    now_dt = datetime.utcnow()
    row = (
        db.query(EmployeePsychologicalState)
        .filter(
            EmployeePsychologicalState.employee_id == int(employee.id),
            EmployeePsychologicalState.state_date == date_clean,
        )
        .order_by(EmployeePsychologicalState.id.desc())
        .first()
    )

    payload_scores = emotion_scores or profile.get("emotion_scores") or {}
    payload_key = str(profile.get("state_key") or inferred_state_key or "") or None
    payload_confidence = profile.get("confidence")
    payload_note = str(note or "").strip() or None
    payload_scores_json = serialize_emotion_scores(payload_scores) if payload_scores else None

    if row is None:
        row = EmployeePsychologicalState(
            employee_id=int(employee.id),
            state_key=payload_key,
            state_uz=state_uz_clean,
            state_ru=state_ru_clean,
            confidence=payload_confidence,
            emotion_scores_json=payload_scores_json,
            state_date=date_clean,
            source=source_clean,
            note=payload_note,
            assessed_at=now_dt,
            created_at=now_dt,
            updated_at=now_dt,
        )
        db.add(row)
    else:
        row.state_key = payload_key
        row.state_uz = state_uz_clean
        row.state_ru = state_ru_clean
        row.confidence = payload_confidence
        row.emotion_scores_json = payload_scores_json
        row.source = source_clean
        row.note = payload_note
        row.assessed_at = now_dt
        row.updated_at = now_dt

    db.commit()
    db.refresh(row)
    return {"ok": True, **serialize_psychological_state_row(row)}


@router.get("/api/employees/{emp_id}/psychological-state/latest")
def get_latest_employee_psychological_state(emp_id: int, db: Session = Depends(get_db)):
    employee = db.query(Employee).filter(Employee.id == emp_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    row = (
        db.query(EmployeePsychologicalState)
        .filter(EmployeePsychologicalState.employee_id == int(employee.id))
        .order_by(EmployeePsychologicalState.state_date.desc(), EmployeePsychologicalState.id.desc())
        .first()
    )
    if row is None:
        return {"ok": True, "item": None}

    return {"ok": True, "item": serialize_psychological_state_row(row)}


@router.get("/api/employees/{emp_id}/psychological-state/history")
def get_employee_psychological_state_history(
    emp_id: int,
    limit: int = Query(30, ge=1, le=366),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.id == emp_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    rows = (
        db.query(EmployeePsychologicalState)
        .filter(EmployeePsychologicalState.employee_id == int(employee.id))
        .order_by(EmployeePsychologicalState.state_date.desc(), EmployeePsychologicalState.id.desc())
        .limit(int(limit))
        .all()
    )

    return {"ok": True, "items": [serialize_psychological_state_row(row) for row in rows]}


@router.get("/api/employees/{emp_id}/insights")
def get_employee_insights(
    emp_id: int,
    psy_days: int = Query(90, ge=7, le=366),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    if employee is None:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    now = datetime.utcnow()
    start_this_month, end_this_month = _month_bounds(now.year, now.month)
    prev_month_year = now.year if now.month > 1 else now.year - 1
    prev_month_num = now.month - 1 if now.month > 1 else 12
    prev_prev_month_year = prev_month_year if prev_month_num > 1 else prev_month_year - 1
    prev_prev_month_num = prev_month_num - 1 if prev_month_num > 1 else 12
    start_prev_month, end_prev_month = _month_bounds(prev_month_year, prev_month_num)
    start_prev_prev_month, end_prev_prev_month = _month_bounds(prev_prev_month_year, prev_prev_month_num)
    start_this_year = datetime(now.year, 1, 1, 0, 0, 0)
    end_this_year = datetime(now.year + 1, 1, 1, 0, 0, 0)

    schedule_payload = resolve_employee_schedule(employee)

    lateness = {
        "this_month": _build_lateness_period(
            db,
            employee=employee,
            start_dt=start_this_month,
            end_dt=end_this_month,
        ),
        "prev_month": _build_lateness_period(
            db,
            employee=employee,
            start_dt=start_prev_month,
            end_dt=end_prev_month,
        ),
        "prev_prev_month": _build_lateness_period(
            db,
            employee=employee,
            start_dt=start_prev_prev_month,
            end_dt=end_prev_prev_month,
        ),
        "this_year": _build_lateness_period(
            db,
            employee=employee,
            start_dt=start_this_year,
            end_dt=end_this_year,
        ),
    }

    linked_rows = (
        db.query(Device.id, Device.name, Device.isup_device_id, Device.mac_address, Device.model)
        .join(EmployeeCameraLink, EmployeeCameraLink.camera_id == Device.id)
        .filter(EmployeeCameraLink.employee_id == int(employee.id))
        .order_by(Device.name.asc())
        .all()
    )
    camera_items: list[dict[str, Any]] = []
    for row in linked_rows:
        camera_id = int(row[0])
        logs_q = db.query(AttendanceLog).filter(
            AttendanceLog.employee_id == int(employee.id),
            AttendanceLog.device_id == camera_id,
        )
        logs_count = int(logs_q.count() or 0)
        latest_log = logs_q.order_by(AttendanceLog.timestamp.desc(), AttendanceLog.id.desc()).first()
        camera_items.append(
            {
                "camera_id": camera_id,
                "camera_name": str(row[1] or ""),
                "isup_device_id": str(row[2] or ""),
                "mac_address": str(row[3] or ""),
                "model": str(row[4] or ""),
                "employee_id": int(employee.id),
                "employee_first_name": str(employee.first_name or ""),
                "employee_last_name": str(employee.last_name or ""),
                "employee_middle_name": str(employee.middle_name or ""),
                "employee_personal_id": str(employee.personal_id or ""),
                "employee_department": str(employee.department or ""),
                "employee_position": str(employee.position or ""),
                "employee_has_access": bool(employee.has_access),
                "employee_start_time": str(schedule_payload.get("start_time") or ""),
                "employee_end_time": str(schedule_payload.get("end_time") or ""),
                "employee_organization": str(employee.organization.name if employee.organization else ""),
                "attendance_events": logs_count,
                "last_seen_at": latest_log.timestamp.isoformat() if latest_log and latest_log.timestamp else None,
                "last_snapshot_url": str(latest_log.snapshot_url or "") if latest_log else "",
                "last_status": str(latest_log.status or "") if latest_log else "",
                "last_person_id": str(latest_log.person_id or "") if latest_log else "",
                "last_person_name": str(latest_log.person_name or "") if latest_log else "",
            }
        )

    psych_rows = (
        db.query(EmployeePsychologicalState)
        .filter(EmployeePsychologicalState.employee_id == int(employee.id))
        .order_by(EmployeePsychologicalState.state_date.desc(), EmployeePsychologicalState.id.desc())
        .limit(int(psy_days))
        .all()
    )

    emotion_keys = tuple(EMOTION_DISPLAY_ORDER)
    emotion_totals = {key: 0.0 for key in emotion_keys}
    dominant_counts = {key: 0 for key in emotion_keys}
    daily: list[dict[str, Any]] = []

    for row in psych_rows:
        profile = serialize_psychological_state_row(row)
        scores = profile.get("emotion_scores") or {}
        if not scores:
            inferred = str(profile.get("state_key") or "").strip()
            if inferred in emotion_totals:
                scores = {inferred: 1.0}
        for key in emotion_keys:
            emotion_totals[key] += float(scores.get(key) or 0.0)
        dominant_key = str(profile.get("state_key") or "").strip()
        if dominant_key in dominant_counts:
            dominant_counts[dominant_key] = int(dominant_counts.get(dominant_key, 0)) + 1
        daily.append(
            {
                "state_date": str(profile.get("state_date") or ""),
                "state_uz": str(profile.get("state_uz") or ""),
                "state_ru": str(profile.get("state_ru") or ""),
                "confidence": profile.get("confidence"),
                "profile_text_uz": str(profile.get("profile_text_uz") or ""),
                "profile_text_ru": str(profile.get("profile_text_ru") or ""),
                "emotion_percent": {
                    key: round(float(scores.get(key) or 0.0) * 100, 1)
                    for key in emotion_keys
                },
            }
        )

    rows_count = max(1, len(psych_rows))
    average_percent = {
        key: round((float(emotion_totals.get(key) or 0.0) / rows_count) * 100, 1)
        for key in emotion_keys
    }
    top_key = ""
    if psych_rows:
        top_key = max(dominant_counts, key=lambda key: int(dominant_counts.get(key, 0)))

    return {
        "ok": True,
        "employee": {
            "id": int(employee.id),
            "personal_id": str(employee.personal_id or ""),
            "expected_start_time": str(schedule_payload.get("start_time") or "09:00"),
        },
        "camera": {
            "linked_count": len(camera_items),
            "items": camera_items,
        },
        "psychology": {
            "days_returned": len(daily),
            "emotion_keys": list(emotion_keys),
            "average_percent": average_percent,
            "dominant_counts": dominant_counts,
            "top_state_key": top_key,
            "daily": daily,
        },
        "lateness": lateness,
    }

