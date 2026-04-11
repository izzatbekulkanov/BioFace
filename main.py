import os
import time

from access_control import resolve_menu_key_for_path, resolve_user_menu_permissions, user_has_menu_access
from fastapi import FastAPI
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

import models
from database import engine, ensure_schema, SessionLocal
from models import RequestLog
from routers import auth, pages, webhook, cameras, employees, settings, organizations, users, system_monitor

# Jadvallarni yaratish
models.Base.metadata.create_all(bind=engine)
ensure_schema()

# --- FastAPI Ilovasi ---
app = FastAPI(title="BioFace Admin Dashboard", version="1.0.0")

# --- Statik fayllar ---
os.makedirs("static/uploads", exist_ok=True)
os.makedirs("static/uploads/users", exist_ok=True)
os.makedirs("templates/components", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


PUBLIC_PATH_PREFIXES = (
    "/static/",
    "/api/webhook",
    "/api/hik-event",
    "/api/v1/httppost",
    "/api/auth/login",
    "/api/auth/logout",
    "/auth/google/",
    "/auth/callback",
    "/api/set_language",
    "/docs",
    "/redoc",
    "/openapi.json",
)

PUBLIC_PATHS = {
    "/login",
    "/logout",
    "/favicon.ico",
    "/pending-approval",
}

AUTH_PERMISSION_EXEMPT_PATHS = {
    "/api/system-monitor/navbar-status",
}


# ─── MIDDLEWARE 1: LOGGER (birinchi ishlaydi — hamma so'rovni ushlab qoladi) ──
@app.middleware("http")
async def log_requests(request, call_next):
    start_time = time.time()
    path = str(request.url.path or "")
    method = str(request.method or "")
    client_ip = str(request.client.host) if request.client and request.client.host else ""
    content_type = str(request.headers.get("content-type", "") or "")
    user_agent = str(request.headers.get("user-agent", "") or "")

    # Polling va static URLlarni loglardan chetlatish
    ignored_prefixes = (
        "/static/",
        "/api/middleware-logs",
        "/api/system-monitor",
        "/api/redis",
        "/api/isup-traces",
        "/api/dashboard",
        "/api/telegram/process",
        "/api/events"
    )
    if not path.startswith(ignored_prefixes):
        db = SessionLocal()
        try:
            log_entry = RequestLog(
                method=method,
                url=path,
                client_ip=client_ip,
                content_type=content_type[:255],
                user_agent=user_agent[:512],
                status_code=0,
                response_time_ms=0,
            )
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)
            request.state.log_id = log_entry.id
        except Exception:
            pass
        finally:
            db.close()

    response = await call_next(request)

    # Status va response_time ni yangilaymiz
    if hasattr(request.state, "log_id"):
        db = SessionLocal()
        try:
            log = db.query(RequestLog).filter(RequestLog.id == request.state.log_id).first()
            if log:
                log.status_code = response.status_code
                log.response_time_ms = int((time.time() - start_time) * 1000)
                db.commit()
        except Exception:
            pass
        finally:
            db.close()

    return response


# ─── MIDDLEWARE 2: AUTH (ikkinchi ishlaydi — loggerdan keyin) ─────────────────
@app.middleware("http")
async def require_auth(request, call_next):
    path = request.url.path

    if path in PUBLIC_PATHS or any(path.startswith(prefix) for prefix in PUBLIC_PATH_PREFIXES):
        response = await call_next(request)
        if "text/html" in (response.headers.get("content-type") or ""):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
        return response

    auth_user = request.session.get("auth_user")
    if auth_user:
        menu_permissions = resolve_user_menu_permissions(
            role=auth_user.get("role"),
            stored_permissions=auth_user.get("menu_permissions"),
        )
        if auth_user.get("menu_permissions") != menu_permissions:
            auth_user = dict(auth_user)
            auth_user["menu_permissions"] = menu_permissions
            request.session["auth_user"] = auth_user

        if path not in AUTH_PERMISSION_EXEMPT_PATHS:
            required_menu_key = resolve_menu_key_for_path(path)
            if required_menu_key and not user_has_menu_access(menu_permissions, required_menu_key):
                if path.startswith("/api/"):
                    return JSONResponse({"detail": "Forbidden"}, status_code=403)
                response = RedirectResponse(url="/", status_code=303)
                response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
                response.headers["Pragma"] = "no-cache"
                return response

        response = await call_next(request)
        if "text/html" in (response.headers.get("content-type") or ""):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
        return response

    if path.startswith("/api/"):
        return JSONResponse({"detail": "Unauthorized"}, status_code=401)
    response = RedirectResponse(url="/login", status_code=302)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return response


app.add_middleware(
    SessionMiddleware,  # type: ignore[arg-type]
    secret_key=os.getenv("SESSION_SECRET", "bioface-dev-session-key-change-this"),
    same_site="lax",
    https_only=False,
)

app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

# --- Routerlarni ulaymiz ---
app.include_router(auth.router, tags=["Auth"])
app.include_router(pages.router, tags=["Pages"])
app.include_router(webhook.router, prefix="/api", tags=["Webhooks"])
app.include_router(cameras.router, tags=["Cameras API"])
app.include_router(employees.router, tags=["Employees API"])
app.include_router(settings.router, tags=["Settings API"])
app.include_router(organizations.router, tags=["Organizations API"])
app.include_router(users.router, tags=["Users API"])
app.include_router(system_monitor.router, tags=["System Monitor API"])
