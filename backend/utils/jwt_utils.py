import os
import logging
import jwt
from datetime import datetime, timedelta, timezone

LOGGER = logging.getLogger(__name__)

# Use JWT_SECRET if defined, fallback to SESSION_SECRET, and then fallback to dev key
_DEFAULT_DEV_KEY = "bioface-dev-session-key-change-this"
JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("SESSION_SECRET", _DEFAULT_DEV_KEY))
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_DAYS = 30  # Mobile apps benefit from longer sessions (e.g. 30 days)

# Ishlab chiqishda default kalit ishlatilayotgani haqida ogohlantirish
if JWT_SECRET == _DEFAULT_DEV_KEY:
    LOGGER.warning(
        "[SECURITY] JWT_SECRET sozlanmagan! Default dev kaliti ishlatilmoqda. "
        "Production muhitida .env faylida JWT_SECRET ni o'rnating!"
    )


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=JWT_ACCESS_TOKEN_EXPIRE_DAYS)

    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        LOGGER.debug("[JWT] Token muddati tugagan")
        return None
    except jwt.InvalidTokenError as e:
        LOGGER.debug("[JWT] Noto'g'ri token: %s", e)
        return None
    except Exception as e:
        LOGGER.error("[JWT] Kutilmagan xato: %s", e)
        return None
