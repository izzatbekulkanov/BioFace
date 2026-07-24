"""Audit log API — kim nima o'zgartirdi."""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Query, Request
from database import get_db
from fastapi import Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc
from models import AuditLog

router = APIRouter()


@router.get("/api/audit-logs")
async def get_audit_logs(
    request: Request,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    organization_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    auth_user = request.session.get("auth_user") or {}
    role = str(auth_user.get("role") or "").strip().lower()
    is_super = role in {"superadmin", "super_admin"}

    q = db.query(AuditLog).order_by(desc(AuditLog.created_at))

    if not is_super:
        user_org_id = auth_user.get("organization_id")
        if user_org_id:
            q = q.filter(AuditLog.organization_id == int(user_org_id))
        else:
            return {"items": [], "total": 0}

    if organization_id and is_super:
        q = q.filter(AuditLog.organization_id == organization_id)
    if action:
        q = q.filter(AuditLog.action == action.upper())
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if date_from:
        try:
            q = q.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
        except Exception:
            pass
    if date_to:
        try:
            q = q.filter(AuditLog.created_at <= datetime.fromisoformat(date_to))
        except Exception:
            pass
    if search:
        like = f"%{search}%"
        q = q.filter(
            AuditLog.description.ilike(like)
            | AuditLog.entity_name.ilike(like)
            | AuditLog.user_name.ilike(like)
        )

    total = q.count()
    offset = (page - 1) * limit
    rows = q.offset(offset).limit(limit).all()

    items = [
        {
            "id": r.id,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "entity_name": r.entity_name,
            "description": r.description,
            "user_id": r.user_id,
            "user_name": r.user_name,
            "user_role": r.user_role,
            "ip_address": r.ip_address,
            "organization_id": r.organization_id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/api/audit-logs/actions")
async def get_audit_actions():
    """Mavjud action turlari ro'yxati"""
    return {
        "actions": [
            "CREATE", "UPDATE", "DELETE",
            "LOGIN", "LOGOUT",
            "EXPORT", "IMPORT",
            "APPROVE", "REJECT",
            "ENABLE", "DISABLE",
        ],
        "entity_types": [
            "employee", "device", "organization", "branch",
            "user", "schedule", "holiday", "salary",
            "attendance", "subscription",
        ]
    }


from sqlalchemy import func

@router.get("/api/audit-logs/users")
async def get_audit_users(
    request: Request,
    db: Session = Depends(get_db),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    organization_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Tanlangan kategoriya va filterlar bo'yicha audit qilgan foydalanuvchilar ro'yxati"""
    auth_user = request.session.get("auth_user") or {}
    role = str(auth_user.get("role") or "").strip().lower()
    is_super = role in {"superadmin", "super_admin"}

    q = db.query(
        AuditLog.user_id,
        AuditLog.user_name,
        AuditLog.user_role,
        func.count(AuditLog.id).label("audit_count")
    )

    if not is_super:
        user_org_id = auth_user.get("organization_id")
        if user_org_id:
            q = q.filter(AuditLog.organization_id == int(user_org_id))
        else:
            return {"users": []}

    if organization_id and is_super:
        q = q.filter(AuditLog.organization_id == organization_id)
    if action and action != "all":
        q = q.filter(AuditLog.action == action.upper())
    if entity_type and entity_type != "all":
        q = q.filter(AuditLog.entity_type == entity_type)
    if date_from:
        try:
            q = q.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
        except Exception:
            pass
    if date_to:
        try:
            q = q.filter(AuditLog.created_at <= datetime.fromisoformat(date_to))
        except Exception:
            pass

    q = q.group_by(AuditLog.user_id, AuditLog.user_name, AuditLog.user_role).order_by(desc("audit_count"))
    rows = q.all()

    users = [
        {
            "user_id": r.user_id,
            "user_name": r.user_name or "Tizim",
            "user_role": r.user_role or "—",
            "audit_count": r.audit_count,
        }
        for r in rows
    ]
    return {"users": users}
