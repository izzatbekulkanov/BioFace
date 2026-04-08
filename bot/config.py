from __future__ import annotations

import os
from dataclasses import dataclass

import system_config  # noqa: F401  # Loads .env before reading bot settings.
from database import SessionLocal, ensure_schema
from models import Organization


@dataclass(frozen=True)
class BotConfig:
    token: str
    default_language: str = "uz"


def load_config() -> BotConfig:
    ensure_schema()
    with SessionLocal() as db:
        org = db.query(Organization).order_by(Organization.id.asc()).first()
        token = str(getattr(org, "telegram_bot_token", "") or "").strip() if org is not None else ""
    if not token:
        raise RuntimeError("Telegram bot token not found in database settings.")

    default_language = os.getenv("TELEGRAM_BOT_DEFAULT_LANGUAGE", "uz").strip().lower()
    if default_language not in {"uz", "ru"}:
        default_language = "uz"

    return BotConfig(token=token, default_language=default_language)

