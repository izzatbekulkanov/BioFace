import os
import re
import uuid
import json
import unicodedata
from typing import Any, Dict, List, Optional

import bcrypt
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from models import Organization, User, UserOrganizationLink, UserRole
from access_control import (
    normalize_menu_permissions,
    resolve_user_menu_permissions,
    serialize_menu_permissions,
)

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
    status: str = "active"
    google_oauth_enabled: bool = False
    last_login_provider: Optional[str] = None
    google_sub: Optional[str] = None
    organization_id: Optional[int] = None
    organization_name: Optional[str] = None
    organization_ids: List[int] = Field(default_factory=list)
    organization_names: List[str] = Field(default_factory=list)

    class Config:
        from_attributes = True


class UserApprovalPayload(BaseModel):
    role: Optional[str] = None
    organization_id: Optional[int] = None
    organization_ids: List[int] = Field(default_factory=list)
    menu_permissions: Any = Field(default_factory=list)


def _as_clean_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_email(value: Any) -> str:
    return _as_clean_str(value).lower()


def _normalize_username(value: Any) -> str:
    raw = _as_clean_str(value).lower()
    if not raw:
        return ""
    raw = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode("ascii")
    raw = raw.replace("'", "").replace("`", "")
    raw = re.sub(r"[^a-z0-9]+", "_", raw)
    raw = re.sub(r"_+", "_", raw).strip("_")
    return raw


def _normalize_username_part(value: Any) -> str:
    raw = _as_clean_str(value).lower()
    if not raw:
        return ""
    raw = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode("ascii")
    raw = raw.replace("'", "").replace("`", "")
    return re.sub(r"[^a-z0-9]+", "", raw)


def _username_exists(db: Session, username: str, exclude_user_id: Optional[int] = None) -> bool:
    normalized = _normalize_username(username)
    if not normalized:
        return False
    query = db.query(User.id).filter(func.lower(User.name) == normalized)
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    return query.first() is not None


def _build_username_base(first_name: str, last_name: str) -> str:
    parts = [part for part in [_normalize_username_part(first_name), _normalize_username_part(last_name)] if part]
    base = "".join(parts)
    return base or _normalize_username_part(first_name) or _normalize_username_part(last_name) or "user"


def _generate_unique_username(
    db: Session,
    *,
    first_name: str,
    last_name: str,
    preferred: Optional[str] = None,
    exclude_user_id: Optional[int] = None,
) -> str:
    preferred_username = _normalize_username(preferred)
    if preferred_username and not _username_exists(db, preferred_username, exclude_user_id=exclude_user_id):
        return preferred_username

    base = _build_username_base(first_name, last_name)
    if not _username_exists(db, base, exclude_user_id=exclude_user_id):
        return base

    for suffix in range(1, 10000):
        candidate = f"{base}{suffix}"
        if not _username_exists(db, candidate, exclude_user_id=exclude_user_id):
            return candidate

    return f"{base}{uuid.uuid4().hex[:6]}"


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
    link_ids = sorted(
        {
            int(link.organization_id)
            for link in (user.organization_links or [])
            if getattr(link, "organization_id", None) is not None
        }
    )
    org_names: List[str] = []
    for link in (user.organization_links or []):
        org = getattr(link, "organization", None)
        if org and getattr(org, "name", None):
            org_names.append(str(org.name))
    if not link_ids and user.organization_id is not None:
        link_ids = [int(user.organization_id)]
    org_names = sorted({name for name in org_names if name})
    if not org_names and user.organization and user.organization.name:
        org_names = [str(user.organization.name)]

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
        "status": user.status or "active",
        "menu_permissions": user.menu_permissions or "",
        "google_oauth_enabled": bool(user.google_oauth_enabled),
        "last_login_provider": user.last_login_provider or "",
        "google_sub": user.google_sub or "",
        "organization_id": user.organization_id,
        "organization_name": user.organization.name if user.organization else None,
        "organization_ids": link_ids,
        "organization_names": org_names,
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
        raise HTTPException(status_code=400, detail="Rasm faylini yuklashda xato")

    with open(abs_path, "wb") as out:
        out.write(content)
    return f"/static/uploads/users/{filename}"


def _validate_org_exists(db: Session, organization_id: Optional[int]) -> None:
    if organization_id is None:
        return
    org = db.query(Organization).filter(Organization.id == organization_id).first()
    if not org:
        raise HTTPException(status_code=400, detail="Tashkilot topilmadi")


def _parse_optional_int_list(value: Any) -> List[int]:
    if value is None:
        return []
    if isinstance(value, list):
        raw_items = value
    else:
        text = _as_clean_str(value)
        if not text:
            return []
        if text.startswith("["):
            try:
                parsed = json.loads(text)
            except Exception as exc:
                raise HTTPException(status_code=400, detail="organization_ids formati noto'g'ri") from exc
            raw_items = parsed if isinstance(parsed, list) else [parsed]
        else:
            raw_items = [chunk.strip() for chunk in text.split(",") if chunk.strip()]

    result: List[int] = []
    seen: set[int] = set()
    for item in raw_items:
        try:
            org_id = int(str(item).strip())
        except Exception as exc:
            raise HTTPException(status_code=400, detail="organization_ids ichida ID noto'g'ri") from exc
        if org_id <= 0 or org_id in seen:
            continue
        seen.add(org_id)
        result.append(org_id)
    return result


def _parse_menu_permission_list(value: Any, role: UserRole) -> List[str]:
    if value is None:
        raw_items: list[Any] = []
    elif isinstance(value, (list, tuple, set)):
        raw_items = list(value)
    else:
        text = _as_clean_str(value)
        if not text:
            raw_items = []
        elif text.startswith("["):
            try:
                parsed = json.loads(text)
            except Exception as exc:
                raise HTTPException(status_code=400, detail="Menyu ruxsatlari formati noto'g'ri") from exc
            raw_items = parsed if isinstance(parsed, list) else [parsed]
        else:
            raw_items = [chunk.strip() for chunk in text.split(",") if chunk.strip()]

    permissions = normalize_menu_permissions(raw_items)
    if not permissions:
        permissions = resolve_user_menu_permissions(role=role, stored_permissions=None)
    if not permissions:
        raise HTTPException(status_code=400, detail="Kamida bitta menyu ruxsati tanlang")
    return permissions


def _validate_org_ids_exist(db: Session, organization_ids: List[int]) -> None:
    if not organization_ids:
        return
    found = {
        int(row[0])
        for row in db.query(Organization.id).filter(Organization.id.in_(organization_ids)).all()
    }
    missing = [org_id for org_id in organization_ids if org_id not in found]
    if missing:
        raise HTTPException(status_code=400, detail=f"Tashkilot topilmadi: {missing[0]}")


def _sync_user_organization_links(db: Session, user: User, organization_ids: List[int]) -> None:
    db.query(UserOrganizationLink).filter(UserOrganizationLink.user_id == user.id).delete(synchronize_session=False)
    for org_id in organization_ids:
        db.add(UserOrganizationLink(user_id=int(user.id), organization_id=int(org_id)))


async def _extract_payload(
    request: Request,
    *,
    name: Optional[str],
    username: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    middle_name: Optional[str],
    email: Optional[str],
    phone: Optional[str],
    password: Optional[str],
    role: Optional[str],
    status: Optional[str],
    menu_permissions: Optional[str],
    google_oauth_enabled: Optional[str],
    organization_id: Optional[str],
    organization_ids: Optional[str],
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
        "username": username,
        "first_name": first_name,
        "last_name": last_name,
        "middle_name": middle_name,
        "email": email,
        "phone": phone,
        "password": password,
        "role": role,
        "status": status,
        "menu_permissions": menu_permissions,
        "google_oauth_enabled": google_oauth_enabled,
        "organization_id": organization_id,
        "organization_ids": organization_ids,
        "image_url": image_url,
        "clear_image": clear_image,
    }


@router.get("/api/users", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db)):
    users = (
        db.query(User)
        .filter(or_(User.status.is_(None), User.status != "pending"))
        .order_by(User.id.desc())
        .all()
    )
    return [_serialize_user(u) for u in users]


@router.get("/api/users/pending")
def get_pending_users(db: Session = Depends(get_db)):
    users = (
        db.query(User)
        .filter(
            User.google_sub.isnot(None),
            or_(
                User.status == "pending",
                User.google_oauth_enabled.is_(False),
                User.google_oauth_enabled.is_(None),
            ),
        )
        .order_by(User.id.desc())
        .all()
    )
    return {"ok": True, "users": [_serialize_user(u) for u in users]}


@router.post("/api/users/{user_id}/approve")
def approve_user(
    user_id: int,
    payload: Optional[UserApprovalPayload] = Body(None),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    needs_google_approval = bool(user.google_sub) and not bool(user.google_oauth_enabled)
    if (user.status or "") != "pending" and not needs_google_approval:
        raise HTTPException(status_code=400, detail="Foydalanuvchi allaqachon tasdiqlangan")

    approval = payload or UserApprovalPayload()
    role_val = _parse_role(approval.role, default=UserRole.tashkilot_admin)
    org_ids_val = _parse_optional_int_list(approval.organization_ids)
    if not org_ids_val and approval.organization_id is not None:
        org_id_val = _parse_optional_int(approval.organization_id)
        if org_id_val is not None:
            org_ids_val = [int(org_id_val)]
    if not org_ids_val:
        raise HTTPException(status_code=400, detail="Tashkilot tanlang")
    _validate_org_ids_exist(db, org_ids_val)

    menu_permissions_val = _parse_menu_permission_list(approval.menu_permissions, role_val)

    first_name_val = _as_clean_str(user.first_name)
    last_name_val = _as_clean_str(user.last_name)
    fallback_first, fallback_last = _split_name_if_needed(user.name)
    if not last_name_val and fallback_last:
        same_first = _normalize_username_part(fallback_first) == _normalize_username_part(first_name_val)
        if not first_name_val or same_first:
            last_name_val = fallback_last
    if not first_name_val:
        first_name_val = fallback_first
    if not first_name_val and user.email:
        first_name_val = _normalize_email(user.email).split("@", 1)[0]
    first_name_val = first_name_val or "user"

    user.name = _generate_unique_username(
        db,
        first_name=first_name_val,
        last_name=last_name_val,
        exclude_user_id=user.id,
    )
    user.first_name = first_name_val
    user.last_name = last_name_val or None
    user.status = "active"
    user.google_oauth_enabled = True
    user.role = role_val
    user.menu_permissions = serialize_menu_permissions(menu_permissions_val)
    user.organization_id = int(org_ids_val[0])
    user.last_login_provider = "google"
    db.flush()
    _sync_user_organization_links(db, user, org_ids_val)
    db.commit()
    db.refresh(user)
    return {"ok": True, "message": "Foydalanuvchi tasdiqlandi", "user": _serialize_user(user)}


@router.get("/api/users/username/check")
def check_username_available(
    username: str,
    exclude_user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    normalized = _normalize_username(username)
    if not normalized:
        return {"available": False, "message": "Username majburiy"}
    if len(normalized) < 3:
        return {"available": False, "message": "Username kamida 3 belgi bo'lishi kerak"}
    if len(normalized) > 32:
        return {"available": False, "message": "Username 32 belgidan uzun bo'lmasin"}
    if not re.match(r"^[a-z0-9][a-z0-9._-]*[a-z0-9]$", normalized):
        return {"available": False, "message": "Username formati noto'g'ri"}
    available = not _username_exists(db, normalized, exclude_user_id=exclude_user_id)
    return {
        "available": available,
        "message": "Username ishlatish mumkin." if available else "Bu username band.",
        "normalized": normalized,
    }


@router.post("/api/users", response_model=UserResponse)
async def create_user(
    request: Request,
    name: Optional[str] = Form(None),
    username: Optional[str] = Form(None),
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    middle_name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    role: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    menu_permissions: Optional[str] = Form(None),
    google_oauth_enabled: Optional[str] = Form(None),
    organization_id: Optional[str] = Form(None),
    organization_ids: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    clear_image: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    payload = await _extract_payload(
        request,
        name=name,
        username=username,
        first_name=first_name,
        last_name=last_name,
        middle_name=middle_name,
        email=email,
        phone=phone,
        password=password,
        role=role,
        status=status,
        menu_permissions=menu_permissions,
        google_oauth_enabled=google_oauth_enabled,
        organization_id=organization_id,
        organization_ids=organization_ids,
        image_url=image_url,
        clear_image=clear_image,
    )

    raw_name = _as_clean_str(payload.get("name"))
    first_name_val = _as_clean_str(payload.get("first_name"))
    last_name_val = _as_clean_str(payload.get("last_name"))
    middle_name_val = _as_clean_str(payload.get("middle_name"))
    requested_username = _as_clean_str(payload.get("username") or payload.get("name"))

    if not first_name_val and raw_name:
        first_name_val, fallback_last = _split_name_if_needed(raw_name)
        if not last_name_val:
            last_name_val = fallback_last

    email_val = _normalize_email(payload.get("email"))
    phone_val = _as_clean_str(payload.get("phone"))
    password_val = _as_clean_str(payload.get("password"))
    role_val = _parse_role(payload.get("role"))
    status_val = _as_clean_str(payload.get("status")) or "active"
    menu_permissions_val = serialize_menu_permissions(
        _parse_menu_permission_list(payload.get("menu_permissions"), role_val)
    )
    google_oauth_enabled_val = str(payload.get("google_oauth_enabled") or "").strip().lower() in {"1", "true", "yes", "on"}
    org_id_val = _parse_optional_int(payload.get("organization_id"))
    org_ids_val = _parse_optional_int_list(payload.get("organization_ids"))
    if org_ids_val:
        org_id_val = int(org_ids_val[0])
    elif org_id_val is not None:
        org_ids_val = [int(org_id_val)]
    image_url_val = _as_clean_str(payload.get("image_url"))

    if not first_name_val or not email_val or not password_val:
        raise HTTPException(status_code=400, detail="Ism, Email va Parol majburiy")
    _validate_password_strength(password_val)

    existing = db.query(User).filter(User.email == email_val).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ushbu email ro'yxatdan o'tgan")

    username_val = _generate_unique_username(
        db,
        first_name=first_name_val,
        last_name=last_name_val,
        preferred=requested_username,
    )

    _validate_org_exists(db, org_id_val)
    _validate_org_ids_exist(db, org_ids_val)
    uploaded_image = await _save_user_image(image)

    pw_bytes = password_val.encode("utf-8")[:71]
    hashed = bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")

    new_user = User(
        name=username_val,
        first_name=first_name_val,
        last_name=last_name_val or None,
        middle_name=middle_name_val or None,
        email=email_val,
        phone=phone_val or None,
        image_url=uploaded_image or image_url_val or None,
        hashed_password=hashed,
        role=role_val,
        status=status_val,
        menu_permissions=menu_permissions_val,
        google_oauth_enabled=google_oauth_enabled_val,
        organization_id=org_id_val,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    _sync_user_organization_links(db, new_user, org_ids_val)
    db.commit()
    db.refresh(new_user)
    return _serialize_user(new_user)


@router.put("/api/users/{user_id}")
async def update_user(
    user_id: int,
    request: Request,
    name: Optional[str] = Form(None),
    username: Optional[str] = Form(None),
    first_name: Optional[str] = Form(None),
    last_name: Optional[str] = Form(None),
    middle_name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    password: Optional[str] = Form(None),
    role: Optional[str] = Form(None),
    status: Optional[str] = Form(None),
    menu_permissions: Optional[str] = Form(None),
    google_oauth_enabled: Optional[str] = Form(None),
    organization_id: Optional[str] = Form(None),
    organization_ids: Optional[str] = Form(None),
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
        username=username,
        first_name=first_name,
        last_name=last_name,
        middle_name=middle_name,
        email=email,
        phone=phone,
        password=password,
        role=role,
        status=status,
        menu_permissions=menu_permissions,
        google_oauth_enabled=google_oauth_enabled,
        organization_id=organization_id,
        organization_ids=organization_ids,
        image_url=image_url,
        clear_image=clear_image,
    )

    is_json = (request.headers.get("content-type") or "").lower().startswith("application/json")
    requested_username = _as_clean_str(payload.get("username") or payload.get("name"))

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

    if (is_json and "status" in payload) or (not is_json and status is not None):
        user.status = _as_clean_str(payload.get("status")) or "active"

    if (is_json and "menu_permissions" in payload) or (not is_json and menu_permissions is not None):
        menu_permissions_val = _parse_menu_permission_list(
            payload.get("menu_permissions"),
            user.role or UserRole.tashkilot_admin,
        )
        user.menu_permissions = serialize_menu_permissions(menu_permissions_val)

    if (is_json and "google_oauth_enabled" in payload) or (not is_json and google_oauth_enabled is not None):
        user.google_oauth_enabled = str(payload.get("google_oauth_enabled") or "").strip().lower() in {"1", "true", "yes", "on"}

    has_org = (is_json and "organization_id" in payload) or (not is_json and organization_id is not None)
    has_org_ids = (is_json and "organization_ids" in payload) or (not is_json and organization_ids is not None)
    if has_org:
        org_id_val = _parse_optional_int(payload.get("organization_id"))
        _validate_org_exists(db, org_id_val)
        user.organization_id = org_id_val
    if has_org_ids:
        org_ids_val = _parse_optional_int_list(payload.get("organization_ids"))
        _validate_org_ids_exist(db, org_ids_val)
        if org_ids_val:
            user.organization_id = int(org_ids_val[0])
        elif has_org:
            # has_org allaqachon set qilgan qiymatni saqlaymiz
            pass
        else:
            user.organization_id = None
        db.flush()
        _sync_user_organization_links(db, user, org_ids_val)
    elif has_org:
        fallback_ids = [int(user.organization_id)] if user.organization_id is not None else []
        db.flush()
        _sync_user_organization_links(db, user, fallback_ids)

    password_val = _as_clean_str(payload.get("password"))
    if password_val:
        _validate_password_strength(password_val)
        pw_bytes = password_val.encode("utf-8")[:71]
        user.hashed_password = bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")

    clear_image_flag = _as_clean_str(payload.get("clear_image")).lower() in {"1", "true", "yes", "on"}
    uploaded_image = await _save_user_image(image)
    image_url_val = _as_clean_str(payload.get("image_url"))
    if uploaded_image:
        if user.image_url:
            prefix = "/static/uploads/users/"
            if user.image_url.startswith(prefix):
                rel_name = user.image_url[len(prefix) :]
                abs_path = os.path.join(USER_UPLOAD_DIR, rel_name)
                if os.path.exists(abs_path):
                    try:
                        os.remove(abs_path)
                    except OSError:
                        pass
        user.image_url = uploaded_image
    elif clear_image_flag:
        if user.image_url:
            prefix = "/static/uploads/users/"
            if user.image_url.startswith(prefix):
                rel_name = user.image_url[len(prefix) :]
                abs_path = os.path.join(USER_UPLOAD_DIR, rel_name)
                if os.path.exists(abs_path):
                    try:
                        os.remove(abs_path)
                    except OSError:
                        pass
        user.image_url = None
    elif (is_json and "image_url" in payload) or (not is_json and image_url is not None):
        user.image_url = image_url_val or None

    manual_name = _normalize_username(requested_username)
    if manual_name:
        user.name = _generate_unique_username(
            db,
            first_name=_as_clean_str(user.first_name),
            last_name=_as_clean_str(user.last_name),
            preferred=manual_name,
            exclude_user_id=user.id,
        )
    else:
        fn = _as_clean_str(user.first_name)
        ln = _as_clean_str(user.last_name)
        user.name = _generate_unique_username(
            db,
            first_name=fn,
            last_name=ln,
            exclude_user_id=user.id,
        )

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

    if user.image_url:
        prefix = "/static/uploads/users/"
        if user.image_url.startswith(prefix):
            rel_name = user.image_url[len(prefix) :]
            abs_path = os.path.join(USER_UPLOAD_DIR, rel_name)
            if os.path.exists(abs_path):
                try:
                    os.remove(abs_path)
                except OSError:
                    pass
    db.delete(user)
    db.commit()
    return {"ok": True, "message": "Foydalanuvchi o'chirildi"}
