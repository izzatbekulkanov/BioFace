from __future__ import annotations


from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import SessionLocal, ensure_schema
from models import Employee, TelegramUserBinding
from time_utils import now_tashkent


def _normalize_telegram_id(value: int | str | None) -> str:
    if value is None:
        return ""
    return str(value).strip()


def get_binding(telegram_user_id: int | str | None):
    user_id = _normalize_telegram_id(telegram_user_id)
    if not user_id:
        return None

    ensure_schema()
    with SessionLocal() as db:
        statement = (
            select(TelegramUserBinding)
            .options(selectinload(TelegramUserBinding.employee).selectinload(Employee.organization))
            .where(TelegramUserBinding.telegram_user_id == user_id)
        )
        return db.execute(statement).scalar_one_or_none()


def upsert_binding(
    telegram_user_id: int | str | None,
    telegram_chat_id: int | str | None,
    language: str,
    employee_id: int | None,
):
    user_id = _normalize_telegram_id(telegram_user_id)
    chat_id = _normalize_telegram_id(telegram_chat_id)
    if not user_id:
        return None

    ensure_schema()
    now = now_tashkent()
    with SessionLocal() as db:
        statement = select(TelegramUserBinding).where(TelegramUserBinding.telegram_user_id == user_id)
        binding = db.execute(statement).scalar_one_or_none()
        if binding is None:
            binding = TelegramUserBinding(
                telegram_user_id=user_id,
                telegram_chat_id=chat_id,
                language=language,
                created_at=now,
                updated_at=now,
            )
            binding.employee_id = int(employee_id) if employee_id is not None else None
            db.add(binding)
        else:
            binding.telegram_chat_id = chat_id or binding.telegram_chat_id
            binding.language = language
            binding.employee_id = int(employee_id) if employee_id is not None else None
            binding.updated_at = now
        db.commit()
        db.refresh(binding)
        return binding


def clear_employee_link(telegram_user_id: int | str | None):
    user_id = _normalize_telegram_id(telegram_user_id)
    if not user_id:
        return

    ensure_schema()
    with SessionLocal() as db:
        statement = select(TelegramUserBinding).where(TelegramUserBinding.telegram_user_id == user_id)
        binding = db.execute(statement).scalar_one_or_none()
        if binding is None:
            return
        binding.employee_id = None
        binding.updated_at = now_tashkent()
        db.commit()


def delete_binding(telegram_user_id: int | str | None):
    user_id = _normalize_telegram_id(telegram_user_id)
    if not user_id:
        return

    ensure_schema()
    with SessionLocal() as db:
        statement = select(TelegramUserBinding).where(TelegramUserBinding.telegram_user_id == user_id)
        binding = db.execute(statement).scalar_one_or_none()
        if binding is None:
            return
        db.delete(binding)
        db.commit()


def get_bindings_for_employee(employee_id: int | None):
    if employee_id is None:
        return []

    ensure_schema()
    with SessionLocal() as db:
        statement = select(TelegramUserBinding).where(TelegramUserBinding.employee_id == employee_id)
        return list(db.execute(statement).scalars().all())


