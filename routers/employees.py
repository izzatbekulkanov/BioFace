import os
import json
import random
import re
import shutil
import uuid
from datetime import datetime, timedelta
from calendar import monthrange
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models import AttendanceLog, Device, Employee, EmployeeCameraLink, Organization
from .cameras import _resolve_online_command_target, _send_isup_command_or_raise

UPLOAD_DIR = "static/uploads/employees"
os.makedirs(UPLOAD_DIR, exist_ok=True)

PERSONAL_ID_PATTERN = re.compile(r"^[1-9]\d{6}$")

router = APIRouter()


def _normalize_personal_id(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _validate_personal_id_format(personal_id: str) -> None:
    if not PERSONAL_ID_PATTERN.fullmatch(personal_id):
        raise HTTPException(
            status_code=422,
            detail="Shaxsiy ID 7 ta raqam bo'lishi kerak va 0 bilan boshlanmasligi kerak",
        )


def _is_personal_id_taken(
    db: Session,
    personal_id: str,
    *,
    exclude_employee_id: Optional[int] = None,
) -> bool:
    query = db.query(Employee.id).filter(Employee.personal_id == personal_id)
    if exclude_employee_id is not None:
        query = query.filter(Employee.id != exclude_employee_id)
    return query.first() is not None


def _generate_unique_personal_id(db: Session, max_attempts: int = 5000) -> str:
    for _ in range(max_attempts):
        candidate = str(random.randint(1000000, 9999999))
        if not _is_personal_id_taken(db, candidate):
            return candidate
    raise HTTPException(status_code=503, detail="Unikal Shaxsiy ID generatsiya qilib bo'lmadi")


def _parse_camera_ids(raw: Optional[str]) -> list[int]:
    if raw is None:
        return []
    text = str(raw).strip()
    if not text:
        return []

    try:
        if text.startswith("["):
            payload = json.loads(text)
        else:
            payload = [x.strip() for x in text.split(",") if x.strip()]
    except Exception:
        raise HTTPException(status_code=422, detail="camera_ids formati noto'g'ri")

    if not isinstance(payload, list):
        raise HTTPException(status_code=422, detail="camera_ids ro'yxat bo'lishi kerak")

    normalized: list[int] = []
    seen: set[int] = set()
    for item in payload:
        try:
            cam_id = int(str(item).strip())
        except Exception:
            continue
        if cam_id <= 0 or cam_id in seen:
            continue
        seen.add(cam_id)
        normalized.append(cam_id)
    return normalized


def _save_employee_camera_links(
    db: Session,
    *,
    employee_id: int,
    camera_ids: list[int],
    organization_id: Optional[int],
) -> list[int]:
    db.query(EmployeeCameraLink).filter(EmployeeCameraLink.employee_id == employee_id).delete(
        synchronize_session=False
    )
    if not camera_ids:
        return []

    cameras = db.query(Device).filter(Device.id.in_(camera_ids)).all()
    camera_map = {int(c.id): c for c in cameras}
    valid_ids: list[int] = []
    for cam_id in camera_ids:
        cam = camera_map.get(cam_id)
        if cam is None:
            continue
        if organization_id is not None and cam.organization_id != organization_id:
            continue
        valid_ids.append(cam_id)

    for cam_id in valid_ids:
        db.add(EmployeeCameraLink(employee_id=employee_id, camera_id=cam_id))
    return valid_ids


def _parse_hhmm(value: Optional[str], default_h: int = 9, default_m: int = 0) -> tuple[int, int]:
    text = str(value or "").strip()
    if not text:
        return default_h, default_m
    parts = text.split(":")
    if len(parts) < 2:
        return default_h, default_m
    try:
        return int(parts[0]), int(parts[1])
    except Exception:
        return default_h, default_m


def _format_duration_human(total_minutes: int) -> str:
    safe = max(0, int(total_minutes or 0))
    hh, mm = divmod(safe, 60)
    if hh > 0:
        return f"{hh} soat {mm} daqiqa"
    return f"{mm} daqiqa"


def _format_duration_hms(total_seconds: int) -> str:
    safe = max(0, int(total_seconds or 0))
    hh, rem = divmod(safe, 3600)
    mm, ss = divmod(rem, 60)
    if hh > 0:
        if ss > 0:
            return f"{hh} soat {mm} daqiqa {ss} soniya"
        return f"{hh} soat {mm} daqiqa"
    if mm > 0:
        if ss > 0:
            return f"{mm} daqiqa {ss} soniya"
        return f"{mm} daqiqa"
    return f"{ss} soniya"


@router.get("/api/employees")
def get_employees(db: Session = Depends(get_db)):
    employees = db.query(Employee).order_by(Employee.id.desc()).all()
    links = db.query(EmployeeCameraLink.employee_id, EmployeeCameraLink.camera_id).all()
    org_rows = db.query(Organization.id, Organization.name).all()
    cam_rows = db.query(Device.id, Device.name).all()
    org_map = {int(row[0]): str(row[1]) for row in org_rows}
    cam_map = {int(row[0]): str(row[1]) for row in cam_rows}
    camera_map: dict[int, list[int]] = {}
    for emp_id, cam_id in links:
        key = int(emp_id)
        camera_map.setdefault(key, []).append(int(cam_id))
    return [
        {
            "id": e.id,
            "personal_id": e.personal_id,
            "full_name": f"{e.first_name} {e.last_name}",
            "first_name": e.first_name,
            "last_name": e.last_name,
            "department": e.department,
            "position": e.position,
            "status": "Faol" if e.has_access else "Ruxsat yo'q",
            "added_date": e.created_at.strftime("%Y-%m-%d") if e.created_at else "",
            "start_time": e.start_time,
            "end_time": e.end_time,
            "avatar": e.image_url or "",
            "organization_id": e.organization_id,
            "organization_name": org_map.get(int(e.organization_id)) if e.organization_id is not None else None,
            "camera_ids": camera_map.get(int(e.id), []),
            "camera_names": [
                cam_map[cam_id]
                for cam_id in camera_map.get(int(e.id), [])
                if cam_id in cam_map
            ],
        }
        for e in employees
    ]


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
        cam_name = (log.device.name if log.device else (log.camera_mac or "Noma'lum kamera"))
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
        int(round(summary["total_late_minutes"] / summary["late_days"]))
        if summary["late_days"] > 0
        else 0
    )
    summary["avg_late_seconds"] = (
        int(round(summary["total_late_seconds"] / summary["late_days"]))
        if summary["late_days"] > 0
        else 0
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
            "personal_id": emp.personal_id,
            "department": emp.department,
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


@router.get("/api/employees/personal-id/validate")
def validate_personal_id(
    personal_id: str = Query(..., description="7 xonali personal ID"),
    db: Session = Depends(get_db),
):
    normalized = _normalize_personal_id(personal_id)
    if not normalized:
        return {
            "valid": False,
            "available": False,
            "message": "Shaxsiy ID bo'sh bo'lmasligi kerak",
        }
    if not PERSONAL_ID_PATTERN.fullmatch(normalized):
        return {
            "valid": False,
            "available": False,
            "message": "Faqat 7 ta raqam kiriting (birinchi raqam 1-9)",
        }
    taken = _is_personal_id_taken(db, normalized)
    return {
        "valid": True,
        "available": not taken,
        "message": "ID bo'sh" if not taken else "Bu ID bazada mavjud",
    }


@router.get("/api/employees/personal-id/generate")
def generate_personal_id(db: Session = Depends(get_db)):
    return {"personal_id": _generate_unique_personal_id(db)}


@router.post("/api/employees")
def create_employee(
    first_name: str = Form(...),
    last_name: str = Form(...),
    personal_id: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    position: Optional[str] = Form(None),
    start_time: Optional[str] = Form(None),
    end_time: Optional[str] = Form(None),
    organization_id: Optional[int] = Form(None),
    camera_ids: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    parsed_camera_ids = _parse_camera_ids(camera_ids)

    normalized_personal_id = _normalize_personal_id(personal_id)
    if normalized_personal_id is None:
        normalized_personal_id = _generate_unique_personal_id(db)
    else:
        _validate_personal_id_format(normalized_personal_id)
        if _is_personal_id_taken(db, normalized_personal_id):
            raise HTTPException(status_code=409, detail="Bu Shaxsiy ID bazada allaqachon mavjud")

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
        personal_id=normalized_personal_id,
        department=department,
        position=position,
        start_time=start_time,
        end_time=end_time,
        image_url=image_url,
        organization_id=organization_id,
    )
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)

    linked_camera_ids = _save_employee_camera_links(
        db,
        employee_id=int(new_emp.id),
        camera_ids=parsed_camera_ids,
        organization_id=organization_id,
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
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    personal_id: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    position: Optional[str] = Form(None),
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
    if personal_id is not None:
        normalized_personal_id = _normalize_personal_id(personal_id)
        if normalized_personal_id is None:
            emp.personal_id = None
        else:
            _validate_personal_id_format(normalized_personal_id)
            if _is_personal_id_taken(db, normalized_personal_id, exclude_employee_id=emp_id):
                raise HTTPException(status_code=409, detail="Bu Shaxsiy ID bazada allaqachon mavjud")
            emp.personal_id = normalized_personal_id
    if department is not None:
        emp.department = department
    if position is not None:
        emp.position = position
    if start_time is not None:
        emp.start_time = start_time
    if end_time is not None:
        emp.end_time = end_time
    if organization_id is not None:
        emp.organization_id = organization_id

    linked_camera_ids: Optional[list[int]] = None
    if camera_ids is not None:
        parsed_camera_ids = _parse_camera_ids(camera_ids)
        linked_camera_ids = _save_employee_camera_links(
            db,
            employee_id=int(emp.id),
            camera_ids=parsed_camera_ids,
            organization_id=emp.organization_id,
        )

    db.commit()
    payload = {"ok": True, "message": "Xodim yangilandi"}
    if linked_camera_ids is not None:
        payload["camera_ids"] = linked_camera_ids
    return payload


@router.delete("/api/employees/{emp_id}")
def delete_employee(
    emp_id: int,
    delete_from_cameras: bool = Query(True),
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
            linked_camera_ids = [
                int(row.camera_id)
                for row in db.query(EmployeeCameraLink.camera_id)
                .filter(EmployeeCameraLink.employee_id == emp.id)
                .all()
            ]
            if linked_camera_ids:
                cameras = (
                    db.query(Device)
                    .filter(Device.id.in_(linked_camera_ids))
                    .order_by(Device.id)
                    .all()
                )
            else:
                cams_q = db.query(Device)
                if emp.organization_id is not None:
                    cams_q = cams_q.filter(Device.organization_id == emp.organization_id)
                cameras = cams_q.order_by(Device.id).all()
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

    # Frontend uchun javobni ixcham saqlaymiz.
    details = camera_sync["details"]
    camera_sync["details"] = details[:10]
    if len(details) > 10:
        camera_sync["details_truncated"] = len(details) - 10

    return {"ok": True, "message": message, "camera_sync": camera_sync}
