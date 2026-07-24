import asyncio
import os
import time

from utils.access_control import resolve_menu_key_for_path, resolve_user_menu_permissions, user_has_menu_access
from services.attendance_monitor import start_attendance_monitor, stop_attendance_monitor
from services.self_healing_monitor import start_self_healing_monitor, stop_self_healing_monitor
from services.ai_process_manager import start_ai_process, stop_ai_process
from services.notification_service import start_notification_monitor, stop_notification_monitor, get_notification_monitor_status
from fastapi import FastAPI
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

import models
from database import engine, ensure_schema, SessionLocal
from models import RequestLog
from routers import auth, dashboard, webhook, cameras, employees, settings, organizations, users, system_monitor, planning, chat, versions, finance, feedbacks, system_tools, audit
from utils.time_utils import now_tashkent

# Jadvallarni yaratish
models.Base.metadata.create_all(bind=engine)
ensure_schema()

# --- FastAPI Ilovasi ---
app = FastAPI(title="BioFace Admin Dashboard", version="1.0.0")
app.add_middleware(GZipMiddleware, minimum_size=1024)

@app.middleware("http")
async def add_permissions_policy_header(request, call_next):
    response = await call_next(request)
    # Kamera va joylashuvga ruxsat
    response.headers["Permissions-Policy"] = "camera=*, geolocation=*"
    # Xavfsizlik headerlari
    response.headers["X-Content-Type-Options"] = "nosniff"
    path = request.url.path
    if not path.startswith("/static/telegram_webapp") and path not in {"/app", "/telegram-webapp"}:
        response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # HTTPS majburiy (Nginx orqali deploy qilingan)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# --- Statik fayllar ---
os.makedirs("static/uploads", exist_ok=True)
os.makedirs("static/uploads/users", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

PUBLIC_PATH_PREFIXES = (
    "/static/",
    "/assets/",          # React build assets
    "/api/webhook",
    "/api/hik-event",
    "/api/v1/httppost",
    "/api/auth/",
    "/auth/google/",
    "/auth/callback",
    "/api/set_language",
    "/api/public/",      # Public endpoints (e.g. /api/public/cameras)
    "/api/organizations/geo/",  # Public geocoding proxy endpoints
    "/api/versions",     # Public version info (shown on login page)
    "/api/employees/",   # Telegram WebApp & Mobile app employee endpoints
    "/api/branches/",    # Branch info API
    "/api/settings",      # Public branding settings (app name, logo)
    "/api/menu_settings", # Public branding settings
    "/api/feedbacks/submit", # Public feedback submission from mobile app
)

PUBLIC_PATHS = frozenset({
    "/app",
    "/telegram-webapp",
    "/pico.js",
    "/facefinder",
    "/login",
    "/logout",
    "/favicon.ico",
    "/favicon.svg",
    "/uzbekistan.json",
    "/pending-approval",
    "/contact",
    "/about",
    "/map",
    "/privacy-policy",
    # SEO fayllar — Google bot uchun
    "/sitemap.xml",
    "/robots.txt",
    "/og-image.png",
})

AUTH_PERMISSION_EXEMPT_PATHS = frozenset({
    "/api/system-monitor/navbar-status",
    "/api/users/permissions-schema",
})

# Prefix-based exemption: login qilgan har qanday foydalanuvchi kira oladi
AUTH_PERMISSION_EXEMPT_PREFIXES = (
    "/api/organizations",   # Barcha rollar uchun tashkilot ro'yxati (filter uchun kerak)
    "/api/auth/",           # Auth endpointlari
    "/api/profile/",        # Profil endpointlari
    "/api/audit-logs",      # Audit endpointlari
)


def _background_autostart_enabled() -> bool:
    return os.getenv("BIOFACE_DISABLE_AUTOSTART", "").strip().lower() not in {"1", "true", "yes", "on"}


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
        loop = asyncio.get_running_loop()
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

    if (
        path in PUBLIC_PATHS
        or any(path.startswith(prefix) for prefix in PUBLIC_PATH_PREFIXES)
        or request.headers.get("X-Telegram-WebApp") == "true"
    ):
        response = await call_next(request)
        if "text/html" in (response.headers.get("content-type") or ""):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
        return response

    auth_user = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        from utils.jwt_utils import decode_access_token
        payload = decode_access_token(token)
        if payload:
            username = payload.get("sub")
            if username:
                from database import SessionLocal
                from models import User
                db = SessionLocal()
                try:
                    user = db.query(User).filter(User.name == username).first()
                    if user and str(user.status or "active").strip().lower() == "active":
                        from routers.auth import _build_auth_user
                        auth_user = _build_auth_user(user)
                        session = request.scope.get("session")
                        if session is None:
                            from starlette.middleware.sessions import Session as StarletteSession
                            session = StarletteSession()
                            request.scope["session"] = session
                        session["auth_user"] = auth_user
                except Exception:
                    pass
                finally:
                    db.close()

    if not auth_user:
        auth_user = request.session.get("auth_user")

    if auth_user:
        # Xodimlar (is_staff = False) veb panelga (non-api sahifalarga) kira olmaydi.
        # Faqat API so'rovlariga (mobil ilova ishlatadigan) ruxsat beriladi.
        if not auth_user.get("is_staff"):
            if not path.startswith("/api/"):
                request.session.clear()
                return RedirectResponse(url="/login?error=not_staff", status_code=303)

        try:
            from routers.chat import ONLINE_USERS
            import time
            ONLINE_USERS[auth_user["id"]] = time.time()
        except Exception:
            pass
        menu_permissions = auth_user.get("menu_permissions")
        if menu_permissions is None:
            from database import SessionLocal
            db = SessionLocal()
            try:
                menu_permissions = resolve_user_menu_permissions(
                    role=auth_user.get("role"),
                    stored_permissions=None,
                    user_id=auth_user.get("id"),
                    db=db,
                )
            finally:
                db.close()
            auth_user = dict(auth_user)
            auth_user["menu_permissions"] = menu_permissions
            request.session["auth_user"] = auth_user

        # Buxgalter xodimlarni va smena/jadvallarni o'chirish/tahrirlash/yaratish huquqiga ega emas
        role = str(auth_user.get("role") or "").strip().lower()
        if role == "buxgalter" and request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            if (
                path.startswith("/api/employees")
                or path.startswith("/api/v1/employees")
                or path.startswith("/api/schedules")
            ):
                return JSONResponse({"detail": "Forbidden: Buxgalter xodimlarni o'zgartira olmaydi"}, status_code=403)

        is_exempt = (path in AUTH_PERMISSION_EXEMPT_PATHS) or (
            any(path.startswith(p) for p in AUTH_PERMISSION_EXEMPT_PREFIXES) and path != "/api/organizations/tracking-data"
        )
        if not is_exempt:
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
    https_only=True,   # FIX: Cookie faqat HTTPS orqali yuboriladi (session hijacking himoyasi)
)

# FIX: Faqat lokal Nginx proxysiga ishon — ixtiyoriy X-Forwarded-For spoofingdan himoya
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="127.0.0.1")


@app.on_event("startup")
async def startup_background_services():
    if not _background_autostart_enabled():
        print("[STARTUP] Background services autostart disabled.")
        return

    # Clean up stale face embeddings on startup
    from database import SessionLocal
    from utils.face_embeddings import cleanup_stale_embeddings
    db = SessionLocal()
    try:
        deleted = cleanup_stale_embeddings(db)
        if deleted > 0:
            print(f"[STARTUP] Cleaned up {deleted} stale face embeddings.")
    except Exception as _e:
        print(f"[STARTUP] Failed to cleanup embeddings on startup: {_e}")
    finally:
        db.close()

    start_attendance_monitor()
    start_self_healing_monitor()
    start_ai_process()
    start_notification_monitor()


@app.on_event("shutdown")
async def shutdown_background_services():
    if not _background_autostart_enabled():
        return
    stop_attendance_monitor()
    stop_self_healing_monitor()
    stop_ai_process()
    stop_notification_monitor()

# --- Real-time WebSocket Endpoint ---
from fastapi import WebSocket

@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    session = websocket.scope.get("session") or {}
    auth_user = session.get("auth_user")
    
    if not auth_user:
        await websocket.close(code=4001)
        return
        
    role = str(auth_user.get("role") or "").strip().lower()
    is_super_admin = role in {"superadmin", "super_admin"}
    
    allowed_org_ids = []
    if not is_super_admin:
        from database import SessionLocal
        from models import UserOrganizationLink
        db = SessionLocal()
        try:
            user_id = auth_user.get("id")
            org_ids = set()
            if user_id is not None:
                rows = db.query(UserOrganizationLink.organization_id).filter(UserOrganizationLink.user_id == int(user_id)).all()
                org_ids.update(int(r.organization_id) for r in rows if r.organization_id is not None)
            
            fallback = auth_user.get("organization_id")
            if fallback is not None:
                org_ids.add(int(fallback))
            allowed_org_ids = list(org_ids)
        except Exception:
            pass
        finally:
            db.close()
            
    from services.websocket_manager import manager
    await manager.connect(websocket, allowed_org_ids=allowed_org_ids, is_super_admin=is_super_admin)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        manager.disconnect(websocket)

# --- Routerlarni ulaymiz ---
app.include_router(auth.router, tags=["Auth"])
app.include_router(dashboard.router, tags=["Dashboard API"])
app.include_router(webhook.router, prefix="/api", tags=["Webhooks"])
app.include_router(cameras.router, tags=["Cameras API"])
app.include_router(employees.router, tags=["Employees API"])
app.include_router(settings.router, tags=["Settings API"])
app.include_router(organizations.router, tags=["Organizations API"])
app.include_router(users.router, tags=["Users API"])
app.include_router(system_monitor.router, tags=["System Monitor API"])
app.include_router(planning.router, tags=["Planning API"])
app.include_router(chat.router, tags=["Chat API"])
app.include_router(versions.router, tags=["Versions API"])
app.include_router(finance.router, tags=["Finance API"])
app.include_router(feedbacks.router, tags=["Feedbacks API"])
app.include_router(system_tools.router, tags=["System Tools API"])
app.include_router(audit.router, tags=["Audit API"])

# --- SEO fayllar (Google bot, ijtimoiy tarmoqlar uchun — auth kerak emas) ---
_BACKEND_STATIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
_FRONTEND_DIST  = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'dist')

def _serve_seo_file(filename: str, media_type: str):
    """static/ yoki frontend/dist/ dan SEO faylni qaytaradi."""
    for folder in [_BACKEND_STATIC, _FRONTEND_DIST]:
        path = os.path.join(folder, filename)
        if os.path.exists(path):
            return FileResponse(path, media_type=media_type)
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse("Not Found", status_code=404)

@app.get("/sitemap.xml", include_in_schema=False)
async def serve_sitemap():
    return _serve_seo_file("sitemap.xml", "application/xml")

@app.get("/robots.txt", include_in_schema=False)
async def serve_robots():
    return _serve_seo_file("robots.txt", "text/plain")

@app.get("/og-image.png", include_in_schema=False)
async def serve_og_image():
    return _serve_seo_file("og-image.png", "image/png")

@app.get("/app", include_in_schema=False)
@app.get("/telegram-webapp", include_in_schema=False)
async def serve_telegram_webapp():
    path = os.path.join(_BACKEND_STATIC, "telegram_webapp", "index.html")
    if os.path.exists(path):
        return FileResponse(
            path,
            media_type="text/html",
            headers={
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            }
        )
    return JSONResponse({"detail": "Telegram WebApp topilmadi"}, status_code=404)

@app.get("/pico.js", include_in_schema=False)
async def serve_pico_js():
    path = os.path.join(_BACKEND_STATIC, "telegram_webapp", "pico.js")
    if os.path.exists(path):
        return FileResponse(path, media_type="application/javascript")
    return JSONResponse({"detail": "Not Found"}, status_code=404)

@app.get("/facefinder", include_in_schema=False)
async def serve_facefinder():
    path = os.path.join(_BACKEND_STATIC, "telegram_webapp", "facefinder")
    if os.path.exists(path):
        return FileResponse(path, media_type="application/octet-stream")
    return JSONResponse({"detail": "Not Found"}, status_code=404)

# --- Frontend SPA Integration ---

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

frontend_dist = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'dist')
assets_dir = os.path.join(frontend_dist, 'assets')

if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/{path:path}")
async def serve_react_app(path: str):
    if path.startswith("api/") or path.startswith("static/") or path.startswith("assets/"):
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    
    # If the file exists in the frontend build folder (e.g. uzbekistan.json, favicon.ico), serve it
    if path:
        target_file = os.path.join(frontend_dist, path)
        if os.path.exists(target_file) and os.path.isfile(target_file):
            return FileResponse(target_file)

    index_file = os.path.join(frontend_dist, 'index.html')
    if os.path.exists(index_file):
        return FileResponse(index_file, headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"})
    return JSONResponse({"detail": "Frontend build topilmadi"}, status_code=404)
