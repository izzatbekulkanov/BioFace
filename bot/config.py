from __future__ import annotations

import os
import re
from dataclasses import dataclass

import system_config  # noqa: F401  # Loads .env before reading bot settings.
from database import SessionLocal, ensure_schema
from models import Organization

# Telegram token format: {bot_id}:{random_string}
_TOKEN_RE = re.compile(r"^\d{5,}:[A-Za-z0-9_-]{30,}$")


def _is_valid_token(token: str) -> bool:
    """Basic format check — prevents obviously wrong tokens being used."""
    return bool(token and _TOKEN_RE.match(token))


@dataclass(frozen=True)
class BotConfig:
    token: str
    default_language: str = "uz"


def load_config() -> BotConfig:
    ensure_schema()
    db_token = ""
    with SessionLocal() as db:
        org = db.query(Organization).order_by(Organization.id.asc()).first()
        db_token = str(getattr(org, "telegram_bot_token", "") or "").strip() if org is not None else ""

    env_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()

    # Prefer DB token if it looks valid, else fall back to env
    if _is_valid_token(db_token):
        token = db_token
    elif _is_valid_token(env_token):
        token = env_token
    elif db_token:
        # DB has something but it's invalid format — still try it (Telegram will reject)
        # This preserves the old behaviour while preferring env token
        token = db_token
    else:
        raise RuntimeError(
            "Telegram bot token not found or invalid. "
            "Set it in Settings > Telegram or in the .env file as TELEGRAM_BOT_TOKEN."
        )

    default_language = os.getenv("TELEGRAM_BOT_DEFAULT_LANGUAGE", "uz").strip().lower()
    if default_language not in {"uz", "ru"}:
        default_language = "uz"

    return BotConfig(token=token, default_language=default_language)


