from fastapi import APIRouter, HTTPException, Query

from isup_manager import (
    get_process_status,
    restart_isup_server,
    start_isup_server,
    stop_isup_server,
)
from redis_monitor import get_redis_snapshot


router = APIRouter()


@router.get("/api/isup/process")
def isup_process_status():
    return {"ok": True, "status": get_process_status()}


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
