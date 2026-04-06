from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from sqlalchemy.orm import Session
import bcrypt

from database import get_db
from models import User
from menu_utils import get_menu_data
from translations import get_translations


router = APIRouter()
templates = Jinja2Templates(directory="templates")


class LoginPayload(BaseModel):
    email: str
    password: str


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
        "organization_id": user.organization_id,
        "image_url": user.image_url or "",
    }


@router.get("/login")
def login_page(request: Request):
    if request.session.get("auth_user"):
        return RedirectResponse(url="/", status_code=303)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    brand = _get_brand_settings()
    return templates.TemplateResponse(
        "login.html",
        {
            "request": request,
            "lang": lang,
            "t": t,
            **brand,
        },
    )


@router.post("/api/auth/login")
def login(payload: LoginPayload, request: Request, db: Session = Depends(get_db)):
    email = (payload.email or "").strip().lower()
    password = (payload.password or "").strip()
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email va parol majburiy")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Login yoki parol noto'g'ri")

    ok = bcrypt.checkpw(
        password.encode("utf-8")[:71],
        (user.hashed_password or "").encode("utf-8"),
    )
    if not ok:
        raise HTTPException(status_code=401, detail="Login yoki parol noto'g'ri")

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
