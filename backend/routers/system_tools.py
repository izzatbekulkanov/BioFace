import os
import shutil
from datetime import timedelta
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from database import DATA_DIR, SQLALCHEMY_DATABASE_URL, get_db, is_sqlite
from models import AttendanceLog, Device, Employee, Organization, UserOrganizationLink, UserRole
from utils.access_control import normalize_role_value
from utils.time_utils import now_tashkent


router = APIRouter()
BACKUP_DIR = Path(DATA_DIR).parent / "backups"


def _request_is_super_admin(request: Request) -> bool:
    auth_user = request.session.get("auth_user") or {}
    return normalize_role_value(auth_user.get("role")) == UserRole.super_admin.value


def _allowed_org_ids(request: Request, db: Session) -> tuple[bool, list[int]]:
    if _request_is_super_admin(request):
        return True, [int(row.id) for row in db.query(Organization.id).all()]
    auth_user = request.session.get("auth_user") or {}
    org_ids: set[int] = set()
    user_id = auth_user.get("id")
    if user_id is not None:
        rows = db.query(UserOrganizationLink.organization_id).filter(UserOrganizationLink.user_id == int(user_id)).all()
        org_ids.update(int(row.organization_id) for row in rows if row.organization_id is not None)
    fallback = auth_user.get("organization_id")
    if fallback is not None:
        org_ids.add(int(fallback))
    return False, sorted(org_ids)


def _sqlite_db_path() -> Path:
    prefix = "sqlite:///"
    if not SQLALCHEMY_DATABASE_URL.startswith(prefix):
        raise HTTPException(status_code=409, detail="Backup API hozir SQLite baza uchun sozlangan")
    return Path(SQLALCHEMY_DATABASE_URL[len(prefix):]).resolve()


@router.post("/api/system/backup")
def create_backup(request: Request):
    if not _request_is_super_admin(request):
        raise HTTPException(status_code=403, detail="Backup faqat SuperAdmin uchun ruxsat")
    if not is_sqlite:
        raise HTTPException(status_code=409, detail="Avtomatik fayl backup faqat SQLite rejimida ishlaydi")

    source = _sqlite_db_path()
    if not source.exists():
        raise HTTPException(status_code=404, detail="Database fayli topilmadi")

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = now_tashkent().strftime("%Y%m%d_%H%M%S")
    target = BACKUP_DIR / f"bioface_{stamp}.db"
    shutil.copy2(source, target)
    wal = source.with_name(source.name + "-wal")
    shm = source.with_name(source.name + "-shm")
    if wal.exists():
        shutil.copy2(wal, BACKUP_DIR / f"bioface_{stamp}.db-wal")
    if shm.exists():
        shutil.copy2(shm, BACKUP_DIR / f"bioface_{stamp}.db-shm")
    return {
        "ok": True,
        "filename": target.name,
        "path": str(target),
        "size_mb": round(target.stat().st_size / (1024 * 1024), 2),
        "created_at": now_tashkent().isoformat(),
    }


@router.get("/api/system/backups")
def list_backups(request: Request):
    if not _request_is_super_admin(request):
        raise HTTPException(status_code=403, detail="Backup ro'yxati faqat SuperAdmin uchun ruxsat")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    for path in sorted(BACKUP_DIR.glob("bioface_*.db"), reverse=True):
        stat = path.stat()
        items.append(
            {
                "filename": path.name,
                "path": str(path),
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "created_at": now_tashkent().fromtimestamp(stat.st_mtime).isoformat(),
            }
        )
    return {"ok": True, "items": items[:50]}


@router.get("/api/system/offline-cameras")
def offline_cameras(
    request: Request,
    minutes: int = 10,
    db: Session = Depends(get_db),
):
    is_super, org_ids = _allowed_org_ids(request, db)
    if not is_super and not org_ids:
        return {"ok": True, "items": [], "count": 0}

    cutoff = now_tashkent() - timedelta(minutes=max(1, int(minutes)))
    query = db.query(Device).outerjoin(Organization, Organization.id == Device.organization_id)
    if not is_super:
        query = query.filter(Device.organization_id.in_(org_ids))
    query = query.filter((Device.is_online == False) | (Device.last_seen_at.is_(None)) | (Device.last_seen_at < cutoff))
    devices = query.order_by(Device.last_seen_at.asc().nullsfirst(), Device.id.asc()).all()
    return {
        "ok": True,
        "count": len(devices),
        "items": [
            {
                "id": int(cam.id),
                "name": cam.name,
                "mac_address": cam.mac_address,
                "serial_number": cam.serial_number,
                "isup_device_id": cam.isup_device_id,
                "organization_id": cam.organization_id,
                "organization_name": cam.organization.name if cam.organization else None,
                "branch_id": cam.branch_id,
                "branch_name": cam.branch.name if cam.branch else None,
                "is_online": bool(cam.is_online),
                "last_seen_at": cam.last_seen_at.isoformat() if cam.last_seen_at else None,
                "min_face_confidence": cam.min_face_confidence if cam.min_face_confidence is not None else 0.40,
            }
            for cam in devices
        ],
    }


@router.get("/api/system/faceid-audit")
def faceid_audit_summary(
    request: Request,
    db: Session = Depends(get_db),
):
    is_super, org_ids = _allowed_org_ids(request, db)
    if not is_super and not org_ids:
        return {"ok": True, "summary": {}, "problem_cameras": []}

    base = db.query(AttendanceLog).outerjoin(Device, Device.id == AttendanceLog.device_id).outerjoin(Employee, Employee.id == AttendanceLog.employee_id)
    if not is_super:
        base = base.filter((Device.organization_id.in_(org_ids)) | (Employee.organization_id.in_(org_ids)))

    pending = int(base.filter(AttendanceLog.review_status == "pending").count() or 0)
    unknown = int(base.filter(AttendanceLog.employee_id.is_(None)).count() or 0)
    low_confidence = int(
        base.filter(
            AttendanceLog.face_confidence.isnot(None),
            AttendanceLog.face_confidence < 0.40,
        ).count()
        or 0
    )
    mobile = int(base.filter(AttendanceLog.attendance_source == "mobile").count() or 0)
    camera = int(base.filter((AttendanceLog.attendance_source == "camera") | (AttendanceLog.attendance_source.is_(None))).count() or 0)

    camera_rows = (
        base.with_entities(
            AttendanceLog.device_id,
            Device.name,
            Device.mac_address,
            func.count(AttendanceLog.id).label("total"),
            func.sum(case((AttendanceLog.review_status == "pending", 1), else_=0)).label("pending"),
            func.sum(case((AttendanceLog.employee_id.is_(None), 1), else_=0)).label("unknown"),
        )
        .filter(AttendanceLog.device_id.isnot(None))
        .group_by(AttendanceLog.device_id, Device.name, Device.mac_address)
        .order_by(func.count(AttendanceLog.id).desc())
        .limit(20)
        .all()
    )

    return {
        "ok": True,
        "summary": {
            "pending": pending,
            "unknown": unknown,
            "low_confidence": low_confidence,
            "mobile": mobile,
            "camera": camera,
        },
        "problem_cameras": [
            {
                "camera_id": int(row.device_id) if row.device_id is not None else None,
                "camera_name": row.name,
                "camera_mac": row.mac_address,
                "total": int(row.total or 0),
                "pending": int(row.pending or 0),
                "unknown": int(row.unknown or 0),
            }
            for row in camera_rows
        ],
    }
