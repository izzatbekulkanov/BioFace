from fastapi import Request

from system_config import (
    get_camera_event_push_base_url,
    get_public_web_base_url,
    normalize_camera_event_push_base_url,
    normalize_public_web_base_url,
)


def _resolve_public_web_base_url(request: Request) -> str:
    configured = normalize_public_web_base_url(get_public_web_base_url())
    if configured:
        return configured

    forwarded_proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip()
    scheme = forwarded_proto or request.url.scheme or "http"
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    host = forwarded_host.split(",")[0].strip() or request.url.netloc or request.url.hostname or "127.0.0.1"
    return f"{scheme}://{host}".rstrip("/")


def _resolve_camera_event_push_base_url(request: Request) -> str:
    configured = normalize_camera_event_push_base_url(get_camera_event_push_base_url())
    if configured:
        return configured

    forwarded_proto = (request.headers.get("x-forwarded-proto") or "").split(",")[0].strip()
    scheme = forwarded_proto or request.url.scheme or "http"
    forwarded_host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    host = forwarded_host.split(",")[0].strip() or request.url.netloc or request.url.hostname or "127.0.0.1"
    candidate = normalize_camera_event_push_base_url(f"{scheme}://{host}".rstrip("/"))
    return candidate or ""

