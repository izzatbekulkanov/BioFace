import os
import jwt
from datetime import datetime, timedelta, timezone

# Use JWT_SECRET if defined, fallback to SESSION_SECRET, and then fallback to dev key
JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("SESSION_SECRET", "bioface-dev-session-key-change-this"))
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_DAYS = 30  # Mobile apps benefit from longer sessions (e.g. 30 days)

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=JWT_ACCESS_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None
