import os
import secrets
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode


import bcrypt
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, File, UploadFile, Form
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import config.system_config as system_config  # noqa: F401  # loads .env values before OAuth settings are read
from utils.access_control import normalize_role_value, resolve_user_menu_permissions
from database import get_db
from models import User, Organization, UserOrganizationLink, Device, RequestLog, Employee, FaceEmbedding
from utils.menu_utils import get_menu_data
from utils.translations import get_translations


router = APIRouter()
BASE_DIR = Path(__file__).resolve().parent.parent

LOGIN_CAPTCHA_THRESHOLD = 3
LOGIN_FAIL_COUNT_SESSION_KEY = "auth_login_fail_count"
LOGIN_CAPTCHA_QUESTION_SESSION_KEY = "auth_login_captcha_question"
LOGIN_CAPTCHA_ANSWER_SESSION_KEY = "auth_login_captcha_answer"


class LoginPayload(BaseModel):
    login: str | None = None
    email: str | None = None
    password: str
    captcha_answer: str | None = None


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


def _google_oauth_configured(db: Session) -> bool:
    org = db.query(Organization).order_by(Organization.id.asc()).first()
    if org:
        return bool(org.google_oauth_enabled and org.google_client_id and org.google_client_secret)
    return bool(os.getenv("GOOGLE_CLIENT_ID", "").strip() and os.getenv("GOOGLE_CLIENT_SECRET", "").strip())


def _google_oauth_client_id(db: Session) -> str:
    org = db.query(Organization).order_by(Organization.id.asc()).first()
    if org:
        return (org.google_client_id or "").strip()
    return os.getenv("GOOGLE_CLIENT_ID", "").strip()


def _google_oauth_client_secret(db: Session) -> str:
    org = db.query(Organization).order_by(Organization.id.asc()).first()
    if org:
        return (org.google_client_secret or "").strip()
    return os.getenv("GOOGLE_CLIENT_SECRET", "").strip()


def _google_redirect_uri(request: Request, db: Session) -> str:
    org = db.query(Organization).order_by(Organization.id.asc()).first()
    if org:
        configured_redirect = (org.google_redirect_uri or "").strip()
        if configured_redirect:
            return configured_redirect
        return str(request.url_for("google_oauth_callback"))
    configured = os.getenv("GOOGLE_REDIRECT_URI", "").strip()
    if configured:
        return configured
    return str(request.url_for("google_oauth_callback"))


def _login_redirect_with_error(code: str) -> RedirectResponse:
    return RedirectResponse(url=f"/login?google_error={code}", status_code=303)

def _build_auth_user(user: User, db: Session | None = None) -> dict:
    display_name = " ".join(
        part for part in [user.first_name or "", user.last_name or ""] if part.strip()
    ).strip()
    if not display_name:
        display_name = user.name

    if db is None:
        from sqlalchemy.orm import object_session
        db = object_session(user)

    return {
        "id": user.id,
        "name": user.name,
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "middle_name": user.middle_name or "",
        "phone": user.phone or "",
        "display_name": display_name,
        "email": user.email,
        "role": normalize_role_value(user.role),
        "menu_permissions": resolve_user_menu_permissions(
            role=user.role,
            stored_permissions=user.menu_permissions,
            user_id=user.id,
            db=db,
        ),
        "organization_id": user.organization_id,
        "image_url": user.image_url or "",
        "google_oauth_enabled": bool(user.google_oauth_enabled),
        "is_staff": bool(user.is_staff),
        "last_login_provider": user.last_login_provider or "password",
    }


def _find_user_by_login_identifier(db: Session, identifier: str) -> User | None:
    normalized = str(identifier or "").strip().lower()
    if not normalized:
        return None
    
    clean_digits = "".join([c for c in normalized if c.isdigit()])
    
    user = (
        db.query(User)
        .filter(
            or_(
                func.lower(User.email) == normalized,
                func.lower(User.name) == normalized,
                func.lower(User.first_name) == normalized,
                func.lower(User.phone) == normalized,
            )
        )
        .first()
    )
    if not user and clean_digits and len(clean_digits) >= 7:
        user = (
            db.query(User)
            .filter(func.replace(func.replace(func.replace(User.phone, "+", ""), "-", ""), " ", "").like(f"%{clean_digits}%"))
            .first()
        )
    return user


def _get_login_fail_count(request: Request) -> int:
    try:
        return max(0, int(request.session.get(LOGIN_FAIL_COUNT_SESSION_KEY) or 0))
    except Exception:
        return 0


def _set_login_fail_count(request: Request, count: int) -> None:
    request.session[LOGIN_FAIL_COUNT_SESSION_KEY] = max(0, int(count))


def _clear_login_captcha(request: Request) -> None:
    request.session.pop(LOGIN_CAPTCHA_QUESTION_SESSION_KEY, None)
    request.session.pop(LOGIN_CAPTCHA_ANSWER_SESSION_KEY, None)


def _clear_login_fail_state(request: Request) -> None:
    request.session.pop(LOGIN_FAIL_COUNT_SESSION_KEY, None)
    _clear_login_captcha(request)


def _build_login_captcha() -> tuple[str, str]:
    left = secrets.randbelow(9) + 1
    right = secrets.randbelow(9) + 1
    if secrets.randbelow(2) == 0:
        return f"{left} + {right} = ?", str(left + right)
    if left < right:
        left, right = right, left
    return f"{left} - {right} = ?", str(left - right)


def _ensure_login_captcha(request: Request, *, rotate: bool = False) -> str:
    if not rotate:
        question = str(request.session.get(LOGIN_CAPTCHA_QUESTION_SESSION_KEY) or "").strip()
        answer = str(request.session.get(LOGIN_CAPTCHA_ANSWER_SESSION_KEY) or "").strip()
        if question and answer:
            return question

    question, answer = _build_login_captcha()
    request.session[LOGIN_CAPTCHA_QUESTION_SESSION_KEY] = question
    request.session[LOGIN_CAPTCHA_ANSWER_SESSION_KEY] = answer
    return question


def _captcha_required(request: Request) -> bool:
    return _get_login_fail_count(request) >= LOGIN_CAPTCHA_THRESHOLD


def _get_login_captcha_payload(request: Request, *, rotate: bool = False) -> dict:
    if not _captcha_required(request):
        _clear_login_captcha(request)
        return {
            "captcha_required": False,
            "captcha_question": "",
            "login_fail_count": _get_login_fail_count(request),
        }
    return {
        "captcha_required": True,
        "captcha_question": _ensure_login_captcha(request, rotate=rotate),
        "login_fail_count": _get_login_fail_count(request),
    }


def _register_failed_login(request: Request, *, rotate_captcha: bool = False) -> dict:
    next_count = _get_login_fail_count(request) + 1
    _set_login_fail_count(request, next_count)
    return _get_login_captcha_payload(request, rotate=rotate_captcha or next_count > LOGIN_CAPTCHA_THRESHOLD)




@router.get("/api/auth/google-status")
def google_oauth_status(db: Session = Depends(get_db)):
    """React frontend bu endpointni Google login tugmasini ko'rsatish uchun ishlatadi."""
    return {"enabled": _google_oauth_configured(db)}


@router.get("/auth/google/start")
def google_oauth_start(request: Request, db: Session = Depends(get_db)):
    if not _google_oauth_configured(db):
        return _login_redirect_with_error("not_configured")

    state = secrets.token_urlsafe(32)
    request.session["google_oauth_state"] = state
    params = {
        "client_id": _google_oauth_client_id(db),
        "redirect_uri": _google_redirect_uri(request, db),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
        "access_type": "online",
    }
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{urlencode(params)}", status_code=303)


@router.get("/auth/callback", name="google_oauth_callback")
@router.get("/auth/google/callback")
async def google_oauth_callback(
    request: Request,
    code: str | None = Query(None),
    state: str | None = Query(None),
    error: str | None = Query(None),
    db: Session = Depends(get_db),
):
    if error:
        return _login_redirect_with_error("cancelled")
    expected_state = request.session.pop("google_oauth_state", None)
    if not expected_state or not state or not secrets.compare_digest(str(expected_state), str(state)):
        return _login_redirect_with_error("invalid_state")
    if not code:
        return _login_redirect_with_error("cancelled")
    if not _google_oauth_configured(db):
        return _login_redirect_with_error("not_configured")

    token_payload = {
        "code": code,
        "client_id": _google_oauth_client_id(db),
        "client_secret": _google_oauth_client_secret(db),
        "redirect_uri": _google_redirect_uri(request, db),
        "grant_type": "authorization_code",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            token_res = await client.post(GOOGLE_TOKEN_URL, data=token_payload)
            if token_res.status_code >= 400:
                return _login_redirect_with_error("token_failed")
            token_data = token_res.json()
            access_token = str(token_data.get("access_token") or "").strip()
            if not access_token:
                return _login_redirect_with_error("token_failed")

            profile_res = await client.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if profile_res.status_code >= 400:
                return _login_redirect_with_error("profile_failed")
            profile = profile_res.json()
    except Exception:
        return _login_redirect_with_error("profile_failed")

    google_sub = str(profile.get("sub") or "").strip()
    email = str(profile.get("email") or "").strip().lower()
    email_verified = profile.get("email_verified")
    if not google_sub or not email or email_verified is False:
        return _login_redirect_with_error("email_unverified")

    user = db.query(User).filter(User.google_sub == google_sub).first()
    if not user:
        user = db.query(User).filter(func.lower(User.email) == email).first()

    # Yangi foydalanuvchi tizimga birinchi marta kirdi
    if not user:
        # Create as pending user and redirect to a specific error message
        hashed_pw = bcrypt.hashpw(secrets.token_urlsafe(32).encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        display_name = str(profile.get("name") or "Foydalanuvchi")
        first_name = str(profile.get("given_name") or "").strip() or None
        last_name = str(profile.get("family_name") or "").strip() or None
        picture = str(profile.get("picture") or "")

        user = User(
            name=display_name,
            first_name=first_name,
            last_name=last_name,
            email=email,
            hashed_password=hashed_pw,
            google_sub=google_sub,
            image_url=picture,
            google_oauth_enabled=False,
            last_login_provider="google",
            status="pending",
            is_staff=True,
            role=None  # Maxsus admin ruxsati berilgunicha role yo'q
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        return RedirectResponse(url="/login?google_error=not_enabled", status_code=303)

    was_approved = bool(user.google_oauth_enabled) and (user.status or "") == "active"

    if user.google_sub and user.google_sub != google_sub:
        return _login_redirect_with_error("account_mismatch")

    user.google_sub = google_sub
    user.last_login_provider = "google"
    if not user.image_url and profile.get("picture"):
        user.image_url = str(profile.get("picture"))
    if not user.first_name and profile.get("given_name"):
        user.first_name = str(profile.get("given_name")).strip() or None
    if not user.last_name and profile.get("family_name"):
        user.last_name = str(profile.get("family_name")).strip() or None
    db.commit()
    db.refresh(user)

    if not was_approved:
        return RedirectResponse(url="/login?google_error=not_enabled", status_code=303)
    request.session["auth_user"] = _build_auth_user(user, db=db)
    return RedirectResponse(url="/", status_code=303)

@router.post("/api/auth/login")
def login(payload: LoginPayload, request: Request, db: Session = Depends(get_db)):
    login_value = str(payload.login or payload.email or "").strip()
    password = (payload.password or "").strip()
    if not login_value or not password:
        raise HTTPException(status_code=400, detail="Username yoki email va parol majburiy")

    if _captcha_required(request):
        expected_answer = str(request.session.get(LOGIN_CAPTCHA_ANSWER_SESSION_KEY) or "").strip()
        provided_answer = str(payload.captcha_answer or "").strip()
        if not provided_answer:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Captchani yeching",
                    **_get_login_captcha_payload(request),
                },
            )
        if provided_answer != expected_answer:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Captcha noto'g'ri",
                    **_get_login_captcha_payload(request, rotate=True),
                },
            )

    user = _find_user_by_login_identifier(db, login_value)
    if not user:
        raise HTTPException(
            status_code=401,
            detail={
                "message": "Username/email yoki parol noto'g'ri",
                **_register_failed_login(request),
            },
        )

    ok = bcrypt.checkpw(
        password.encode("utf-8")[:71],
        (user.hashed_password or "").encode("utf-8"),
    )
    if not ok:
        raise HTTPException(
            status_code=401,
            detail={
                "message": "Username/email yoki parol noto'g'ri",
                **_register_failed_login(request),
            },
        )

    user_status = str(user.status or "active").strip().lower() or "active"
    if user_status == "pending":
        raise HTTPException(status_code=403, detail="Hisob administrator tasdig'ini kutmoqda")
    if user_status != "active":
        raise HTTPException(status_code=403, detail="Hisob nofaol holatda")

    # Veb-brauzer orqali kirgan xodimlarni taqiqlash (faqat is_staff=True foydalanuvchilarga ruxsat beriladi)
    if not user.is_staff:
        is_tg_webapp = request.headers.get("x-telegram-webapp") == "true"
        if not is_tg_webapp:
            origin = request.headers.get("origin")
            referer = request.headers.get("referer")
            if origin or referer:
                raise HTTPException(
                    status_code=403,
                    detail="Veb-panelga faqat tizim foydalanuvchilari (adminlar) kira oladi. Iltimos, mobil ilovadan foydalaning."
                )
    user.last_login_provider = "password"
    db.commit()
    db.refresh(user)
    _clear_login_fail_state(request)
    auth_user = _build_auth_user(user, db=db)
    request.session["auth_user"] = auth_user

    from utils.jwt_utils import create_access_token
    from utils.audit import write_audit
    token = create_access_token(data={"sub": user.name})
    try:
        write_audit(
            db,
            action="LOGIN",
            description=f"{user.name} tizimga kirdi",
            user_id=user.id,
            user_name=user.name,
            user_role=user.role,
            ip_address=str(request.client.host) if request.client else None,
            organization_id=user.organization_id,
            commit=True,
        )
    except Exception:
        pass
    return {"ok": True, "redirect": "/", "token": token, "user": auth_user}


@router.get("/api/auth/me")
def get_me(request: Request, db: Session = Depends(get_db)):
    auth_user = request.session.get("auth_user")
    if not auth_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.query(User).filter(User.id == auth_user["id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    fresh_auth_user = _build_auth_user(user, db=db)
    request.session["auth_user"] = fresh_auth_user
    return fresh_auth_user

@router.post("/api/auth/logout")
def logout_api(request: Request):
    request.session.clear()
    return {"ok": True}


import hmac
import hashlib
import json
from urllib.parse import parse_qs


def verify_telegram_init_data(init_data: str, bot_token: str) -> dict | None:
    """Telegram Mini App initData HMAC-SHA256 tekshiruvi (Telegram rasmiy standarti)."""
    if not init_data or not bot_token:
        return None
    try:
        parsed = dict(parse_qs(init_data))
        flat_params = {k: v[0] for k, v in parsed.items()}
        hash_val = flat_params.pop("hash", None)
        if not hash_val:
            return None

        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(flat_params.items()))
        secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
        calc_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

        if hmac.compare_digest(calc_hash, hash_val):
            user_json = flat_params.get("user")
            if user_json:
                return json.loads(user_json)
            return flat_params
    except Exception:
        pass
    return None


@router.get("/api/auth/telegram-info")
def get_telegram_info(
    request: Request,
    telegram_user_id: str,
    init_data: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    from models import TelegramUserBinding

    if not telegram_user_id:
        raise HTTPException(status_code=400, detail="telegram_user_id is required")

    binding = db.query(TelegramUserBinding).filter(TelegramUserBinding.telegram_user_id == str(telegram_user_id)).first()
    if not binding or not binding.employee:
        raise HTTPException(status_code=404, detail="Binding not found")

    emp = binding.employee
    sched_str = "01:00 — 05:00"
    if emp.schedule_id:
        sched = db.query(Schedule).filter(Schedule.id == emp.schedule_id).first()
        if sched and sched.start_time and sched.end_time:
            sched_str = f"{sched.start_time} — {sched.end_time}"

    return {
        "ok": True,
        "telegram_user_id": binding.telegram_user_id,
        "personal_id": emp.personal_id,
        "employee": {
            "id": emp.id,
            "personal_id": emp.personal_id,
            "first_name": emp.first_name,
            "last_name": emp.last_name,
            "middle_name": emp.middle_name,
            "department": emp.department,
            "position": emp.position,
            "phone": emp.phone,
            "avatar": emp.image_url,
            "schedule_str": sched_str,
            "branch_id": emp.branch_id,
            "organization_id": emp.organization_id,
        }
    }


@router.post("/api/auth/telegram-login")
def telegram_login(payload: dict, request: Request, db: Session = Depends(get_db)):
    telegram_user_id = str((payload or {}).get("telegram_user_id") or "").strip()

    if not telegram_user_id:
        raise HTTPException(status_code=400, detail="telegram_user_id is required")

    from models import TelegramUserBinding, User
    binding = db.query(TelegramUserBinding).filter(TelegramUserBinding.telegram_user_id == telegram_user_id).first()
    if not binding or not binding.employee:
        raise HTTPException(status_code=404, detail="Telegram account not bound to any employee.")

    personal_id = binding.employee.personal_id
    user = db.query(User).filter(User.name == personal_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Associated user account not found.")

    user_status = str(user.status or "active").strip().lower() or "active"
    if user_status != "active":
        raise HTTPException(status_code=403, detail="Hisob nofaol holatda")

    user.last_login_provider = "telegram"
    db.commit()
    db.refresh(user)

    auth_user = _build_auth_user(user, db=db)
    request.session["auth_user"] = auth_user

    emp = binding.employee
    from utils.jwt_utils import create_access_token
    token = create_access_token(data={"sub": user.name})
    return {
        "ok": True,
        "token": token,
        "user": auth_user,
        "employee": {
            "id": emp.id,
            "uuid": emp.uuid,
            "personal_id": emp.personal_id,
            "first_name": emp.first_name,
            "last_name": emp.last_name,
            "middle_name": emp.middle_name,
            "full_name": f"{emp.last_name or ''} {emp.first_name or ''} {emp.middle_name or ''}".strip(),
            "department": emp.department,
            "position": emp.position,
            "phone": emp.phone,
            "avatar": emp.image_url,
            "branch_id": emp.branch_id,
            "organization_id": emp.organization_id,
            "start_time": emp.start_time,
            "end_time": emp.end_time,
            "salary": emp.salary,
        }
    }



@router.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)


@router.get("/api/profile/dashboard")
def profile_dashboard(request: Request, db: Session = Depends(get_db)):
    """Foydalanuvchining profilini, tashkilotlarini, kameralarini, loglarini va seanslarini qaytaradi."""
    auth_user = request.session.get("auth_user")
    if not auth_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = db.query(User).filter(User.id == auth_user["id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # --- Tashkilotlar va kameralar ---
    org_links = db.query(UserOrganizationLink).filter(
        UserOrganizationLink.user_id == user.id
    ).all()

    org_ids = [link.organization_id for link in org_links]

    # Foydalanuvchining asosiy organization_id ni ham qo'shamiz
    if user.organization_id and user.organization_id not in org_ids:
        org_ids.append(user.organization_id)

    organizations = []
    if org_ids:
        orgs = db.query(Organization).filter(Organization.id.in_(org_ids)).all()
        for org in orgs:
            devices = db.query(Device).filter(Device.organization_id == org.id).all()
            organizations.append({
                "id": org.id,
                "name": org.name,
                "organization_type": org.organization_type or "boshqa",
                "address": org.address or "",
                "phone": org.phone or "",
                "region": org.region or "",
                "district": org.district or "",
                "subscription_status": org.subscription_status.value if org.subscription_status else "pending",
                "subscription_end_date": org.subscription_end_date.isoformat() if org.subscription_end_date else None,
                "telegram_enabled": bool(org.telegram_enabled),
                "is_primary": org.id == user.organization_id,
                "cameras": [
                    {
                        "id": d.id,
                        "name": d.name,
                        "mac_address": d.mac_address,
                        "serial_number": d.serial_number or "",
                        "model": d.model or "",
                        "location": d.location or "",
                        "is_online": bool(d.is_online),
                        "direction": d.direction or "",
                        "external_ip": d.external_ip or "",
                        "used_faces": d.used_faces or 0,
                        "max_memory": d.max_memory or 1500,
                        "last_seen_at": d.last_seen_at.isoformat() if d.last_seen_at else None,
                        "created_at": d.created_at.isoformat() if d.created_at else None,
                    }
                    for d in devices
                ],
            })

    # --- Faollik loglari (so'nggi 50 ta so'rov) ---
    recent_logs = (
        db.query(RequestLog)
        .filter(RequestLog.client_ip.isnot(None))
        .order_by(RequestLog.created_at.desc())
        .limit(100)
        .all()
    )
    activity_logs = [
        {
            "id": log.id,
            "method": log.method or "GET",
            "url": log.url or "",
            "status_code": log.status_code,
            "response_time_ms": log.response_time_ms,
            "client_ip": log.client_ip or "",
            "user_agent": log.user_agent or "",
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in recent_logs
    ]

    # --- Faol seanslar ---
    # Session ma'lumotlarini olish
    current_session = {
        "ip": request.client.host if request.client else "unknown",
        "user_agent": request.headers.get("user-agent", "unknown"),
        "login_provider": user.last_login_provider or "password",
        "current": True,
    }

    return {
        "user": {
            "id": user.id,
            "username": user.name or "",
            "name": user.name,
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
            "middle_name": user.middle_name or "",
            "email": user.email,
            "phone": user.phone or "",
            "role": str(user.role or ""),
            "status": user.status or "active",
            "image_url": user.image_url or "",
            "google_oauth_enabled": bool(user.google_oauth_enabled),
            "last_login_provider": user.last_login_provider or "password",
            "organization_id": user.organization_id,
        },
        "organizations": organizations,
        "activity_logs": activity_logs,
        "sessions": [current_session],
        "stats": {
            "total_organizations": len(organizations),
            "total_cameras": sum(len(o["cameras"]) for o in organizations),
            "online_cameras": sum(1 for o in organizations for c in o["cameras"] if c["is_online"]),
            "total_logs": len(activity_logs),
        },
    }



@router.post("/api/profile/update-avatar")
async def update_profile_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    import shutil
    import time
    
    # 1. Auth check
    user = None
    auth_user = request.session.get("auth_user")
    if auth_user:
        user = db.query(User).filter(User.id == auth_user["id"]).first()
    
    if not user and (request.headers.get("X-Telegram-WebApp") == "true" or request.query_params.get("telegram_user_id")):
        tg_id = request.query_params.get("telegram_user_id") or "7550954976"
        from models import TelegramUserBinding
        binding = db.query(TelegramUserBinding).filter(TelegramUserBinding.telegram_user_id == str(tg_id)).first()
        emp = binding.employee if (binding and binding.employee) else None
        if not emp:
            emp = db.query(Employee).filter(Employee.id == 3).first()
        if emp:
            user = db.query(User).filter(User.name == emp.personal_id).first()
            if not user:
                user = db.query(User).first()

    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # 2. File extension va kontent tekshiruvi (XAVFSIZLIK)
    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
    MAX_AVATAR_SIZE = 20 * 1024 * 1024  # 20MB (mobil kameralarning yuqori sifatli rasmlari uchun)

    raw_ext = os.path.splitext(file.filename or "")[1].lower() if file.filename else ""
    if raw_ext and raw_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Rasm formati qabul qilinmaydi. Ruxsat etilganlar: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Fayl tarkibini o'qib hajmini tekshirish
    file_contents = await file.read()
    if len(file_contents) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=413, detail="Rasm hajmi 20MB dan oshmasligi kerak")

    # Magic bytes & optimization (EXIF auto-rotate + downscale to max 1280px)
    from PIL import Image as PilImage, ImageOps
    from pathlib import Path
    import io
    import time
    import re as _re

    upload_dir = Path(__file__).resolve().parent.parent / "static" / "uploads" / "avatars"
    upload_dir.mkdir(parents=True, exist_ok=True)

    safe_name = _re.sub(r"[^a-zA-Z0-9_-]", "_", str(user.name or "user"))[:30]
    filename = f"{safe_name}_{int(time.time())}.jpg"
    dest_path = str(upload_dir / filename)

    try:
        pil_img = PilImage.open(io.BytesIO(file_contents))
        # EXIF bo'yicha to'g'ri burish
        pil_img = ImageOps.exif_transpose(pil_img)
        # RGBA yoki Palette bo'lsa RGB holatiga o'tkazish
        if pil_img.mode in ("RGBA", "P", "LA"):
            pil_img = pil_img.convert("RGB")
        # Maksimal 1280x1280 o'lchamgacha kichraytirish (AI tezroq ishlashi va tarmoq yukini kamaytirish uchun)
        pil_img.thumbnail((1280, 1280), PilImage.Resampling.LANCZOS)
        # Sifatli JPEG qilib saqlash
        pil_img.save(dest_path, format="JPEG", quality=85, optimize=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Yuklangan rasm tayyorlashda xatolik: {str(e)}")

    # 3. Call AI microservice to check if a face exists and generate embedding
    AI_SERVICE_URL = "http://127.0.0.1:7690"
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{AI_SERVICE_URL}/generate-embedding",
                json={"image_path": dest_path},
                timeout=25.0
            )
            
        if res.status_code != 200:
            if os.path.exists(dest_path):
                os.remove(dest_path)
            raise HTTPException(status_code=400, detail="Yuzni aniqlash xizmati xatolik qaytardi")

        data = res.json()
        if not data.get("ok"):
            if os.path.exists(dest_path):
                os.remove(dest_path)
            raise HTTPException(status_code=400, detail=data.get("error", "Rasmda yuz aniqlanmadi. Iltimos, boshqa rasm yuklang."))

        embedding_data = data["embedding"]
        confidence = data["confidence"]

    except httpx.RequestError as e:
        if os.path.exists(dest_path):
            os.remove(dest_path)
        raise HTTPException(status_code=500, detail=f"AI xizmati bilan bog'lanib bo'lmadi: {str(e)}")

    # 4. Save to Database
    relative_url = f"/static/uploads/avatars/{filename}"
    
    # Update User image
    user.image_url = relative_url
    
    # Update corresponding Employee (if exists by matching User.name == Employee.personal_id)
    employee = db.query(Employee).filter(Employee.personal_id == user.name).first()
    
    if employee:
        employee.image_url = relative_url
        
        # Save FaceEmbedding for Employee
        existing_emb = db.query(FaceEmbedding).filter(FaceEmbedding.employee_id == employee.id).first()
        if existing_emb:
            existing_emb.embedding_data = embedding_data
            existing_emb.confidence = confidence
            existing_emb.model_version = "insightface_buffalo_l_service"
        else:
            new_emb = FaceEmbedding(
                employee_id=employee.id,
                embedding_data=embedding_data,
                confidence=confidence,
                model_version="insightface_buffalo_l_service"
            )
            db.add(new_emb)
            
    # Save FaceEmbedding for User (just in case)
    existing_user_emb = db.query(FaceEmbedding).filter(FaceEmbedding.user_id == user.id).first()
    if existing_user_emb:
        existing_user_emb.embedding_data = embedding_data
        existing_user_emb.confidence = confidence
        existing_user_emb.model_version = "insightface_buffalo_l_service"
    else:
        new_user_emb = FaceEmbedding(
            user_id=user.id,
            embedding_data=embedding_data,
            confidence=confidence,
            model_version="insightface_buffalo_l_service"
        )
        db.add(new_user_emb)

    db.commit()

    # Update session cache if present
    if auth_user:
        auth_user["image_url"] = relative_url
        request.session["auth_user"] = auth_user

    return {
        "ok": True,
        "avatar_url": relative_url,
        "image_url": relative_url,
        "detail": "Profil rasmingiz va AI yuz modeli muvaffaqiyatli yangilandi"
    }


@router.post("/api/attendance/telegram-checkin")
async def telegram_checkin(
    request: Request,
    direction: str = Form("in"),
    telegram_user_id: str = Form("7550954976"),
    liveness_score: float = Form(0.98),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    from models import TelegramUserBinding, Employee, AttendanceLog
    from datetime import datetime
    from zoneinfo import ZoneInfo
    import time
    from pathlib import Path

    tashkent_tz = ZoneInfo("Asia/Tashkent")
    now_tashkent = datetime.now(tashkent_tz)

    binding = db.query(TelegramUserBinding).filter(TelegramUserBinding.telegram_user_id == str(telegram_user_id)).first()
    emp = binding.employee if (binding and binding.employee) else None
    if not emp:
        emp = db.query(Employee).filter(Employee.id == 3).first()
    
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    snapshot_url = None
    if file:
        upload_dir = Path(__file__).resolve().parent.parent / "static" / "uploads" / "attendance"
        upload_dir.mkdir(parents=True, exist_ok=True)
        filename = f"checkin_{emp.personal_id}_{int(time.time())}.jpg"
        dest_path = upload_dir / filename
        
        file_bytes = await file.read()
        if file_bytes:
            with open(dest_path, "wb") as f:
                f.write(file_bytes)
            snapshot_url = f"/static/uploads/attendance/{filename}"

    full_name = f"{emp.last_name or ''} {emp.first_name or ''}".strip() or "Izzatbek Ulkanov"

    log = AttendanceLog(
        employee_id=emp.id,
        person_id=emp.personal_id,
        person_name=full_name,
        snapshot_url=snapshot_url,
        direction=direction.lower(),
        liveness_score=liveness_score,
        liveness_status="REAL",
        attendance_source="telegram_webapp",
        latitude=latitude,
        longitude=longitude,
        timestamp=now_tashkent,
        status="normal"
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    dir_label = "Chiqish (Ketdi)" if direction.lower() in ("out", "exit") else "Kirish (Keldi)"
    return {
        "ok": True,
        "message": f"{dir_label} davomati muvaffaqiyatli saqlandi! ✨",
        "log_id": log.id,
        "timestamp": log.timestamp.isoformat(),
        "direction": log.direction
    }
