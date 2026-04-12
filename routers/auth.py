import os
import secrets
from urllib.parse import urlencode

import bcrypt
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import system_config  # noqa: F401  # loads .env values before OAuth settings are read
from access_control import resolve_user_menu_permissions
from database import get_db
from models import User, Organization
from menu_utils import get_menu_data
from translations import get_translations


router = APIRouter()
templates = Jinja2Templates(directory="templates")

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


def _get_brand_settings() -> dict:
    data = get_menu_data()
    app_name = (data.get("app_name") or "").strip() or "BioFace"
    logo_url = (data.get("logo_url") or "").strip()
    favicon_url = (data.get("favicon_url") or "").strip()
    return {
        "app_name": app_name,
        "logo_url": logo_url,
        "favicon_url": favicon_url,
    }


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


def _build_auth_user(user: User) -> dict:
    display_name = " ".join(
        part for part in [user.first_name or "", user.last_name or ""] if part.strip()
    ).strip()
    if not display_name:
        display_name = user.name
    return {
        "id": user.id,
        "name": user.name,
        "display_name": display_name,
        "email": user.email,
        "role": user.role.value if user.role else "",
        "menu_permissions": resolve_user_menu_permissions(role=user.role, stored_permissions=user.menu_permissions),
        "organization_id": user.organization_id,
        "image_url": user.image_url or "",
        "google_oauth_enabled": bool(user.google_oauth_enabled),
        "last_login_provider": user.last_login_provider or "password",
    }


def _find_user_by_login_identifier(db: Session, identifier: str) -> User | None:
    normalized = str(identifier or "").strip().lower()
    if not normalized:
        return None
    return (
        db.query(User)
        .filter(
            or_(
                func.lower(User.email) == normalized,
                func.lower(User.name) == normalized,
            )
        )
        .first()
    )


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


@router.get("/login")
def login_page(request: Request, db: Session = Depends(get_db)):
    if request.session.get("auth_user"):
        return RedirectResponse(url="/", status_code=303)
    lang = request.cookies.get("lang", "uz")
    brand = _get_brand_settings()
    google_error = (request.query_params.get("google_error") or "").strip()
    google_error_messages = {
        "not_configured": "Google OAuth sozlanmagan",
        "cancelled": "Google orqali kirish bekor qilindi",
        "invalid_state": "Google sessiyasi eskirdi. Qayta urinib ko'ring",
        "token_failed": "Google tokenini olishda xatolik",
        "profile_failed": "Google profilini olishda xatolik",
        "email_unverified": "Google email tasdiqlanmagan",
        "no_user": "Bu Google email uchun tizim foydalanuvchisi topilmadi",
        "not_enabled": "Sizning tizimga kirish bo'yicha so'rovingiz administratorga yuborildi. Iltimos, administrator javobini kuting.",
        "account_mismatch": "Google akkaunt boshqa foydalanuvchiga biriktirilgan",
        "pending_approval": "Sizning tizimga kirish bo'yicha so'rovingiz administratorga yuborildi. Iltimos, administrator javobini kuting.",
    }
    return templates.TemplateResponse(
        request=request,
        name="login.html",
        context={
            "request": request,
            "lang": lang,
            "google_oauth_configured": _google_oauth_configured(db),
            "google_error_message": google_error_messages.get(google_error, ""),
            **_get_login_captcha_payload(request),
            **brand,
        },
    )


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
            role=None  # Maxsus admin ruxsati berilgunicha role yo'q
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        return RedirectResponse(url="/pending-approval", status_code=303)

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
        return RedirectResponse(url="/pending-approval", status_code=303)

    request.session["auth_user"] = _build_auth_user(user)
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

    user.last_login_provider = "password"
    db.commit()
    db.refresh(user)
    _clear_login_fail_state(request)
    request.session["auth_user"] = _build_auth_user(user)
    return {"ok": True, "redirect": "/"}


@router.post("/api/auth/logout")
def logout_api(request: Request):
    request.session.clear()
    return {"ok": True}


@router.get("/logout")
def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)


@router.get("/pending-approval")
def pending_approval_page(request: Request):
    lang = request.cookies.get("lang", "uz")
    brand = _get_brand_settings()
    return templates.TemplateResponse(
        request=request,
        name="pending_approval.html",
        context={
            "request": request,
            "lang": lang,
            **brand,
        },
    )


@router.get("/contact")
def contact_page(request: Request):
    lang = request.cookies.get("lang", "uz")
    brand = _get_brand_settings()
    return templates.TemplateResponse(
        request=request,
        name="contact.html",
        context={
            "request": request,
            "lang": lang,
            **brand,
        },
    )


@router.get("/about")
def about_public_page(request: Request):
    lang = request.cookies.get("lang", "uz")
    brand = _get_brand_settings()
    return templates.TemplateResponse(
        request=request,
        name="about_public.html",
        context={
            "request": request,
            "lang": lang,
            **brand,
        },
    )


@router.get("/map")
def map_page(request: Request):
    lang = request.cookies.get("lang", "uz")
    brand = _get_brand_settings()
    return templates.TemplateResponse(
        request=request,
        name="map.html",
        context={
            "request": request,
            "lang": lang,
            **brand,
        },
    )
