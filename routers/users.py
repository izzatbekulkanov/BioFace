import os
import re
import uuid
from typing import Any, Dict, List, Optional

import bcrypt
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import Organization, User, UserRole

router = APIRouter()

USER_UPLOAD_DIR = os.path.join("static", "uploads", "users")
os.makedirs(USER_UPLOAD_DIR, exist_ok=True)


class UserResponse(BaseModel):
    id: int
    name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    email: str
    phone: Optional[str] = None
    image_url: Optional[str] = None
    role: str
    organization_id: Optional[int] = None
    organization_name: Optional[str] = None

    class Config:
        from_attributes = True


def _as_clean_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_email(value: Any) -> str:
    return _as_clean_str(value).lower()


def _validate_password_strength(password: str) -> None:
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Parol kamida 8 ta belgidan iborat bo'lishi kerak")
    if not re.search(r"[A-Za-z]", password):
        raise HTTPException(status_code=400, detail="Parolda kamida bitta harf bo'lishi kerak")
    if not re.search(r"[^A-Za-z]", password):
        raise HTTPException(status_code=400, detail="Parolda harfdan tashqari kamida bitta belgi bo'lishi kerak")


def _parse_optional_int(value: Any) -> Optional[int]:
    raw = _as_clean_str(value)
    if raw == "" or raw.lower() == "null":
        return None
    try:
        return int(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Tashkilot ID noto'g'ri") from exc


def _parse_role(value: Any, default: UserRole = UserRole.tashkilot_admin) -> UserRole:
    raw = _as_clean_str(value)
    if not raw:
        return default
    try:
        return UserRole(raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Role noto'g'ri") from exc


def _compose_legacy_name(first_name: str, last_name: str, middle_name: str) -> str:
    full = " ".join(part for part in [first_name, last_name, middle_name] if part).strip()
    return full or first_name or "Foydalanuvchi"


def _split_name_if_needed(name: str) -> tuple[str, str]:
    cleaned = _as_clean_str(name)
    if not cleaned:
        return "", ""
    parts = cleaned.split()
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def _serialize_user(user: User) -> Dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "middle_name": user.middle_name or "",
        "email": user.email,
        "phone": user.phone or "",
        "image_url": user.image_url or "",
        "role": user.role.value if user.role else "",
        "organization_id": user.organization_id,
        "organization_name": user.organization.name if user.organization else None,
    }


def _delete_local_user_image(image_url: Optional[str]) -> None:
    if not image_url:
        return
    prefix = "/static/uploads/users/"
    if not image_url.startswith(prefix):
        return
    rel_name = image_url[len(prefix) :]
    abs_path = os.path.join(USER_UPLOAD_DIR, rel_name)
    if os.path.exists(abs_path):
        try:
            os.remove(abs_path)
        except OSError:
            pass


async def _save_user_image(file: Optional[UploadFile]) -> Optional[str]:
    if not file or not file.filename:
        return None
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Faqat rasm fayl yuklash mumkin")

    _, ext = os.path.splitext(file.filename)
    ext = ext.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        ext = ".jpg"

    filename = f"user_{uuid.uuid4().hex}{ext}"
    abs_path = os.path.join(USER_UPLOAD_DIR, filename)
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Rasm fayli bo'sh")

    with open(abs_path, "wb") as out:
        out.write(content)
    return f"/static/uploads/users/{filename}"


def _validate_org_exists(db: Session, organization_id: Optional[int]) -> None:
    if organization_id is None:
        return
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=400, detail="Tashkilot topilmadi")


async def _extract_payload(
    request: Request,
    *,
    name: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    middle_name: Optional[str],
    email: Optional[str],
    phone: Optional[str],
    password: Optional[str],
    role: Optional[str],
    organization_id: Optional[str],
    image_url: Optional[str],
    clear_image: Optional[str],
) -> Dict[str, Any]:
    content_type = (request.headers.get("content-type") or "").lower()
    if content_type.startswith("application/json"):
        try:
            body = await request.json()
            if isinstance(body, dict):
                return body
        except Exception as exc:
            raise HTTPException(status_code=400, detail="JSON body noto'g'ri") from exc
        return {}
    return {
        "name": name,
        "first_name": first_name,
        "last_name": last_name,
        "middle_name": middle_name,
        "email": email,
        "phone": phone,
        "password": password,
        "role": role,
        "organization_id": organization_id,
        "image_url": image_url,
        "clear_image": clear_image,
    }


@router.get("/api/users", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.id.desc()).all()
    return [_serialize_user(u) for u in users]


@router.post("/api/users", response_model=UserResponse)
async def create_user(
    request: Request,
    name: Optional[str] = Form(None),
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    middle_name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    role: Optional[str] = Form(None),
    organization_id: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    clear_image: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    payload = await _extract_payload(
        request,
        name=name,
        first_name=first_name,
        last_name=last_name,
        middle_name=middle_name,
        email=email,
        phone=phone,
        password=password,
        role=role,
        organization_id=organization_id,
        image_url=image_url,
        clear_image=clear_image,
    )

    raw_name = _as_clean_str(payload.get("name"))
    first_name_val = _as_clean_str(payload.get("first_name"))
    last_name_val = _as_clean_str(payload.get("last_name"))
    middle_name_val = _as_clean_str(payload.get("middle_name"))

    if not first_name_val and raw_name:
        first_name_val, fallback_last = _split_name_if_needed(raw_name)
        if not last_name_val:
            last_name_val = fallback_last

    email_val = _normalize_email(payload.get("email"))
    phone_val = _as_clean_str(payload.get("phone"))
    password_val = _as_clean_str(payload.get("password"))
    role_val = _parse_role(payload.get("role"))
    org_id_val = _parse_optional_int(payload.get("organization_id"))
    image_url_val = _as_clean_str(payload.get("image_url"))

    if not first_name_val or not email_val or not password_val:
        raise HTTPException(status_code=400, detail="Ism, Email va Parol majburiy")
    _validate_password_strength(password_val)

    existing = db.query(User).filter(User.email == email_val).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ushbu email ro'yxatdan o'tgan")

    _validate_org_exists(db, org_id_val)
    uploaded_image = await _save_user_image(image)

    pw_bytes = password_val.encode("utf-8")[:71]
    hashed = bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")
    legacy_name = _compose_legacy_name(first_name_val, last_name_val, middle_name_val)

    new_user = User(
        name=legacy_name,
        first_name=first_name_val,
        last_name=last_name_val or None,
        middle_name=middle_name_val or None,
        email=email_val,
        phone=phone_val or None,
        image_url=uploaded_image or image_url_val or None,
        hashed_password=hashed,
        role=role_val,
        organization_id=org_id_val,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return _serialize_user(new_user)


@router.put("/api/users/{user_id}")
async def update_user(
    user_id: int,
    request: Request,
    name: Optional[str] = Form(None),
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    middle_name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    role: Optional[str] = Form(None),
    organization_id: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    clear_image: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    payload = await _extract_payload(
        request,
        name=name,
        first_name=first_name,
        last_name=last_name,
        middle_name=middle_name,
        email=email,
        phone=phone,
        password=password,
        role=role,
        organization_id=organization_id,
        image_url=image_url,
        clear_image=clear_image,
    )

    is_json = (request.headers.get("content-type") or "").lower().startswith("application/json")

    if (is_json and "email" in payload) or (not is_json and email is not None):
        email_val = _normalize_email(payload.get("email"))
        if not email_val:
            raise HTTPException(status_code=400, detail="Email majburiy")
        existing = db.query(User).filter(User.email == email_val, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Ushbu email boshqa foydalanuvchida bor")
        user.email = email_val

    if (is_json and "first_name" in payload) or (not is_json and first_name is not None):
        user.first_name = _as_clean_str(payload.get("first_name")) or None

    if (is_json and "last_name" in payload) or (not is_json and last_name is not None):
        user.last_name = _as_clean_str(payload.get("last_name")) or None

    if (is_json and "middle_name" in payload) or (not is_json and middle_name is not None):
        user.middle_name = _as_clean_str(payload.get("middle_name")) or None

    if (is_json and "phone" in payload) or (not is_json and phone is not None):
        user.phone = _as_clean_str(payload.get("phone")) or None

    if (is_json and "role" in payload) or (not is_json and role is not None):
        user.role = _parse_role(payload.get("role"), default=user.role or UserRole.tashkilot_admin)

    has_org = (is_json and "organization_id" in payload) or (not is_json and organization_id is not None)
    if has_org:
        org_id_val = _parse_optional_int(payload.get("organization_id"))
        _validate_org_exists(db, org_id_val)
        user.organization_id = org_id_val

    password_val = _as_clean_str(payload.get("password"))
    if password_val:
        _validate_password_strength(password_val)
        pw_bytes = password_val.encode("utf-8")[:71]
        user.hashed_password = bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")

    clear_image_flag = _as_clean_str(payload.get("clear_image")).lower() in {"1", "true", "yes", "on"}
    uploaded_image = await _save_user_image(image)
    image_url_val = _as_clean_str(payload.get("image_url"))
    if uploaded_image:
        _delete_local_user_image(user.image_url)
        user.image_url = uploaded_image
    elif clear_image_flag:
        _delete_local_user_image(user.image_url)
        user.image_url = None
    elif (is_json and "image_url" in payload) or (not is_json and image_url is not None):
        user.image_url = image_url_val or None

    manual_name = _as_clean_str(payload.get("name"))
    if manual_name:
        user.name = manual_name
    else:
        fn = _as_clean_str(user.first_name)
        ln = _as_clean_str(user.last_name)
        mn = _as_clean_str(user.middle_name)
        user.name = _compose_legacy_name(fn, ln, mn)

    if not user.first_name:
        raise HTTPException(status_code=400, detail="Ism majburiy")

    db.commit()
    db.refresh(user)
    return {"ok": True, "message": "Foydalanuvchi yangilandi", "user": _serialize_user(user)}


@router.delete("/api/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")

    _delete_local_user_image(user.image_url)
    db.delete(user)
    db.commit()
    return {"ok": True, "message": "Foydalanuvchi o'chirildi"}
