"""
Redis Pub/Sub helper for the ISUP command bridge.

Channel format:
    bioface:cmd:{device_id}   -> Python publishes, C++ ISUP server subscribes
    bioface:resp:{device_id}  -> C++ publishes response, Python subscribes
    bioface:events            -> C++ publishes camera events
"""

import json
import time
import uuid
from typing import Optional, Union

import redis

from system_config import REDIS_HOST, REDIS_PORT


_redis: Optional[redis.Redis] = None


def _connect_redis() -> Optional[redis.Redis]:
    global _redis

    try:
        client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=0,
            decode_responses=True,
        )
        client.ping()
        _redis = client
    except Exception as exc:
        print(f"[Redis] Connection failed: {exc}")
        _redis = None

    return _redis


def get_redis(check_connection: bool = False) -> Optional[redis.Redis]:
    global _redis

    if _redis is not None and check_connection:
        try:
            _redis.ping()
            return _redis
        except Exception as exc:
            print(f"[Redis] Connection lost: {exc}")
            _redis = None

    if _redis is None:
        return _connect_redis()

    return _redis


def is_connected() -> bool:
    return get_redis(check_connection=True) is not None


def publish_command(device_id: Union[int, str], command: str, params: Optional[dict] = None) -> bool:
    """Publish an ISUP command to a device. Returns True if published."""
    redis_conn = get_redis(check_connection=True)
    if redis_conn is None:
        return False

    payload = json.dumps(
        {
            "command": command,
            "params": params or {},
            "ts": int(time.time()),
        }
    )
    channel = f"bioface:cmd:{device_id}"

    try:
        listeners = redis_conn.publish(channel, payload)
        print(f"[Redis] Published '{command}' to {channel} ({listeners} listeners)")
        return True
    except Exception as exc:
        print(f"[Redis] Publish error: {exc}")
        return False


def send_command_and_wait(
    device_id: Union[int, str],
    command: str,
    params: Optional[dict] = None,
    timeout: float = 5.0,
) -> Optional[dict]:
    """
    Subscribe response channel first, then publish command.
    This avoids race conditions where response arrives before subscriber is ready.
    """
    redis_conn = get_redis(check_connection=True)
    if redis_conn is None:
        return None

    response_channel = f"bioface:resp:{device_id}"
    command_channel = f"bioface:cmd:{device_id}"
    request_id = uuid.uuid4().hex
    payload = json.dumps(
        {
            "command": command,
            "params": params or {},
            "request_id": request_id,
            "ts": int(time.time()),
        }
    )

    pubsub = redis_conn.pubsub()
    pubsub.subscribe(response_channel)

    try:
        # Wait short time for subscribe ACK.
        subscribe_deadline = time.time() + 1.0
        while time.time() < subscribe_deadline:
            msg = pubsub.get_message(timeout=0.2)
            if msg and msg.get("type") == "subscribe":
                break

        listeners = redis_conn.publish(command_channel, payload)
        print(f"[Redis] Published '{command}' to {command_channel} ({listeners} listeners)")

        deadline = time.time() + timeout
        while time.time() < deadline:
            message = pubsub.get_message(timeout=0.5)
            if message and message.get("type") == "message":
                try:
                    parsed = json.loads(message["data"])
                    if isinstance(parsed, dict):
                        resp_req_id = str(parsed.get("request_id") or "").strip()
                        resp_cmd = str(parsed.get("command") or "").strip().lower()
                        # Yangi bridge request_id qaytaradi: faqat mos javobni qabul qilamiz.
                        if resp_req_id:
                            if resp_req_id != request_id:
                                continue
                        else:
                            # Eski bridge uchun kamida command mosligini tekshiramiz.
                            if resp_cmd and resp_cmd != str(command).strip().lower():
                                continue
                    return parsed
                except Exception:
                    return {"raw": message["data"]}
    finally:
        pubsub.unsubscribe(response_channel)
        pubsub.close()

    return None


def await_response(device_id: Union[int, str], timeout: float = 5.0) -> Optional[dict]:
    """
    Subscribe to bioface:resp:{device_id} and wait up to `timeout` seconds.
    Returns parsed dict or None on timeout.
    """
    redis_conn = get_redis(check_connection=True)
    if redis_conn is None:
        return None

    response_channel = f"bioface:resp:{device_id}"
    pubsub = redis_conn.pubsub()
    pubsub.subscribe(response_channel)

    deadline = time.time() + timeout
    try:
        while time.time() < deadline:
            message = pubsub.get_message(timeout=0.5)
            if message and message["type"] == "message":
                try:
                    return json.loads(message["data"])
                except Exception:
                    return {"raw": message["data"]}
    finally:
        pubsub.unsubscribe(response_channel)
        pubsub.close()

    return None


def get_isup_devices() -> list[dict]:
    """
    Read connected ISUP devices from Redis hashes: bioface:device:*
    Returns a list of device dictionaries.
    """
    redis_conn = get_redis(check_connection=True)
    if redis_conn is None:
        return []

    try:
        keys = redis_conn.keys("bioface:device:*")
        devices = []
        for key in keys:
            data = redis_conn.hgetall(key)
            if data:
                devices.append(data)
        return devices
    except Exception as exc:
        print(f"[Redis] get_isup_devices error: {exc}")
        return []


def get_isup_device(device_id: str) -> Optional[dict]:
    """Get one ISUP device info from Redis."""
    redis_conn = get_redis(check_connection=True)
    if redis_conn is None:
        return None

    try:
        data = redis_conn.hgetall(f"bioface:device:{device_id}")
        return data if data else None
    except Exception:
        return None
