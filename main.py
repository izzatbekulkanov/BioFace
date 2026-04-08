import os
from fastapi import FastAPI
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from fastapi.staticfiles import StaticFiles
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

import models
from database import engine, ensure_schema
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
    "/api/set_language",
    "/docs",
    "/redoc",
    "/openapi.json",
)

PUBLIC_PATHS = {
    "/login",
    "/logout",
    "/favicon.ico",
}


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
    SessionMiddleware,
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
