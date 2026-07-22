"""Audit log yozish uchun yordamchi funksiyalar."""
from __future__ import annotations
import json
import logging
from typing import Any, Optional
from sqlalchemy.orm import Session
from models import AuditLog
from utils.time_utils import now_tashkent

LOGGER = logging.getLogger(__name__)


def write_audit(
    db: Session,
    *,
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str | int] = None,
    entity_name: Optional[str] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    description: Optional[str] = None,
    user_id: Optional[int] = None,
    user_name: Optional[str] = None,
    user_role: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    organization_id: Optional[int] = None,
    commit: bool = False,
) -> AuditLog | None:
    """Audit log yozadi. Xatolik bo'lsa log chiqarib davom etadi."""
    try:
        entry = AuditLog(
            user_id=user_id,
            user_name=user_name,
            user_role=user_role,
            action=str(action).upper(),
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            entity_name=entity_name,
            old_values=json.dumps(old_values, ensure_ascii=False, default=str) if old_values else None,
            new_values=json.dumps(new_values, ensure_ascii=False, default=str) if new_values else None,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
            organization_id=organization_id,
            created_at=now_tashkent(),
        )
        db.add(entry)
        if commit:
            db.commit()
        return entry
    except Exception as exc:
        LOGGER.warning("Audit log yozishda xatolik: %s", exc)
        return None


def audit_from_request(request, db: Session, **kwargs) -> AuditLog | None:
    """Request obyektidan foydalanuvchi ma'lumotlarini olib audit yozadi."""
    auth_user = {}
    try:
        auth_user = request.session.get("auth_user") or {}
    except Exception:
        pass
    ip = None
    try:
        ip = str(request.client.host) if request.client else None
    except Exception:
        pass
    ua = str(request.headers.get("user-agent", "") or "")[:255]
    return write_audit(
        db,
        user_id=auth_user.get("id"),
        user_name=auth_user.get("name") or auth_user.get("username"),
        user_role=auth_user.get("role"),
        organization_id=auth_user.get("organization_id"),
        ip_address=ip,
        user_agent=ua,
        **kwargs,
    )
