from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_
from database import get_db
import models

from bot_process_manager import get_bot_process_status
from isup_manager import (
    get_process_status,
    restart_isup_server,
    start_isup_server,
    stop_isup_server,
)
from redis_monitor import get_recent_camera_events, get_redis_snapshot, get_redis_status_summary
from time_utils import now_tashkent


router = APIRouter()


def _port_listening(status: dict, key: str) -> bool:
    for item in status.get("ports", []):
        if item.get("key") == key:
            return item.get("listening") is True
    return False


def _get_camera_offline_alerts(request: Request, db: Session) -> dict:
    auth_user = request.session.get("auth_user") or {}
    role = str(auth_user.get("role") or "").strip().lower()
    is_super_admin = role in {"superadmin", "super_admin"}
    if not is_super_admin:
        return {"count": 0, "items": []}

    now = now_tashkent()
    threshold = timedelta(minutes=10)
    rows = (
        db.query(
            models.Device.id,
            models.Device.name,
            models.Device.last_seen_at,
            models.Device.is_online,
            models.Device.organization_id,
            models.Organization.name.label("organization_name"),
        )
        .outerjoin(models.Organization, models.Organization.id == models.Device.organization_id)
        .order_by(models.Device.id.asc())
        .all()
    )

    items: list[dict] = []
    for row in rows:
        if bool(row.is_online):
            continue

        last_seen = row.last_seen_at
        if not last_seen:
            continue

        items.append({
            "id": int(row.id),
            "name": str(row.name or f"Kamera #{row.id}"),
            "organization_name": str(row.organization_name or ""),
            "last_seen_at": last_seen.isoformat(),
            "is_online": False,
        })

    return {"count": len(items), "items": items}


@router.get("/api/isup/process")
def isup_process_status():
    return {"ok": True, "status": get_process_status()}


@router.get("/api/system-monitor/navbar-status")
def navbar_status(request: Request, db: Session = Depends(get_db)):
    telegram_status = get_bot_process_status()
    isup_status = get_process_status()
    redis_status = get_redis_status_summary()
    try:
        camera_alerts = _get_camera_offline_alerts(request, db)
    except Exception:
        camera_alerts = {"count": 0, "items": []}

    isup_online = bool(isup_status.get("running")) and (
        _port_listening(isup_status, "register") or _port_listening(isup_status, "api")
    )

    return {
        "ok": True,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "telegram": {
            "online": bool(telegram_status.get("running")),
            "running": bool(telegram_status.get("running")),
            "pid": telegram_status.get("pid"),
            "uptime_seconds": telegram_status.get("uptime_seconds"),
        },
        "isup": {
            "online": isup_online,
            "running": bool(isup_status.get("running")),
            "pid": isup_status.get("pid"),
            "register_listening": _port_listening(isup_status, "register"),
            "api_listening": _port_listening(isup_status, "api"),
        },
        "redis": {
            "online": bool(redis_status.get("connected")),
            "connected": bool(redis_status.get("connected")),
            "host": redis_status.get("host"),
            "port": redis_status.get("port"),
            "ping_ms": redis_status.get("ping_ms"),
            "service": redis_status.get("service"),
            "error": redis_status.get("error"),
        },
        "camera_alerts": camera_alerts,
    }


@router.post("/api/isup/process/start")
def isup_process_start():
    try:
        status = start_isup_server()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"ok": True, "message": "ISUP server ishga tushirildi", "status": status}


@router.post("/api/isup/process/restart")
def isup_process_restart():
    try:
        status = restart_isup_server()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"ok": True, "message": "ISUP server qayta ishga tushirildi", "status": status}


@router.post("/api/isup/process/stop")
def isup_process_stop():
    try:
        status = stop_isup_server()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"ok": True, "message": "ISUP server to'xtatildi", "status": status}


@router.get("/api/redis/snapshot")
def redis_snapshot(
    pattern: str = Query("*"),
    limit: int = Query(200, ge=1, le=500),
):
    snapshot = get_redis_snapshot(pattern=pattern, limit=limit)
    return {"ok": snapshot["connected"], **snapshot}


@router.get("/api/redis/events")
def redis_events(
    limit: int = Query(100, ge=1, le=500),
    today_only: bool = Query(True),
):
    items = get_recent_camera_events(limit=limit, today_only=today_only)
    return {"ok": True, "count": len(items), "items": items}


@router.get("/api/middleware-logs/stats")
def get_middleware_log_stats(db: Session = Depends(get_db)):
    from sqlalchemy import func as sqlfunc
    # Unique IPs
    ips = [r[0] for r in db.query(models.RequestLog.client_ip).distinct().filter(models.RequestLog.client_ip != None).order_by(models.RequestLog.client_ip).all()]
    # Status breakdown
    status_rows = db.query(models.RequestLog.status_code, sqlfunc.count(models.RequestLog.id))\
        .filter(models.RequestLog.status_code != 0)\
        .group_by(models.RequestLog.status_code)\
        .order_by(models.RequestLog.status_code)\
        .all()
    return {
        "ok": True,
        "ips": ips,
        "status_breakdown": [{"code": r[0], "count": r[1]} for r in status_rows],
    }


@router.delete("/api/middleware-logs/clear")
def clear_middleware_logs(db: Session = Depends(get_db)):
    count = db.query(models.RequestLog).count()
    db.query(models.RequestLog).delete()
    db.commit()
    return {"ok": True, "deleted": count}


@router.get("/api/middleware-logs")
def get_middleware_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    method: str = Query(None),
    status: int = Query(None),
    search: str = Query(None),
    ip: str = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.RequestLog)

    if method:
        q = q.filter(models.RequestLog.method == method.upper())
    if status:
        q = q.filter(models.RequestLog.status_code == status)
    if ip:
        q = q.filter(models.RequestLog.client_ip.ilike(f"%{ip}%"))
    if search:
        like = f"%{search}%"
        q = q.filter(
            or_(
                models.RequestLog.url.ilike(like),
                models.RequestLog.client_ip.ilike(like),
                models.RequestLog.details.ilike(like),
                models.RequestLog.user_agent.ilike(like),
            )
        )

    total = q.count()
    offset = (page - 1) * limit
    logs = q.order_by(models.RequestLog.id.desc()).offset(offset).limit(limit).all()

    data = []
    for l in logs:
        data.append({
            "id": l.id,
            "method": l.method,
            "url": l.url,
            "client_ip": l.client_ip,
            "content_type": l.content_type,
            "user_agent": getattr(l, "user_agent", None),
            "status_code": l.status_code,
            "response_time_ms": l.response_time_ms,
            "details": getattr(l, "details", None),
            "created_at": l.created_at.isoformat() if l.created_at else None,
        })

    return {
        "ok": True,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "data": data,
    }
