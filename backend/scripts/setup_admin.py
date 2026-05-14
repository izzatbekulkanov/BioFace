#!/usr/bin/env python3
from __future__ import annotations

import os
import sys
from pathlib import Path

import bcrypt
from sqlalchemy import func


BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from core.database import SessionLocal, engine, ensure_schema
import core.models as models


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8")[:71],
        bcrypt.gensalt(),
    ).decode("utf-8")


def _split_name(full_name: str) -> tuple[str, str]:
    parts = [part for part in str(full_name or "").strip().split() if part]
    if not parts:
        return "Admin", "User"
    if len(parts) == 1:
        return parts[0], "User"
    return parts[0], " ".join(parts[1:])


def _resolve_admin_settings() -> tuple[str, str, str]:
    name = os.getenv("DEFAULT_ADMIN_NAME", "Admin User").strip() or "Admin User"
    email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@bioface.local").strip().lower() or "admin@bioface.local"
    password = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123").strip() or "admin123"
    return name, email, password


def _ensure_admin_user() -> tuple[models.User, bool, str]:
    admin_name, admin_email, admin_password = _resolve_admin_settings()
    first_name, last_name = _split_name(admin_name)
    hashed_password = _hash_password(admin_password)

    db = SessionLocal()
    try:
        user = (
            db.query(models.User)
            .filter(func.lower(models.User.email) == admin_email)
            .first()
        )

        created = user is None
        if user is None:
            user = models.User(
                name=admin_name,
                first_name=first_name,
                last_name=last_name,
                middle_name="",
                email=admin_email,
                phone="",
                image_url="",
                hashed_password=hashed_password,
                role=models.UserRole.super_admin,
                status="active",
                organization_id=None,
                google_oauth_enabled=False,
                last_login_provider="password",
            )
            db.add(user)
        else:
            user.name = admin_name
            user.first_name = first_name
            user.last_name = last_name
            user.middle_name = user.middle_name or ""
            user.hashed_password = hashed_password
            user.role = models.UserRole.super_admin
            user.status = "active"
            user.last_login_provider = "password"

        db.commit()
        db.refresh(user)
        return user, created, admin_password
    finally:
        db.close()


def _report_isup_status() -> None:
    try:
        from services.isup_manager import get_process_status

        status = get_process_status()
        if status.get("running"):
            print(f"ISUP server ishlamoqda (PID: {status.get('pid', '?')})")
        else:
            print("ISUP server ishlamayapti. Uni .\\start.ps1 orqali ishga tushiring.")
    except Exception as exc:
        print(f"ISUP holatini tekshirib bo'lmadi: {exc}")


def main() -> None:
    print("=" * 50)
    print("  BioFace Admin Setup")
    print("=" * 50)
    print()
    print("Jinja fayllariga o'zgartirish kiritilmaydi.")
    print()

    models.Base.metadata.create_all(bind=engine)
    ensure_schema()

    user, created, raw_password = _ensure_admin_user()
    action = "yaratildi" if created else "yangilandi"

    print(f"Admin foydalanuvchi {action}:")
    print(f"  Email:  {user.email}")
    print(f"  Role:   {user.role.value if user.role else '-'}")
    print(f"  Parol:  {raw_password}")
    print()

    _report_isup_status()


if __name__ == "__main__":
    main()
