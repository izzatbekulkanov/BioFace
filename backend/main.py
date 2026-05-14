import asyncio
import os
import time

<<<<<<< HEAD:backend/main.py
from utils.access_control import resolve_menu_key_for_path, resolve_user_menu_permissions, user_has_menu_access
=======
from core.access_control import resolve_menu_key_for_path, resolve_user_menu_permissions, user_has_menu_access
>>>>>>> 3fbf1f2249672d84de81ac32e417409f5cb20ab4:main.py
from services.attendance_monitor import start_attendance_monitor, stop_attendance_monitor
from fastapi import FastAPI
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

import core.models as models
from core.database import engine, ensure_schema, SessionLocal
from core.models import RequestLog
from routers import auth, pages, webhook, cameras, employees, settings, organizations, users, system_monitor, planning
from utils.time_utils import now_tashkent

# Jadvallarni yaratish
models.Base.metadata.create_all(bind=engine)
ensure_schema()

# --- FastAPI Ilovasi ---
app = FastAPI(title="BioFace Admin Dashboard", version="1.0.0")
app.add_middleware(GZipMiddleware, minimum_size=1024)

# --- Statik fayllar ---
os.makedirs("static/uploads", exist_ok=True)
os.makedirs("static/uploads/users", exist_ok=True)
os.makedirs("templates/components", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# tuple shaklida — startswith() bilan ishlaydi
PUBLIC_PATH_PREFIXES = (
    "/static/",
    "/assets/",          # React build assets
    "/api/webhook",
    "/api/hik-event",
    "/api/v1/httppost",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/google-status",  # React frontend checks Google OAuth without auth
    "/auth/google/",
    "/auth/callback",
    "/api/set_language",
    "/docs",
    "/redoc",
    "/openapi.json",
)

PUBLIC_PATHS = frozenset({
    "/login",
    "/logout",
    "/favicon.ico",
    "/pending-approval",
    "/contact",
    "/about",
    "/map",
})

AUTH_PERMISSION_EXEMPT_PATHS = frozenset({
    "/api/system-monitor/navbar-status",
})


# ─── LOG YOZISH YORDAMCHISI (background thread'da) ──────────────────────────
def _write_log_entry(
    log_id: int | None,
    method: str,
    path: str,
    client_ip: str,
    content_type: str,
    user_agent: str,
    status_code: int,
    response_time_ms: int,
    created_at,
) -> None:
    """DB log yozish — bitta sessiyada ham insert, ham update."""
    db = SessionLocal()
    try:
        if log_id is None:
            # Yangi yozuv yaratish
            log_entry = RequestLog(
                method=method,
                url=path,
                client_ip=client_ip,
                content_type=content_type[:255],
                user_agent=user_agent[:512],
                status_code=status_code,
                response_time_ms=response_time_ms,
                created_at=created_at,
            )
            db.add(log_entry)
        else:
            # Mavjud yozuvni yangilash
            log = db.query(RequestLog).filter(RequestLog.id == log_id).first()
            if log:
                log.status_code = status_code
                log.response_time_ms = response_time_ms
        db.commit()
    except Exception:
        pass
    finally:
        db.close()


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
        "/api/events",
        "/api/v1/httppost",
        "/api/hik-event",
    )

    should_log = not path.startswith(ignored_prefixes)
    created_at = now_tashkent() if should_log else None

    response = await call_next(request)

    if should_log:
        elapsed_ms = int((time.time() - start_time) * 1000)
        # Background threadda yozish — so'rovni to'xtatmaydi
        loop = asyncio.get_event_loop()
        loop.run_in_executor(
            None,
            _write_log_entry,
            None,
            method,
            path,
            client_ip,
            content_type,
            user_agent,
            response.status_code,
            elapsed_ms,
            created_at,
        )

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


@app.on_event("startup")
async def startup_background_services():
    start_attendance_monitor()


@app.on_event("shutdown")
async def shutdown_background_services():
    stop_attendance_monitor()

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
app.include_router(planning.router, tags=["Planning API"])

# --- Frontend SPA Integration ---
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

frontend_dist = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'dist')
assets_dir = os.path.join(frontend_dist, 'assets')

if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/login")
@app.get("/about")
@app.get("/contact")
@app.get("/map")
@app.get("/dashboard")
@app.get("/devices")
async def serve_react_app():
    index_file = os.path.join(frontend_dist, 'index.html')
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return JSONResponse({"detail": "Frontend build topilmadi"}, status_code=404)

@app.get("/devices/{path:path}")
async def serve_react_device_path(path: str):
    index_file = os.path.join(frontend_dist, 'index.html')
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return JSONResponse({"detail": "Frontend build topilmadi"}, status_code=404)
