import json
import time
from datetime import datetime, timezone
from itertools import islice
from typing import Any, Optional

import psutil

from redis_client import get_redis
from system_config import REDIS_HOST, REDIS_PORT


MAX_STRING_LENGTH = 1200
MAX_COLLECTION_ITEMS = 100


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _truncate_string(value: str) -> str:
    if len(value) <= MAX_STRING_LENGTH:
        return value
    return value[:MAX_STRING_LENGTH] + "...(truncated)"


def _normalize_scalar(value: Any) -> Any:
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="replace")
    if isinstance(value, str):
        raw = value.strip()
        if raw.startswith("{") or raw.startswith("["):
            try:
                return json.loads(raw)
            except Exception:
                return _truncate_string(value)
        return _truncate_string(value)
    return value


def _serialize_stream(entries: list[tuple[str, dict]]) -> list[dict]:
    result = []
    for entry_id, fields in entries:
        result.append(
            {
                "id": entry_id,
                "fields": {key: _normalize_scalar(val) for key, val in fields.items()},
            }
        )
    return result


def _get_redis_service_status() -> dict:
    try:
        for conn in psutil.net_connections(kind="tcp"):
            if conn.status != psutil.CONN_LISTEN or not conn.laddr:
                continue
            if getattr(conn.laddr, "port", None) == REDIS_PORT:
                return {
                    "listening": True,
                    "pid": conn.pid,
                }
        return {
            "listening": False,
            "pid": None,
        }
    except Exception:
        return {
            "listening": None,
            "pid": None,
        }


def _build_disconnected_snapshot(pattern: str, limit: int, service: dict, error: Optional[str] = None) -> dict:
    return {
        "connected": False,
        "host": REDIS_HOST,
        "port": REDIS_PORT,
        "pattern": pattern,
        "limit": limit,
        "checked_at": _utc_now(),
        "ping_ms": None,
        "dbsize": 0,
        "keys": [],
        "channels": [],
        "stats": {},
        "service": service,
        "error": error,
    }


def read_redis_key(key: str, redis_conn=None) -> dict:
    redis_conn = redis_conn or get_redis(check_connection=True)
    if redis_conn is None:
        raise ConnectionError("Redis ulanmagan")

    key_type = redis_conn.type(key)
    ttl = redis_conn.ttl(key)
    value: Any = None
    size = 0
    truncated = False

    if key_type == "string":
        raw_value = redis_conn.get(key) or ""
        size = len(raw_value)
        value = _normalize_scalar(raw_value)
    elif key_type == "hash":
        raw_value = redis_conn.hgetall(key)
        size = len(raw_value)
        value = {field: _normalize_scalar(val) for field, val in raw_value.items()}
    elif key_type == "list":
        size = redis_conn.llen(key)
        items = redis_conn.lrange(key, 0, MAX_COLLECTION_ITEMS - 1)
        truncated = size > len(items)
        value = [_normalize_scalar(item) for item in items]
    elif key_type == "set":
        members = list(islice(redis_conn.sscan_iter(key), MAX_COLLECTION_ITEMS))
        size = redis_conn.scard(key)
        truncated = size > len(members)
        value = [_normalize_scalar(item) for item in members]
    elif key_type == "zset":
        members = redis_conn.zrange(key, 0, MAX_COLLECTION_ITEMS - 1, withscores=True)
        size = redis_conn.zcard(key)
        truncated = size > len(members)
        value = [{"member": _normalize_scalar(item), "score": score} for item, score in members]
    elif key_type == "stream":
        size = redis_conn.xlen(key)
        entries = redis_conn.xrange(key, count=MAX_COLLECTION_ITEMS)
        truncated = size > len(entries)
        value = _serialize_stream(entries)

    return {
        "key": key,
        "type": key_type,
        "ttl": ttl,
        "size": size,
        "truncated": truncated,
        "value": value,
    }


def get_redis_snapshot(pattern: str = "*", limit: int = 200) -> dict:
    limit = max(1, min(limit, 500))
    service = _get_redis_service_status()
    redis_conn = get_redis(check_connection=True)

    if redis_conn is None:
        return _build_disconnected_snapshot(pattern=pattern, limit=limit, service=service)

    try:
        ping_started = time.perf_counter()
        redis_conn.ping()
        ping_ms = round((time.perf_counter() - ping_started) * 1000, 2)

        keys = []
        for key in redis_conn.scan_iter(match=pattern, count=min(limit, 200)):
            keys.append(key)
            if len(keys) >= limit:
                break
        keys = sorted(keys)

        memory_info = {}
        client_info = {}
        stats_info = {}

        try:
            memory_info = redis_conn.info(section="memory")
        except Exception:
            memory_info = {}

        try:
            client_info = redis_conn.info(section="clients")
        except Exception:
            client_info = {}

        try:
            stats_info = redis_conn.info(section="stats")
        except Exception:
            stats_info = {}

        try:
            channels = sorted(redis_conn.pubsub_channels("*"))
        except Exception:
            channels = []

        key_items = []
        for key in keys:
            try:
                key_items.append(read_redis_key(key, redis_conn=redis_conn))
            except Exception as exc:
                key_items.append(
                    {
                        "key": key,
                        "type": "unknown",
                        "ttl": -2,
                        "size": 0,
                        "truncated": False,
                        "value": f"Read error: {exc}",
                    }
                )

        return {
            "connected": True,
            "host": REDIS_HOST,
            "port": REDIS_PORT,
            "pattern": pattern,
            "limit": limit,
            "checked_at": _utc_now(),
            "ping_ms": ping_ms,
            "dbsize": redis_conn.dbsize(),
            "keys": key_items,
            "channels": channels,
            "service": service,
            "stats": {
                "used_memory_human": memory_info.get("used_memory_human"),
                "used_memory_peak_human": memory_info.get("used_memory_peak_human"),
                "connected_clients": client_info.get("connected_clients"),
                "blocked_clients": client_info.get("blocked_clients"),
                "total_connections_received": stats_info.get("total_connections_received"),
                "total_commands_processed": stats_info.get("total_commands_processed"),
                "keyspace_hits": stats_info.get("keyspace_hits"),
                "keyspace_misses": stats_info.get("keyspace_misses"),
            },
            "error": None,
        }
    except Exception as exc:
        return _build_disconnected_snapshot(
            pattern=pattern,
            limit=limit,
            service=service,
            error=str(exc),
        )


def get_recent_camera_events(limit: int = 100, today_only: bool = True) -> list[dict[str, Any]]:
    redis_conn = get_redis(check_connection=True)
    if redis_conn is None:
        return []

    safe_limit = max(1, min(int(limit), 500))
    rows: list[tuple[str, dict[str, Any]]] = []
    list_rows: list[str] = []
    try:
        rows = redis_conn.xrevrange("bioface:events:stream", count=safe_limit)
    except Exception:
        list_rows = redis_conn.lrange("bioface:events:list", 0, safe_limit - 1)

    result: list[dict[str, Any]] = []

    today_prefix = datetime.now().strftime("%Y-%m-%d")
    if list_rows:
        normalized = [(f"list-{idx}", {"event": raw}) for idx, raw in enumerate(list_rows, start=1)]
    else:
        normalized = rows

    for entry_id, fields in normalized:
        raw_payload = str(fields.get("event") or "").strip()
        payload: dict[str, Any] = {}
        if raw_payload:
            try:
                parsed = json.loads(raw_payload)
                if isinstance(parsed, dict):
                    payload = parsed
            except Exception:
                payload = {"raw": _truncate_string(raw_payload)}

        timestamp = str(payload.get("timestamp") or fields.get("timestamp") or "").strip()
        if today_only and timestamp and not timestamp.startswith(today_prefix):
            continue

        result.append(
            {
                "id": entry_id,
                "timestamp": timestamp,
                "camera_id": payload.get("camera_id"),
                "camera_name": payload.get("camera_name"),
                "camera_mac": payload.get("camera_mac"),
                "person_id": payload.get("person_id"),
                "person_name": payload.get("person_name"),
                "status": payload.get("status"),
                "source": payload.get("source"),
                "snapshot_url": payload.get("snapshot_url"),
                "payload": payload,
            }
        )

    return result

