from __future__ import annotations

import argparse
import ctypes
import json
import os
import re
import socket
import sqlite3
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Event, Lock, Thread
from typing import Any, Optional
from urllib.parse import urlsplit

import uvicorn
from fastapi import FastAPI, HTTPException

try:
    import httpx
except Exception:  # pragma: no cover - runtime dependency check
    httpx = None

try:
    import redis
except Exception:  # pragma: no cover - runtime dependency check
    redis = None

try:
    from system_config import (
        get_isup_public_host,
        get_public_web_base_url,
        normalize_isup_public_host,
        normalize_public_web_base_url,
    )
except Exception:  # pragma: no cover - runtime dependency check
    get_isup_public_host = None
    get_public_web_base_url = None
    normalize_isup_public_host = None
    normalize_public_web_base_url = None


if os.name != "nt":
    raise RuntimeError("isup_sdk_server.py faqat Windows muhitida ishlaydi.")


# Hikvision ISUP constants (from HCISUPPublic/HCISUPCMS/HCISUPAlarm headers)
MAX_DEVICE_ID_LEN = 256
MAX_MASTER_KEY_LEN = 16
NET_EHOME_SERIAL_LEN = 12
MAX_DEVNAME_LEN_EX = 64
MAX_FULL_SERIAL_NUM_LEN = 64
MAX_KMS_USER_LEN = 512
MAX_KMS_PWD_LEN = 512
MAX_CLOUD_AK_SK_LEN = 64
MAX_PATH_LEN = 260

ENUM_DEV_ON = 0
ENUM_DEV_OFF = 1
ENUM_DEV_ADDRESS_CHANGED = 2
ENUM_DEV_AUTH = 3
ENUM_DEV_SESSIONKEY = 4
ENUM_DEV_DAS_REQ = 5

CMS_INIT_CFG_LIBEAY_PATH = 0
CMS_INIT_CFG_SSLEAY_PATH = 1
ALARM_INIT_CFG_LIBEAY_PATH = 0
ALARM_INIT_CFG_SSLEAY_PATH = 1
SS_INIT_CFG_SDK_PATH = 1
SS_INIT_CFG_LIBEAY_PATH = 4
SS_INIT_CFG_SSLEAY_PATH = 5


DWORD = ctypes.c_uint32
LONG = ctypes.c_int32
BYTE = ctypes.c_ubyte
WORD = ctypes.c_uint16
BOOL = ctypes.c_int


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def decode_bytes(data: bytes) -> str:
    return data.split(b"\x00", 1)[0].decode("utf-8", errors="ignore").strip()


def decode_arr(arr: Any) -> str:
    return decode_bytes(bytes(arr))


def set_ip_address(addr: "NET_EHOME_IPADDRESS", host: str, port: int) -> None:
    host_bytes = host.encode("ascii", errors="ignore")[:127]
    addr.szIP = host_bytes + b"\x00"
    addr.wPort = int(port)


def write_c_string(ptr: int | ctypes.c_void_p, value: str, max_len: int) -> None:
    if not ptr:
        return
    if max_len <= 0:
        return
    raw = value.encode("utf-8", errors="ignore")[: max_len - 1] + b"\x00"
    ctypes.memset(ptr, 0, max_len)
    ctypes.memmove(ptr, raw, len(raw))


def detect_lan_ipv4() -> str:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.connect(("8.8.8.8", 80))
            ip = sock.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
        finally:
            sock.close()
    except Exception:
        pass

    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if ip and not ip.startswith("127."):
                return ip
    except Exception:
        pass
    return "127.0.0.1"


def resolve_public_host_from_env() -> str:
    configured = (os.getenv("ISUP_PUBLIC_HOST") or "").strip()
    if normalize_isup_public_host is not None:
        configured = normalize_isup_public_host(configured)
    if configured:
        return configured

    if get_isup_public_host is not None:
        try:
            saved = normalize_isup_public_host(get_isup_public_host()) if normalize_isup_public_host is not None else get_isup_public_host()
            if saved:
                return saved
        except Exception:
            pass

    return detect_lan_ipv4()


def resolve_public_web_base_url_from_env() -> str:
    configured = (os.getenv("PUBLIC_WEB_BASE_URL") or "").strip()
    if normalize_public_web_base_url is not None:
        configured = normalize_public_web_base_url(configured)
    if configured:
        return configured

    if get_public_web_base_url is not None:
        try:
            saved = (
                normalize_public_web_base_url(get_public_web_base_url())
                if normalize_public_web_base_url is not None
                else get_public_web_base_url()
            )
            if saved:
                return saved
        except Exception:
            pass

    return ""


class NET_EHOME_IPADDRESS(ctypes.Structure):
    _fields_ = [
        ("szIP", ctypes.c_char * 128),
        ("wPort", WORD),
        ("byRes", ctypes.c_char * 2),
    ]


class NET_EHOME_DEV_SESSIONKEY(ctypes.Structure):
    _fields_ = [
        ("sDeviceID", BYTE * MAX_DEVICE_ID_LEN),
        ("sSessionKey", BYTE * MAX_MASTER_KEY_LEN),
    ]


class NET_EHOME_DEV_REG_INFO(ctypes.Structure):
    _fields_ = [
        ("dwSize", DWORD),
        ("dwNetUnitType", DWORD),
        ("byDeviceID", BYTE * MAX_DEVICE_ID_LEN),
        ("byFirmwareVersion", BYTE * 24),
        ("struDevAdd", NET_EHOME_IPADDRESS),
        ("dwDevType", DWORD),
        ("dwManufacture", DWORD),
        ("byPassWord", BYTE * 32),
        ("sDeviceSerial", BYTE * NET_EHOME_SERIAL_LEN),
        ("byReliableTransmission", BYTE),
        ("byWebSocketTransmission", BYTE),
        ("bySupportRedirect", BYTE),
        ("byDevProtocolVersion", BYTE * 6),
        ("bySessionKey", BYTE * MAX_MASTER_KEY_LEN),
        ("byMarketType", BYTE),
        ("byRes", BYTE * 26),
    ]


class NET_EHOME_DEV_REG_INFO_V12(ctypes.Structure):
    _fields_ = [
        ("struRegInfo", NET_EHOME_DEV_REG_INFO),
        ("struRegAddr", NET_EHOME_IPADDRESS),
        ("sDevName", BYTE * MAX_DEVNAME_LEN_EX),
        ("byDeviceFullSerial", BYTE * MAX_FULL_SERIAL_NUM_LEN),
        ("byRes", BYTE * 128),
    ]


class NET_EHOME_BLACKLIST_SEVER(ctypes.Structure):
    _fields_ = [
        ("struAdd", NET_EHOME_IPADDRESS),
        ("byServerName", BYTE * 32),
        ("byUserName", BYTE * 32),
        ("byPassWord", BYTE * 32),
        ("byRes", BYTE * 64),
    ]


class NET_EHOME_SERVER_INFO_V50(ctypes.Structure):
    _fields_ = [
        ("dwSize", DWORD),
        ("dwKeepAliveSec", DWORD),
        ("dwTimeOutCount", DWORD),
        ("struTCPAlarmSever", NET_EHOME_IPADDRESS),
        ("struUDPAlarmSever", NET_EHOME_IPADDRESS),
        ("dwAlarmServerType", DWORD),
        ("struNTPSever", NET_EHOME_IPADDRESS),
        ("dwNTPInterval", DWORD),
        ("struPictureSever", NET_EHOME_IPADDRESS),
        ("dwPicServerType", DWORD),
        ("struBlackListServer", NET_EHOME_BLACKLIST_SEVER),
        ("struRedirectSever", NET_EHOME_IPADDRESS),
        ("byClouldAccessKey", BYTE * 64),
        ("byClouldSecretKey", BYTE * 64),
        ("byClouldHttps", BYTE),
        ("byRes1", BYTE * 3),
        ("dwAlarmKeepAliveSec", DWORD),
        ("dwAlarmTimeOutCount", DWORD),
        ("byRes", BYTE * 372),
    ]


class NET_EHOME_CMS_LISTEN_PARAM(ctypes.Structure):
    pass


class NET_EHOME_ALARM_MSG(ctypes.Structure):
    _fields_ = [
        ("dwAlarmType", DWORD),
        ("pAlarmInfo", ctypes.c_void_p),
        ("dwAlarmInfoLen", DWORD),
        ("pXmlBuf", ctypes.c_void_p),
        ("dwXmlBufLen", DWORD),
        ("sSerialNumber", ctypes.c_char * NET_EHOME_SERIAL_LEN),
        ("pHttpUrl", ctypes.c_void_p),
        ("dwHttpUrlLen", DWORD),
        ("byRes", BYTE * 12),
    ]


class NET_EHOME_ALARM_LISTEN_PARAM(ctypes.Structure):
    pass


class NET_EHOME_SS_LISTEN_PARAM(ctypes.Structure):
    pass


class NET_EHOME_SS_LOCAL_SDK_PATH(ctypes.Structure):
    _fields_ = [
        ("sPath", ctypes.c_char * MAX_PATH_LEN),
        ("byRes", BYTE * 128),
    ]


class NET_EHOME_PTXML_PARAM(ctypes.Structure):
    _fields_ = [
        ("pRequestUrl", ctypes.c_void_p),
        ("dwRequestUrlLen", DWORD),
        ("pCondBuffer", ctypes.c_void_p),
        ("dwCondSize", DWORD),
        ("pInBuffer", ctypes.c_void_p),
        ("dwInSize", DWORD),
        ("pOutBuffer", ctypes.c_void_p),
        ("dwOutSize", DWORD),
        ("dwReturnedXMLLen", DWORD),
        ("byRes", BYTE * 32),
    ]


DEVICE_REGISTER_CB = ctypes.WINFUNCTYPE(
    BOOL,
    LONG,
    DWORD,
    ctypes.c_void_p,
    DWORD,
    ctypes.c_void_p,
    DWORD,
    ctypes.c_void_p,
)
EHOME_MSG_CB = ctypes.WINFUNCTYPE(
    BOOL,
    LONG,
    ctypes.POINTER(NET_EHOME_ALARM_MSG),
    ctypes.c_void_p,
)
EHOME_SS_MSG_CB = ctypes.WINFUNCTYPE(
    BOOL,
    LONG,
    ctypes.c_int32,
    ctypes.c_void_p,
    DWORD,
    ctypes.c_void_p,
    DWORD,
    ctypes.c_void_p,
)
EHOME_SS_STORAGE_CB = ctypes.WINFUNCTYPE(
    BOOL,
    LONG,
    ctypes.c_char_p,
    ctypes.c_void_p,
    DWORD,
    ctypes.c_void_p,
    ctypes.c_void_p,
)
EHOME_SS_RW_CB = ctypes.WINFUNCTYPE(
    BOOL,
    LONG,
    BYTE,
    ctypes.c_char_p,
    ctypes.c_void_p,
    ctypes.POINTER(LONG),
    ctypes.c_char_p,
    ctypes.c_void_p,
)


NET_EHOME_CMS_LISTEN_PARAM._fields_ = [
    ("struAddress", NET_EHOME_IPADDRESS),
    ("fnCB", DEVICE_REGISTER_CB),
    ("pUserData", ctypes.c_void_p),
    ("dwKeepAliveSec", DWORD),
    ("dwTimeOutCount", DWORD),
    ("byRes", BYTE * 24),
]


NET_EHOME_ALARM_LISTEN_PARAM._fields_ = [
    ("struAddress", NET_EHOME_IPADDRESS),
    ("fnMsgCb", EHOME_MSG_CB),
    ("pUserData", ctypes.c_void_p),
    ("byProtocolType", BYTE),
    ("byUseCmsPort", BYTE),
    ("byUseThreadPool", BYTE),
    ("byRes1", BYTE),
    ("dwKeepAliveSec", DWORD),
    ("dwTimeOutCount", DWORD),
    ("byRes", BYTE * 20),
]


NET_EHOME_SS_LISTEN_PARAM._fields_ = [
    ("struAddress", NET_EHOME_IPADDRESS),
    ("szKMS_UserName", ctypes.c_char * MAX_KMS_USER_LEN),
    ("szKMS_Password", ctypes.c_char * MAX_KMS_PWD_LEN),
    ("fnSStorageCb", EHOME_SS_STORAGE_CB),
    ("fnSSMsgCb", EHOME_SS_MSG_CB),
    ("szAccessKey", ctypes.c_char * MAX_CLOUD_AK_SK_LEN),
    ("szSecretKey", ctypes.c_char * MAX_CLOUD_AK_SK_LEN),
    ("pUserData", ctypes.c_void_p),
    ("byHttps", BYTE),
    ("byRes1", BYTE * 3),
    ("fnSSRWCb", EHOME_SS_RW_CB),
    ("fnSSRWCbEx", ctypes.c_void_p),
    ("bySecurityMode", BYTE),
    ("byRes", BYTE * 51),
]


@dataclass
class DeviceState:
    device_id: str
    login_id: int
    serial: str
    ip: str
    port: int
    model: str
    firmware: str
    isup_version: str
    registered_at: datetime
    last_seen: datetime
    online: bool

    def to_payload(self) -> dict[str, Any]:
        return {
            "device_id": self.device_id,
            "id": self.device_id,
            "remote_ip": self.ip,
            "ip": self.ip,
            "remote_port": self.port,
            "port": self.port,
            "device_model": self.model,
            "model": self.model,
            "firmware_version": self.firmware,
            "firmware": self.firmware,
            "isup_version": self.isup_version,
            "serial": self.serial,
            "online": self.online,
            "registered_at": iso_utc(self.registered_at),
            "last_seen_at": iso_utc(self.last_seen),
            "last_seen": iso_utc(self.last_seen),
            "source": "hikvision_sdk",
            "connection_state": "connected" if self.online else "disconnected",
        }


class DeviceRegistry:
    def __init__(self) -> None:
        self._lock = Lock()
        self._devices: dict[str, DeviceState] = {}
        self._login_map: dict[int, str] = {}
        self._alarm_events = 0
        self._last_alarm_at: Optional[datetime] = None
        self._pictures_saved = 0
        self._last_picture_at: Optional[datetime] = None

    def upsert_from_register(self, login_id: int, info: NET_EHOME_DEV_REG_INFO_V12) -> DeviceState:
        now = utc_now()
        device_id = decode_arr(info.struRegInfo.byDeviceID) or f"login-{login_id}"
        serial = decode_arr(info.struRegInfo.sDeviceSerial)
        ip = decode_arr(info.struRegInfo.struDevAdd.szIP)
        port = int(info.struRegInfo.struDevAdd.wPort)
        firmware = decode_arr(info.struRegInfo.byFirmwareVersion)
        isup_version = decode_arr(info.struRegInfo.byDevProtocolVersion)
        model = decode_arr(info.sDevName) or ""

        with self._lock:
            existing = self._devices.get(device_id)
            registered_at = existing.registered_at if existing else now
            state = DeviceState(
                device_id=device_id,
                login_id=login_id,
                serial=serial,
                ip=ip,
                port=port,
                model=model,
                firmware=firmware,
                isup_version=isup_version,
                registered_at=registered_at,
                last_seen=now,
                online=True,
            )
            self._devices[device_id] = state
            self._login_map[login_id] = device_id
            return state

    def mark_offline_by_login(self, login_id: int) -> None:
        with self._lock:
            device_id = self._login_map.pop(login_id, None)
            if not device_id:
                return
            state = self._devices.get(device_id)
            if state:
                state.online = False
                state.last_seen = utc_now()

    def mark_offline(self, device_id: str) -> bool:
        with self._lock:
            state = self._devices.get(device_id)
            if not state:
                return False
            state.online = False
            state.last_seen = utc_now()
            self._login_map.pop(state.login_id, None)
            return True

    def get(self, device_id: str) -> Optional[DeviceState]:
        with self._lock:
            return self._devices.get(device_id)

    def find(self, device_id: str) -> Optional[DeviceState]:
        key = (device_id or "").strip()
        if not key:
            return None
        normalized = key.lower()
        with self._lock:
            direct = self._devices.get(key)
            if direct:
                return direct
            for current_id, state in self._devices.items():
                if current_id.lower() == normalized:
                    return state
            return None

    def all(self) -> list[DeviceState]:
        with self._lock:
            return sorted(self._devices.values(), key=lambda d: d.device_id)

    def login_id_for_device(self, device_id: str) -> Optional[int]:
        with self._lock:
            state = self._devices.get(device_id)
            return state.login_id if state else None

    def bump_alarm(self) -> None:
        with self._lock:
            self._alarm_events += 1
            self._last_alarm_at = utc_now()

    def bump_picture(self) -> None:
        with self._lock:
            self._pictures_saved += 1
            self._last_picture_at = utc_now()

    def stats(self) -> dict[str, Any]:
        with self._lock:
            device_count = len(self._devices)
            online_count = sum(1 for d in self._devices.values() if d.online)
            return {
                "device_count": device_count,
                "online_devices": online_count,
                "alarm_events": self._alarm_events,
                "last_alarm_at": iso_utc(self._last_alarm_at) if self._last_alarm_at else None,
                "pictures_saved": self._pictures_saved,
                "last_picture_at": iso_utc(self._last_picture_at) if self._last_picture_at else None,
            }


class RedisCommandBridge:
    def __init__(self, runtime: "HikvisionSdkRuntime", redis_host: str, redis_port: int) -> None:
        self.runtime = runtime
        self.redis_host = redis_host
        self.redis_port = int(redis_port)
        self._stop_event = Event()
        self._thread: Optional[Thread] = None
        self._lock = Lock()
        self._connected = False
        self._last_error: Optional[str] = None

    def status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "enabled": redis is not None,
                "connected": self._connected,
                "host": self.redis_host,
                "port": self.redis_port,
                "last_error": self._last_error,
            }

    def _set_state(self, connected: bool, last_error: Optional[str]) -> None:
        with self._lock:
            self._connected = connected
            self._last_error = last_error

    def start(self) -> None:
        if redis is None:
            self._set_state(False, "redis Python paketi topilmadi")
            print("[ISUP SDK] Redis bridge disabled: redis Python package is missing.")
            return
        if self._thread and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = Thread(target=self._run, name="isup-redis-bridge", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        self._thread = None
        self._set_state(False, self._last_error)

    def _run(self) -> None:
        while not self._stop_event.is_set():
            client = None
            pubsub = None
            try:
                client = redis.Redis(
                    host=self.redis_host,
                    port=self.redis_port,
                    db=0,
                    decode_responses=True,
                    socket_connect_timeout=3.0,
                    socket_timeout=3.0,
                )
                client.ping()

                pubsub = client.pubsub(ignore_subscribe_messages=True)
                pubsub.psubscribe("bioface:cmd:*")
                self._set_state(True, None)
                print(
                    f"[ISUP SDK] Redis bridge connected: {self.redis_host}:{self.redis_port}, "
                    "subscribed to bioface:cmd:*"
                )

                while not self._stop_event.is_set():
                    message = pubsub.get_message(timeout=1.0)
                    if not message:
                        continue
                    if str(message.get("type") or "") not in {"message", "pmessage"}:
                        continue

                    channel = str(message.get("channel") or "")
                    if not channel.startswith("bioface:cmd:"):
                        continue

                    device_id = channel.split("bioface:cmd:", 1)[1].strip()
                    response_payload = self._dispatch(device_id, message.get("data"))
                    response_channel = f"bioface:resp:{device_id}"
                    client.publish(response_channel, json.dumps(response_payload, ensure_ascii=False))
            except Exception as exc:
                self._set_state(False, str(exc))
                if not self._stop_event.is_set():
                    print(f"[ISUP SDK] Redis bridge error: {exc}. Reconnecting in 2s...")
                    time.sleep(2.0)
            finally:
                try:
                    if pubsub is not None:
                        pubsub.close()
                except Exception:
                    pass
                try:
                    if client is not None:
                        client.close()
                except Exception:
                    pass

        self._set_state(False, self._last_error)

    def _parse_command(self, raw_data: Any) -> tuple[str, dict[str, Any], Optional[str]]:
        text = str(raw_data or "")
        command = ""
        params: dict[str, Any] = {}
        request_id: Optional[str] = None

        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                command = str(parsed.get("command") or "").strip()
                parsed_params = parsed.get("params")
                if isinstance(parsed_params, dict):
                    params = parsed_params
                rid = parsed.get("request_id")
                if rid is not None:
                    request_id = str(rid)
            elif isinstance(parsed, str):
                command = parsed.strip()
        except Exception:
            command = text.strip()

        return command or "unknown", params, request_id

    @staticmethod
    def _safe_int(value: Any, default: int = 0) -> int:
        try:
            return int(str(value).strip())
        except Exception:
            return default

    @staticmethod
    def _parse_bool(value: Any, default: bool = False) -> bool:
        if isinstance(value, bool):
            return value
        if value is None:
            return default
        text = str(value).strip().lower()
        if text in {"1", "true", "yes", "y", "on"}:
            return True
        if text in {"0", "false", "no", "n", "off"}:
            return False
        return default

    @staticmethod
    def _compact_text(text: str, limit: int = 8000) -> str:
        if not text:
            return ""
        clean = text.strip()
        if len(clean) > limit:
            return clean[:limit]
        return clean

    @staticmethod
    def _valid_personal_id(value: str) -> bool:
        return bool(value and len(value) == 7 and value.isdigit() and not value.startswith("0"))

    @staticmethod
    def _try_parse_json(text: str) -> Any:
        clean = (text or "").strip()
        if not clean:
            return None
        if not clean.startswith("{") and not clean.startswith("["):
            return None
        try:
            return json.loads(clean)
        except Exception:
            return None

    @staticmethod
    def _extract_xml_fields(text: str, keys: set[str]) -> dict[str, str]:
        if not text or "<" not in text:
            return {}
        try:
            root = ET.fromstring(text)
        except Exception:
            return {}
        result: dict[str, str] = {}
        for elem in root.iter():
            tag = elem.tag.rsplit("}", 1)[-1]
            if tag in keys and tag not in result:
                value = (elem.text or "").strip()
                if value:
                    result[tag] = value
        return result

    @staticmethod
    def _merge_state_from_camera_info(state: DeviceState, camera_info: dict[str, Any]) -> None:
        if not isinstance(camera_info, dict):
            return
        model = str(camera_info.get("model") or "").strip()
        firmware = str(camera_info.get("firmwareVersion") or "").strip()
        serial = str(camera_info.get("serialNumber") or "").strip()

        if model:
            state.model = model
        if firmware:
            state.firmware = firmware
        if serial:
            state.serial = serial

    @staticmethod
    def _deep_get(data: Any, path: tuple[str, ...], default: Any = None) -> Any:
        cur = data
        for key in path:
            if not isinstance(cur, dict):
                return default
            cur = cur.get(key)
        return default if cur is None else cur

    @staticmethod
    def _parse_dt_any(value: Any) -> Optional[datetime]:
        text = str(value or "").strip()
        if not text:
            return None
        if text.isdigit():
            try:
                raw = int(text)
                if raw > 10_000_000_000:
                    raw = raw // 1000
                return datetime.fromtimestamp(raw, tz=timezone.utc)
            except Exception:
                return None

        normalized = text.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(normalized)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            pass

        for fmt in (
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y%m%d%H%M%S",
        ):
            try:
                return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
            except Exception:
                continue
        return None

    @staticmethod
    def _as_isapi_time(dt: datetime) -> str:
        local = dt.astimezone().replace(microsecond=0)
        return local.isoformat()

    def _payload_error_reason(self, data: Any, text: str) -> Optional[str]:
        if isinstance(data, dict):
            status_code = data.get("statusCode")
            sub_status = str(data.get("subStatusCode") or "").strip().lower()
            status_string = str(data.get("statusString") or "").strip().lower()
            error_msg = str(data.get("errorMsg") or "").strip()
            if status_code is not None:
                code = self._safe_int(status_code, -1)
                if code not in {0, 1}:
                    details = [f"statusCode={code}"]
                    if sub_status:
                        details.append(f"subStatusCode={sub_status}")
                    if error_msg:
                        details.append(f"errorMsg={error_msg}")
                    return ", ".join(details)
            if sub_status and sub_status not in {"ok", "success", "completed"}:
                return f"subStatusCode={sub_status}"
            if status_string and "ok" not in status_string and "success" not in status_string:
                return f"statusString={status_string}"

        xml_fields = self._extract_xml_fields(
            text,
            {"statusCode", "statusString", "subStatusCode", "errorCode", "errorMsg"},
        )
        if xml_fields:
            code_text = xml_fields.get("statusCode")
            if code_text is not None:
                code = self._safe_int(code_text, -1)
                if code not in {0, 1}:
                    details = [f"statusCode={code}"]
                    sub_status_xml = (xml_fields.get("subStatusCode") or "").strip()
                    err_msg_xml = (xml_fields.get("errorMsg") or "").strip()
                    if sub_status_xml:
                        details.append(f"subStatusCode={sub_status_xml}")
                    if err_msg_xml:
                        details.append(f"errorMsg={err_msg_xml}")
                    return ", ".join(details)
            sub_status = (xml_fields.get("subStatusCode") or "").strip().lower()
            if sub_status and sub_status not in {"ok", "success", "completed"}:
                return f"subStatusCode={sub_status}"
        return None

    def _db_connect(self) -> sqlite3.Connection:
        db_path = (Path(__file__).resolve().parent / "bioface.db").resolve()
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _find_device_row(self, target_device_id: str, state: DeviceState) -> Optional[dict[str, Any]]:
        candidates: list[str] = []
        for item in (target_device_id, state.device_id, state.serial):
            value = str(item or "").strip()
            if value and value not in candidates:
                candidates.append(value)

        if not candidates:
            return None

        try:
            with self._db_connect() as conn:
                for key in candidates:
                    row = conn.execute(
                        """
                        SELECT id, name, mac_address, isup_device_id, username, password, organization_id
                        FROM devices
                        WHERE lower(COALESCE(isup_device_id, '')) = lower(?)
                           OR lower(COALESCE(mac_address, '')) = lower(?)
                           OR lower(COALESCE(name, '')) = lower(?)
                        LIMIT 1
                        """,
                        (key, key, key),
                    ).fetchone()
                    if row is not None:
                        return dict(row)
        except Exception:
            return None
        return None

    def _fetch_employee_row(self, employee_id: int) -> Optional[dict[str, Any]]:
        if employee_id <= 0:
            return None
        try:
            with self._db_connect() as conn:
                row = conn.execute(
                    """
                    SELECT id, first_name, last_name, personal_id, has_access, organization_id
                    FROM employees
                    WHERE id = ?
                    LIMIT 1
                    """,
                    (int(employee_id),),
                ).fetchone()
                return dict(row) if row is not None else None
        except Exception:
            return None

    def _fetch_sync_employees(self, organization_id: Optional[int], limit: int) -> list[dict[str, Any]]:
        safe_limit = max(1, min(int(limit), 2000))
        try:
            with self._db_connect() as conn:
                if organization_id is None:
                    rows = conn.execute(
                        """
                        SELECT id, first_name, last_name, personal_id, has_access, organization_id
                        FROM employees
                        WHERE COALESCE(has_access, 1) = 1
                        ORDER BY id
                        LIMIT ?
                        """,
                        (safe_limit,),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        """
                        SELECT id, first_name, last_name, personal_id, has_access, organization_id
                        FROM employees
                        WHERE COALESCE(has_access, 1) = 1
                          AND organization_id = ?
                        ORDER BY id
                        LIMIT ?
                        """,
                        (int(organization_id), safe_limit),
                    ).fetchall()
                return [dict(item) for item in rows]
        except Exception:
            return []

    def _update_device_usage(self, row_id: Optional[int], face_count: Optional[int]) -> None:
        if row_id is None or face_count is None:
            return
        try:
            with self._db_connect() as conn:
                conn.execute(
                    """
                    UPDATE devices
                    SET used_faces = ?, is_online = 1, last_seen_at = ?
                    WHERE id = ?
                    """,
                    (int(face_count), utc_now().replace(tzinfo=None).isoformat(), int(row_id)),
                )
                conn.commit()
        except Exception:
            pass

    def _resolve_http_connection(
        self,
        target_device_id: str,
        state: DeviceState,
        params: dict[str, Any],
    ) -> tuple[Optional[dict[str, Any]], Optional[str]]:
        device_row = self._find_device_row(target_device_id, state)

        username = str(params.get("username") or (device_row or {}).get("username") or "").strip()
        password = str(params.get("password") or (device_row or {}).get("password") or "").strip()
        if not username or not password:
            return None, "Kamera HTTP login/parol topilmadi (devices jadvalida username/password kerak)."

        host = str(params.get("camera_ip") or params.get("host") or state.ip or "").strip()
        if not host:
            return None, "Kamera IP aniqlanmadi."

        use_https = self._parse_bool(params.get("https"), False)
        scheme = str(params.get("scheme") or ("https" if use_https else "http")).strip().lower()
        if scheme not in {"http", "https"}:
            scheme = "http"

        port_raw = params.get("camera_port")
        if port_raw is None:
            port_raw = params.get("http_port")
        if port_raw is None:
            port_raw = params.get("port")
        if port_raw is None or str(port_raw).strip() == "":
            port = 443 if scheme == "https" else 80
        else:
            port = self._safe_int(port_raw, 443 if scheme == "https" else 80)
            if port <= 0:
                port = 443 if scheme == "https" else 80

        default_port = 443 if scheme == "https" else 80
        if port == default_port:
            base_url = f"{scheme}://{host}"
        else:
            base_url = f"{scheme}://{host}:{port}"

        timeout = float(params.get("timeout") or 10.0)
        timeout = max(2.0, min(timeout, 45.0))
        return {
            "base_url": base_url,
            "username": username,
            "password": password,
            "timeout": timeout,
            "device_row": device_row,
            "host": host,
            "port": port,
        }, None

    def _request_via_sdk(
        self,
        state: DeviceState,
        method: str,
        path: str,
        json_body: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        try:
            body_text = None if json_body is None else json.dumps(json_body, ensure_ascii=False)
            sdk_payload = self.runtime.isapi_passthrough(
                login_id=state.login_id,
                method=method,
                request_path=path,
                body=body_text,
            )
            text = self._compact_text(str(sdk_payload.get("text") or ""))
            parsed_json = self._try_parse_json(text)
            reason = self._payload_error_reason(parsed_json, text)
            return {
                "ok": reason is None,
                "transport": "isup_sdk_ptxml",
                "request_path": path,
                "status_code": None,
                "json": parsed_json,
                "text": text,
                "error": reason,
            }
        except Exception as exc:
            return {
                "ok": False,
                "transport": "isup_sdk_ptxml",
                "request_path": path,
                "status_code": None,
                "json": None,
                "text": "",
                "error": str(exc),
            }

    def _request_via_http(
        self,
        target_device_id: str,
        state: DeviceState,
        method: str,
        path: str,
        params: dict[str, Any],
        json_body: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        if httpx is None:
            return {
                "ok": False,
                "transport": "http_digest",
                "error": "httpx paketi topilmadi",
                "status_code": None,
                "json": None,
                "text": "",
            }

        conn, err = self._resolve_http_connection(target_device_id, state, params)
        if conn is None:
            return {
                "ok": False,
                "transport": "http_digest",
                "error": err or "HTTP connection params topilmadi",
                "status_code": None,
                "json": None,
                "text": "",
            }

        request_path = path if path.startswith("/") else f"/{path}"
        url = f"{conn['base_url']}{request_path}"
        try:
            with httpx.Client(
                auth=httpx.DigestAuth(conn["username"], conn["password"]),
                timeout=float(conn["timeout"]),
                verify=False,
                trust_env=False,
            ) as client:
                response = client.request(method.upper(), url, json=json_body)

            text = self._compact_text(response.text or "")
            parsed_json = None
            try:
                parsed_json = response.json()
            except Exception:
                parsed_json = self._try_parse_json(text)

            reason = self._payload_error_reason(parsed_json, text)
            ok = response.status_code < 400 and reason is None
            return {
                "ok": ok,
                "transport": "http_digest",
                "request_path": request_path,
                "status_code": int(response.status_code),
                "json": parsed_json,
                "text": text,
                "error": reason if reason else (None if ok else f"HTTP {response.status_code}"),
                "camera_ip": conn["host"],
                "camera_http_port": conn["port"],
                "camera_db": conn["device_row"],
            }
        except Exception as exc:
            return {
                "ok": False,
                "transport": "http_digest",
                "request_path": request_path,
                "status_code": None,
                "json": None,
                "text": "",
                "error": str(exc),
            }

    def _request_camera(
        self,
        target_device_id: str,
        state: DeviceState,
        method: str,
        path: str,
        params: dict[str, Any],
        json_body: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        allow_http_fallback = self._parse_bool(params.get("allow_http_fallback"), False)
        isup_only_mode = not allow_http_fallback
        force_http = self._parse_bool(params.get("force_http"), False)
        force_sdk = self._parse_bool(params.get("force_sdk"), False) or isup_only_mode

        request_path = path if path.startswith("/") else f"/{path}"

        # Default mode: ISUP SDK only. Direct HTTP digest fallback is disabled unless explicitly allowed.
        if force_http and isup_only_mode:
            return {
                "ok": False,
                "transport": "isup_sdk_ptxml",
                "request_path": request_path,
                "status_code": None,
                "json": None,
                "text": "",
                "error": "HTTP fallback o'chirilgan (ISUP-only mode).",
            }

        sdk_result: Optional[dict[str, Any]] = None
        if not force_http:
            sdk_result = self._request_via_sdk(state, method, path, json_body=json_body)
            if sdk_result.get("ok"):
                return sdk_result
            if force_sdk:
                return sdk_result

        if isup_only_mode:
            if sdk_result is not None:
                return sdk_result
            return {
                "ok": False,
                "transport": "isup_sdk_ptxml",
                "request_path": request_path,
                "status_code": None,
                "json": None,
                "text": "",
                "error": "ISUP SDK so'rovi bajarilmadi.",
            }

        http_result = self._request_via_http(
            target_device_id,
            state,
            method,
            path,
            params,
            json_body=json_body,
        )
        if sdk_result is not None and sdk_result.get("error"):
            http_result["sdk_error"] = sdk_result.get("error")
        return http_result

    @staticmethod
    def _build_user_record_payload(personal_id: str, full_name: str) -> dict[str, Any]:
        safe_name = (full_name or "").strip() or f"User {personal_id}"
        return {
            "UserInfo": {
                "employeeNo": personal_id,
                "name": safe_name[:63],
                "userType": "normal",
                "Valid": {
                    "enable": True,
                    "beginTime": "2020-01-01T00:00:00",
                    "endTime": "2037-12-31T23:59:59",
                },
                "doorRight": "1",
                "RightPlan": [{"doorNo": 1, "planTemplateNo": "1"}],
                "maxOpenDoorTime": 0,
                "openDoorTime": 0,
                "localUIRight": False,
            }
        }

    def _cmd_ping(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        response = self._request_camera(
            target_device_id,
            state,
            "GET",
            "/ISAPI/System/deviceInfo",
            params,
        )
        if not response.get("ok"):
            return {
                "ok": False,
                "error": response.get("error") or "Kameraga ulanish tekshiruvi muvaffaqiyatsiz",
                "transport": response.get("transport"),
                "status_code": response.get("status_code"),
                "sdk_error": response.get("sdk_error"),
                "message": "Kamera javobi olinmadi.",
            }

        xml_info = self._extract_xml_fields(
            str(response.get("text") or ""),
            {"deviceName", "model", "firmwareVersion", "serialNumber", "deviceID"},
        )
        self._merge_state_from_camera_info(state, xml_info)
        return {
            "ok": True,
            "result": "PONG",
            "transport": response.get("transport"),
            "status_code": response.get("status_code"),
            "camera_info": xml_info,
            "message": "Kamera online va buyruq kanali ishlayapti.",
        }

    def _cmd_get_info(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        response = self._request_camera(
            target_device_id,
            state,
            "GET",
            "/ISAPI/System/deviceInfo",
            params,
        )
        if not response.get("ok"):
            return {
                "ok": False,
                "error": response.get("error") or "Qurilma ma'lumoti olinmadi",
                "transport": response.get("transport"),
                "status_code": response.get("status_code"),
                "sdk_error": response.get("sdk_error"),
                "message": "Qurilma ma'lumotlarini olishda xatolik.",
            }

        xml_info = self._extract_xml_fields(
            str(response.get("text") or ""),
            {
                "deviceName",
                "deviceID",
                "model",
                "firmwareVersion",
                "firmwareReleasedDate",
                "serialNumber",
                "macAddress",
            },
        )
        self._merge_state_from_camera_info(state, xml_info)
        return {
            "ok": True,
            "device": state.to_payload(),
            "camera_info": xml_info,
            "transport": response.get("transport"),
            "status_code": response.get("status_code"),
            "message": "Qurilma ma'lumotlari qaytarildi.",
        }

    def _cmd_get_face_count(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        user_count_resp = self._request_camera(
            target_device_id,
            state,
            "GET",
            "/ISAPI/AccessControl/UserInfo/Count?format=json",
            params,
        )
        if not user_count_resp.get("ok"):
            return {
                "ok": False,
                "error": user_count_resp.get("error") or "UserInfo count olinmadi",
                "transport": user_count_resp.get("transport"),
                "status_code": user_count_resp.get("status_code"),
                "sdk_error": user_count_resp.get("sdk_error"),
            }

        fd_count_resp = self._request_camera(
            target_device_id,
            state,
            "GET",
            "/ISAPI/Intelligent/FDLib/Count?format=json",
            params,
        )

        user_count_json = user_count_resp.get("json")
        user_info = user_count_json.get("UserInfoCount", {}) if isinstance(user_count_json, dict) else {}
        user_number = self._safe_int(user_info.get("userNumber"), -1)
        bind_face_users = self._safe_int(user_info.get("bindFaceUserNumber"), -1)

        fd_total: Optional[int] = None
        if fd_count_resp.get("ok") and isinstance(fd_count_resp.get("json"), dict):
            fd_data = fd_count_resp["json"].get("FDRecordDataInfo")
            if isinstance(fd_data, list):
                fd_total = 0
                for row in fd_data:
                    if isinstance(row, dict):
                        fd_total += max(0, self._safe_int(row.get("recordDataNumber"), 0))

        face_count: Optional[int]
        if fd_total is not None:
            face_count = fd_total
        elif bind_face_users >= 0:
            face_count = bind_face_users
        elif user_number >= 0:
            face_count = user_number
        else:
            face_count = None

        device_row = self._find_device_row(target_device_id, state)
        self._update_device_usage((device_row or {}).get("id"), face_count)

        return {
            "ok": True,
            "face_count": face_count,
            "user_count": user_number if user_number >= 0 else None,
            "bind_face_user_count": bind_face_users if bind_face_users >= 0 else None,
            "fd_record_total": fd_total,
            "transport": user_count_resp.get("transport"),
            "status_code": user_count_resp.get("status_code"),
            "fd_transport": fd_count_resp.get("transport"),
            "fd_status_code": fd_count_resp.get("status_code"),
            "fd_error": None if fd_count_resp.get("ok") else fd_count_resp.get("error"),
            "message": "Kameradagi foydalanuvchi/yuzlar soni olindi.",
        }

    def _cmd_get_users(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        max_results = max(1, min(self._safe_int(params.get("max_results"), 100), 500))
        start_pos = max(0, self._safe_int(params.get("searchResultPosition"), 0))
        request_body = {
            "UserInfoSearchCond": {
                "searchID": str(int(time.time())),
                "searchResultPosition": start_pos,
                "maxResults": max_results,
            }
        }
        response = self._request_camera(
            target_device_id,
            state,
            "POST",
            "/ISAPI/AccessControl/UserInfo/Search?format=json",
            params,
            json_body=request_body,
        )
        if not response.get("ok"):
            return {
                "ok": False,
                "error": response.get("error") or "User list olinmadi",
                "transport": response.get("transport"),
                "status_code": response.get("status_code"),
                "sdk_error": response.get("sdk_error"),
            }

        payload = response.get("json")
        search_info = payload.get("UserInfoSearch", {}) if isinstance(payload, dict) else {}
        rows = search_info.get("UserInfo")
        users_raw: list[dict[str, Any]]
        if isinstance(rows, list):
            users_raw = [item for item in rows if isinstance(item, dict)]
        elif isinstance(rows, dict):
            users_raw = [rows]
        else:
            users_raw = []

        users = [
            {
                "employeeNo": str(item.get("employeeNo") or "").strip(),
                "name": str(item.get("name") or "").strip(),
                "userType": item.get("userType"),
                "Valid": item.get("Valid"),
            }
            for item in users_raw
        ]
        total_matches = self._safe_int(search_info.get("totalMatches"), len(users))
        return {
            "ok": True,
            "users": users,
            "count": len(users),
            "total_matches": total_matches,
            "transport": response.get("transport"),
            "status_code": response.get("status_code"),
            "message": f"{len(users)} ta foydalanuvchi olindi.",
        }

    @staticmethod
    def _extract_attendance_rows(payload: Any) -> tuple[list[dict[str, Any]], int]:
        if not isinstance(payload, dict):
            return [], 0

        event_root = payload.get("AcsEvent") if isinstance(payload.get("AcsEvent"), dict) else payload
        if not isinstance(event_root, dict):
            return [], 0

        rows_raw: Any = None
        for key in ("InfoList", "AcsEventInfo", "AcsEventInfoList", "EventList", "events"):
            candidate = event_root.get(key)
            if candidate is not None:
                rows_raw = candidate
                break

        if isinstance(rows_raw, list):
            rows = [r for r in rows_raw if isinstance(r, dict)]
        elif isinstance(rows_raw, dict):
            rows = [rows_raw]
        else:
            rows = []

        total_matches = 0
        for key in ("totalMatches", "numOfMatches", "TotalMatches", "NumOfMatches"):
            if key in event_root:
                try:
                    value = int(str(event_root.get(key) or "0").strip() or "0")
                except Exception:
                    value = 0
                total_matches = max(total_matches, value)
        if total_matches <= 0:
            total_matches = len(rows)

        return rows, total_matches

    def _cmd_get_attendance_events(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        # DS-K1T34x qurilmalarda AcsEvent qidiruv maxResults > 15 bo'lsa bo'sh javob qaytarishi mumkin.
        page_size = max(1, min(self._safe_int(params.get("max_results"), 10), 15))
        limit = max(1, min(self._safe_int(params.get("limit"), 500), 2000))
        offset = max(0, self._safe_int(params.get("searchResultPosition"), 0))

        now_local = datetime.now().astimezone()
        hours = max(1, min(self._safe_int(params.get("hours"), 72), 24 * 30))
        start_dt = now_local - timedelta(hours=hours)
        end_dt = now_local

        user_start = self._parse_dt_any(params.get("start_time"))
        user_end = self._parse_dt_any(params.get("end_time"))
        if user_start is not None:
            start_dt = user_start.astimezone()
        if user_end is not None:
            end_dt = user_end.astimezone()

        start_time = self._as_isapi_time(start_dt)
        end_time = self._as_isapi_time(end_dt)

        events: list[dict[str, Any]] = []
        total_matches = 0
        transport = "isup_sdk_ptxml"
        status_code: Optional[int] = None
        search_id = str(int(time.time() * 1000))

        while len(events) < limit:
            major_default = 5
            minor_default = 75
            req = {
                "AcsEventCond": {
                    "searchID": search_id,
                    "searchResultPosition": offset,
                    "maxResults": page_size,
                    "major": self._safe_int(params.get("major"), major_default),
                    "minor": self._safe_int(params.get("minor"), minor_default),
                    "startTime": start_time,
                    "endTime": end_time,
                }
            }

            response = self._request_camera(
                target_device_id,
                state,
                "POST",
                "/ISAPI/AccessControl/AcsEvent?format=json",
                params,
                json_body=req,
            )
            transport = str(response.get("transport") or transport)
            status_code = response.get("status_code")
            if not response.get("ok"):
                return {
                    "ok": False,
                    "error": response.get("error") or "Davomat eventlari olinmadi",
                    "transport": transport,
                    "status_code": status_code,
                    "sdk_error": response.get("sdk_error"),
                }

            payload = response.get("json")
            rows, page_total = self._extract_attendance_rows(payload)
            total_matches = max(total_matches, page_total)
            if not rows:
                break

            for row in rows:
                if len(events) >= limit:
                    break

                sources = [row]
                for nested_key in ("EmployeeInfo", "UserInfo", "AcsEventInfo", "FaceInfo"):
                    nested = row.get(nested_key)
                    if isinstance(nested, dict):
                        sources.append(nested)

                def _pick(*keys: str) -> str:
                    for src in sources:
                        for key in keys:
                            if key not in src:
                                continue
                            val = src.get(key)
                            if isinstance(val, dict):
                                for dict_key in ("value", "employeeNo", "name", "id", "userID", "employeeNoString"):
                                    nested_val = val.get(dict_key)
                                    text = str(nested_val or "").strip()
                                    if text:
                                        return text
                                continue
                            text = str(val or "").strip()
                            if text:
                                return text
                    return ""

                event_time_raw = _pick("dateTime", "time", "eventTime", "currentTime", "occurTime")
                event_dt = self._parse_dt_any(event_time_raw)
                event_time_iso = iso_utc(event_dt) if event_dt is not None else None

                major = self._safe_int(_pick("major"), 0)
                minor = self._safe_int(_pick("minor"), 0)
                person_id = _pick(
                    "employeeNoString",
                    "employeeNo",
                    "personID",
                    "personId",
                    "userID",
                    "userId",
                    "cardNo",
                )
                person_name = _pick("name", "employeeName", "personName", "userName")
                snapshot_url = _pick("pictureURL", "snapPicURL", "faceURL", "snapshotUrl")

                events.append(
                    {
                        "person_id": person_id or None,
                        "person_name": person_name or None,
                        "timestamp": event_time_iso,
                        "snapshot_url": snapshot_url or None,
                        "major": major,
                        "minor": minor,
                        "raw": row,
                    }
                )

            offset += len(rows)
            if len(rows) < page_size:
                break
            if total_matches > 0 and offset >= total_matches:
                break

        return {
            "ok": True,
            "events": events,
            "count": len(events),
            "total_matches": max(total_matches, len(events)),
            "start_time": start_time,
            "end_time": end_time,
            "transport": transport,
            "status_code": status_code,
            "message": f"{len(events)} ta davomat eventi olindi.",
        }

    def _cmd_get_face_records(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        face_lib_type = str(params.get("face_lib_type") or "blackFD").strip() or "blackFD"
        fdid = str(params.get("fdid") or "1").strip() or "1"
        page_size = max(1, min(self._safe_int(params.get("max_results"), 30), 30))
        limit = max(1, min(self._safe_int(params.get("limit"), 300), 1000))
        fetch_all = self._parse_bool(params.get("all"), True)

        records: list[dict[str, Any]] = []
        total_matches = 0
        start_pos = max(0, self._safe_int(params.get("searchResultPosition"), 0))
        transport = "isup_sdk_ptxml"
        status_code: Optional[int] = None

        while True:
            req_body = {
                "faceLibType": face_lib_type,
                "FDID": fdid,
                "searchResultPosition": start_pos,
                "maxResults": page_size,
            }
            response = self._request_camera(
                target_device_id,
                state,
                "POST",
                "/ISAPI/Intelligent/FDLib/FDSearch?format=json",
                params,
                json_body=req_body,
            )
            transport = str(response.get("transport") or transport)
            status_code = response.get("status_code")
            if not response.get("ok"):
                return {
                    "ok": False,
                    "error": response.get("error") or "Kameradagi face records olinmadi",
                    "transport": response.get("transport"),
                    "status_code": response.get("status_code"),
                    "sdk_error": response.get("sdk_error"),
                }

            payload = response.get("json")
            match_list = payload.get("MatchList", []) if isinstance(payload, dict) else []
            if not isinstance(match_list, list):
                match_list = []
            if isinstance(payload, dict):
                total_matches = max(total_matches, self._safe_int(payload.get("totalMatches"), len(match_list)))

            for item in match_list:
                if not isinstance(item, dict):
                    continue
                records.append(
                    {
                        "fpid": str(item.get("FPID") or "").strip(),
                        "face_url": str(item.get("faceURL") or "").strip(),
                        "face_lib_type": face_lib_type,
                        "fdid": fdid,
                    }
                )
                if len(records) >= limit:
                    break

            if len(records) >= limit:
                break
            if not fetch_all:
                break
            if not match_list:
                break

            start_pos += len(match_list)
            if total_matches and start_pos >= total_matches:
                break

        return {
            "ok": True,
            "records": records,
            "count": len(records),
            "total_matches": total_matches or len(records),
            "face_lib_type": face_lib_type,
            "fdid": fdid,
            "transport": transport,
            "status_code": status_code,
            "message": f"{len(records)} ta kamera face record olindi.",
        }

    def _cmd_get_device_snapshot(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        info = self._cmd_get_info(target_device_id, state, params)
        if not info.get("ok"):
            return info

        warnings: list[str] = []

        counts = self._cmd_get_face_count(target_device_id, state, params)
        if not counts.get("ok"):
            warnings.append(str(counts.get("error") or "Face/User count endpoint qo'llab-quvvatlanmaydi"))
            counts = {
                "ok": False,
                "face_count": 0,
                "user_count": 0,
                "bind_face_user_count": 0,
                "fd_record_total": 0,
                "transport": counts.get("transport"),
                "status_code": counts.get("status_code"),
            }

        users = self._cmd_get_users(target_device_id, state, {"max_results": 30, "searchResultPosition": 0, **params})
        if not users.get("ok"):
            warnings.append(str(users.get("error") or "User list endpoint qo'llab-quvvatlanmaydi"))
            users = {
                "ok": False,
                "users": [],
                "count": 0,
                "total_matches": 0,
                "transport": users.get("transport"),
                "status_code": users.get("status_code"),
            }

        card_count_resp = self._request_camera(
            target_device_id,
            state,
            "GET",
            "/ISAPI/AccessControl/CardInfo/Count?format=json",
            params,
        )
        if not card_count_resp.get("ok"):
            warnings.append(str(card_count_resp.get("error") or "Card count endpoint qo'llab-quvvatlanmaydi"))
        card_count = 0
        if isinstance(card_count_resp.get("json"), dict):
            card_count = self._safe_int(
                self._deep_get(card_count_resp["json"], ("CardInfoCount", "cardNumber"), 0),
                0,
            )

        user_cap_resp = self._request_camera(
            target_device_id,
            state,
            "GET",
            "/ISAPI/AccessControl/UserInfo/capabilities?format=json",
            params,
        )
        if not user_cap_resp.get("ok"):
            warnings.append(str(user_cap_resp.get("error") or "User capability endpoint qo'llab-quvvatlanmaydi"))
        card_cap_resp = self._request_camera(
            target_device_id,
            state,
            "GET",
            "/ISAPI/AccessControl/CardInfo/capabilities?format=json",
            params,
        )
        if not card_cap_resp.get("ok"):
            warnings.append(str(card_cap_resp.get("error") or "Card capability endpoint qo'llab-quvvatlanmaydi"))
        fd_cap_resp = self._request_camera(
            target_device_id,
            state,
            "GET",
            "/ISAPI/Intelligent/FDLib/capabilities?format=json",
            params,
        )
        if not fd_cap_resp.get("ok"):
            warnings.append(str(fd_cap_resp.get("error") or "Face capability endpoint qo'llab-quvvatlanmaydi"))
        event_cap_resp = self._request_camera(
            target_device_id,
            state,
            "GET",
            "/ISAPI/AccessControl/AcsEvent/capabilities?format=json",
            params,
        )
        if not event_cap_resp.get("ok"):
            warnings.append(str(event_cap_resp.get("error") or "Event capability endpoint qo'llab-quvvatlanmaydi"))
        event_total_resp = self._request_camera(
            target_device_id,
            state,
            "GET",
            "/ISAPI/AccessControl/AcsEvent/TotalNum?format=json",
            params,
        )
        if not event_total_resp.get("ok"):
            warnings.append(str(event_total_resp.get("error") or "Event total endpoint qo'llab-quvvatlanmaydi"))
        network_resp = self._request_camera(
            target_device_id,
            state,
            "GET",
            "/ISAPI/System/Network/interfaces/1",
            params,
        )
        if not network_resp.get("ok"):
            warnings.append(str(network_resp.get("error") or "Network endpoint qo'llab-quvvatlanmaydi"))

        user_max = self._safe_int(
            self._deep_get(user_cap_resp.get("json"), ("UserInfo", "maxRecordNum"), counts.get("user_count") or 0),
            counts.get("user_count") or 0,
        )
        card_max = self._safe_int(
            self._deep_get(card_cap_resp.get("json"), ("CardInfo", "maxRecordNum"), card_count or 0),
            card_count or 0,
        )
        face_max = self._safe_int(
            self._deep_get(fd_cap_resp.get("json"), ("FDRecordDataMaxNum",), counts.get("face_count") or 0),
            counts.get("face_count") or 0,
        )
        event_max = self._safe_int(
            self._deep_get(event_cap_resp.get("json"), ("AcsEvent", "AcsEventCond", "searchResultPosition", "@max"), 0),
            0,
        )
        event_count = self._safe_int(
            self._deep_get(event_total_resp.get("json"), ("AcsEventTotalNum", "totalNum"), 0),
            0,
        )

        info_fields = info.get("camera_info") or {}
        serial_full = str(info_fields.get("serialNumber") or "").strip()
        serial_short = serial_full
        if serial_full:
            serial_match = re.search(r"([A-Z]{2}\d{6,})$", serial_full)
            if serial_match:
                serial_short = serial_match.group(1)
            elif len(serial_full) > 10:
                serial_short = serial_full[-10:]
        firmware_version = str(info_fields.get("firmwareVersion") or state.firmware or "").strip()
        firmware_date = str(info_fields.get("firmwareReleasedDate") or "").strip()
        firmware_full = firmware_version if not firmware_date else f"{firmware_version} {firmware_date}"

        net_fields = self._extract_xml_fields(
            str(network_resp.get("text") or ""),
            {"ipAddress", "MACAddress", "macAddress", "speed", "duplex", "addressingType"},
        )
        ip_addr = net_fields.get("ipAddress") or state.ip
        mac_addr = net_fields.get("MACAddress") or net_fields.get("macAddress") or ""

        person_added = self._safe_int(counts.get("user_count"), 0)
        face_added = self._safe_int(counts.get("face_count"), 0)
        card_added = self._safe_int(card_count, 0)

        snapshot = {
            "person_information": {
                "person": {
                    "added": person_added,
                    "not_added": max(user_max - person_added, 0),
                    "max": user_max,
                },
                "face": {
                    "added": face_added,
                    "not_added": max(face_max - face_added, 0),
                    "max": face_max,
                },
                "card": {
                    "added": card_added,
                    "not_added": max(card_max - card_added, 0),
                    "max": card_max,
                },
            },
            "network_status": {
                "wired_network": "Connected" if network_resp.get("ok") else "Disconnected",
                "isup": "Registered" if state.online else "Not Registered",
                "otap1": "Not Registered",
                "otap2": "Not Registered",
                "hik_connect": "Offline",
                "voip": "Not Registered",
            },
            "basic_information": {
                "model": str(info_fields.get("model") or state.model or "Unknown"),
                "serial_no": serial_short or serial_full or "-",
                "serial_full": serial_full or "-",
                "firmware_version": firmware_full or "-",
            },
            "capacity": {
                "person_count": person_added,
                "person_max": user_max,
                "face_count": face_added,
                "face_max": face_max,
                "card_count": card_added,
                "card_max": card_max,
                "event_count": event_count,
                "event_max": event_max,
            },
            "network": {
                "ip": ip_addr,
                "mac": mac_addr,
                "speed": net_fields.get("speed") or "",
                "duplex": net_fields.get("duplex") or "",
                "addressing_type": net_fields.get("addressingType") or "",
            },
            "users_preview": users.get("users", [])[:10],
            "users_count": users.get("total_matches", users.get("count", 0)),
            "source": {
                "info_transport": info.get("transport"),
                "counts_transport": counts.get("transport"),
                "users_transport": users.get("transport"),
            },
            "warnings": warnings,
        }
        return {
            "ok": True,
            "transport": info.get("transport") or "isup_sdk_ptxml",
            "source_transports": {
                "info": info.get("transport"),
                "counts": counts.get("transport"),
                "users": users.get("transport"),
            },
            "snapshot": snapshot,
            "warnings": warnings,
            "message": "Kamera snapshot ma'lumotlari olindi.",
        }

    def _cmd_add_user(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        employee_id = self._safe_int(params.get("employee_id"), 0)
        employee = self._fetch_employee_row(employee_id) if employee_id > 0 else None

        personal_id = str(params.get("personal_id") or (employee or {}).get("personal_id") or "").strip()
        if not self._valid_personal_id(personal_id):
            return {
                "ok": False,
                "error": "personal_id 7 xonali bo'lishi va 0 bilan boshlanmasligi kerak.",
            }

        first_name = str(params.get("first_name") or (employee or {}).get("first_name") or "").strip()
        last_name = str(params.get("last_name") or (employee or {}).get("last_name") or "").strip()
        full_name = f"{first_name} {last_name}".strip() or str(params.get("name") or "").strip() or f"User {personal_id}"

        request_body = self._build_user_record_payload(personal_id, full_name)
        response = self._request_camera(
            target_device_id,
            state,
            "POST",
            "/ISAPI/AccessControl/UserInfo/Record?format=json",
            params,
            json_body=request_body,
        )
        if not response.get("ok"):
            return {
                "ok": False,
                "error": response.get("error") or "Foydalanuvchi kameraga yozilmadi",
                "transport": response.get("transport"),
                "status_code": response.get("status_code"),
                "sdk_error": response.get("sdk_error"),
            }

        return {
            "ok": True,
            "personal_id": personal_id,
            "name": full_name,
            "transport": response.get("transport"),
            "status_code": response.get("status_code"),
            "message": f"{full_name} ({personal_id}) kameraga yozildi.",
        }

    def _cmd_delete_user(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        personal_id = str(
            params.get("personal_id")
            or params.get("employeeNo")
            or params.get("fpid")
            or ""
        ).strip()
        if not personal_id:
            return {"ok": False, "error": "personal_id kiritilishi shart."}

        face_lib_type = str(params.get("face_lib_type") or "blackFD").strip() or "blackFD"
        fdid = str(params.get("fdid") or "1").strip() or "1"

        face_deleted = False
        face_error: Optional[str] = None
        face_payload_variants = [
            {"faceLibType": face_lib_type, "FDID": fdid, "FPID": [{"value": personal_id}]},
            {"faceLibType": face_lib_type, "FDID": fdid, "FPID": [personal_id]},
            {"faceLibType": face_lib_type, "FDID": fdid, "FPID": personal_id},
        ]
        for payload in face_payload_variants:
            response = self._request_camera(
                target_device_id,
                state,
                "PUT",
                "/ISAPI/Intelligent/FDLib/FDDelete?format=json",
                params,
                json_body=payload,
            )
            if response.get("ok"):
                face_deleted = True
                break

            face_error = str(response.get("error") or "Face o'chirishda xatolik")
            retry_post = "methodnotallowed" in face_error.lower()
            if retry_post:
                response_post = self._request_camera(
                    target_device_id,
                    state,
                    "POST",
                    "/ISAPI/Intelligent/FDLib/FDDelete?format=json",
                    params,
                    json_body=payload,
                )
                if response_post.get("ok"):
                    face_deleted = True
                    face_error = None
                    break
                face_error = str(response_post.get("error") or face_error)

        user_delete_variants: list[tuple[str, dict[str, Any]]] = [
            (
                "/ISAPI/AccessControl/UserInfoDetail/Delete?format=json",
                {
                    "UserInfoDetail": {
                        "mode": "byEmployeeNo",
                        "EmployeeNoList": [{"employeeNo": personal_id}],
                    }
                },
            ),
            (
                "/ISAPI/AccessControl/UserInfoDetail/Delete?format=json",
                {
                    "UserInfoDetail": {
                        "mode": "byEmployeeNo",
                        "numOfEmployeeNo": 1,
                        "EmployeeNoList": [{"employeeNo": personal_id}],
                    }
                },
            ),
            (
                "/ISAPI/AccessControl/UserInfo/Delete?format=json",
                {
                    "UserInfoDelCond": {
                        "EmployeeNoList": [{"employeeNo": personal_id}],
                    }
                },
            ),
        ]

        user_deleted = False
        user_error = "Foydalanuvchini kameradan o'chirib bo'lmadi"
        user_transport = None
        user_status = None
        for path, payload in user_delete_variants:
            response = self._request_camera(
                target_device_id,
                state,
                "PUT",
                path,
                params,
                json_body=payload,
            )
            if response.get("ok"):
                user_deleted = True
                user_transport = response.get("transport")
                user_status = response.get("status_code")
                break

            user_error = str(response.get("error") or user_error)
            retry_post = "methodnotallowed" in user_error.lower()
            if retry_post:
                response_post = self._request_camera(
                    target_device_id,
                    state,
                    "POST",
                    path,
                    params,
                    json_body=payload,
                )
                if response_post.get("ok"):
                    user_deleted = True
                    user_transport = response_post.get("transport")
                    user_status = response_post.get("status_code")
                    user_error = ""
                    break
                user_error = str(response_post.get("error") or user_error)

        if not user_deleted:
            return {
                "ok": False,
                "error": user_error,
                "personal_id": personal_id,
                "face_deleted": face_deleted,
                "face_error": face_error,
            }

        return {
            "ok": True,
            "personal_id": personal_id,
            "face_deleted": face_deleted,
            "face_error": None if face_deleted else face_error,
            "transport": user_transport,
            "status_code": user_status,
            "message": f"{personal_id} kameradan o'chirildi.",
        }

    def _cmd_set_face(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        personal_id = str(params.get("personal_id") or params.get("fpid") or "").strip()
        face_url = str(params.get("face_url") or "").strip()
        face_b64 = str(params.get("face_b64") or params.get("face_data") or "").strip()
        face_mime = str(params.get("face_mime") or "image/jpeg").strip() or "image/jpeg"
        if not personal_id:
            return {"ok": False, "error": "personal_id (FPID) kiritilishi shart."}
        if not face_url and not face_b64:
            return {"ok": False, "error": "face_b64 yoki face_url kiritilishi shart."}

        face_lib_type = str(params.get("face_lib_type") or "blackFD").strip() or "blackFD"
        fdid = str(params.get("fdid") or "1").strip() or "1"

        payload_attempts: list[tuple[str, str, dict[str, Any], str]] = []
        clean_b64 = ""
        if face_b64:
            clean_b64 = re.sub(r"\s+", "", face_b64)
            data_uri = f"data:{face_mime};base64,{clean_b64}"
            # 1) To'liq ISUP: rasmni inline base64 qilib yuborish.
            payload_attempts.extend(
                [
                    (
                        "PUT",
                        "/ISAPI/Intelligent/FDLib/FDSetUp?format=json",
                        {
                            "faceLibType": face_lib_type,
                            "FDID": fdid,
                            "FPID": personal_id,
                            "faceData": clean_b64,
                        },
                        "inline_faceData",
                    ),
                    (
                        "POST",
                        "/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json",
                        {
                            "FaceDataRecord": {
                                "faceLibType": face_lib_type,
                                "FDID": fdid,
                                "FPID": personal_id,
                                "faceData": clean_b64,
                            }
                        },
                        "inline_faceDataRecord",
                    ),
                    (
                        "POST",
                        "/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json",
                        {
                            "faceLibType": face_lib_type,
                            "FDID": fdid,
                            "FPID": personal_id,
                            "faceData": clean_b64,
                        },
                        "inline_faceDataRecord_flat",
                    ),
                    (
                        "PUT",
                        "/ISAPI/Intelligent/FDLib/FDSetUp?format=json",
                        {
                            "faceLibType": face_lib_type,
                            "FDID": fdid,
                            "FPID": personal_id,
                            "faceURL": data_uri,
                        },
                        "inline_data_uri",
                    ),
                ]
            )

        # 2) Fallback: tashqi URL asosida (agar foydalanuvchi o'zi bergan bo'lsa).
        if face_url:
            payload_attempts.extend(
                [
                    (
                        "PUT",
                        "/ISAPI/Intelligent/FDLib/FDSetUp?format=json",
                        {
                            "faceLibType": face_lib_type,
                            "FDID": fdid,
                            "FPID": personal_id,
                            "faceURL": face_url,
                        },
                        "face_url_put",
                    ),
                    (
                        "POST",
                        "/ISAPI/Intelligent/FDLib/FDSetUp?format=json",
                        {
                            "faceLibType": face_lib_type,
                            "FDID": fdid,
                            "FPID": personal_id,
                            "faceURL": face_url,
                        },
                        "face_url_post",
                    ),
                ]
            )

        response: Optional[dict[str, Any]] = None
        method_used: Optional[str] = None
        path_used: Optional[str] = None
        mode_used: Optional[str] = None
        last_error = "Kameraga face yozilmadi"
        errors: list[str] = []
        for method, path, payload, mode in payload_attempts:
            method_err = None
            attempts = 2 if method == "PUT" else 1
            for attempt_idx in range(attempts):
                current = self._request_camera(
                    target_device_id,
                    state,
                    method,
                    path,
                    params,
                    json_body=payload,
                )
                if current.get("ok"):
                    response = current
                    method_used = method
                    path_used = path
                    mode_used = mode
                    break

                err_text = str(current.get("error") or last_error)
                method_err = err_text
                last_error = err_text
                # SDK code=10 ko'pincha vaqtinchalik PTXML call xatosi bo'ladi, bir marta qayta urinib ko'ramiz.
                if method == "PUT" and "code=10" in err_text.lower() and attempt_idx + 1 < attempts:
                    time.sleep(0.2)
                    continue
                break

            if response is not None:
                break
            if method_err:
                errors.append(f"{method} {path}: {method_err}")

        if response is None:
            human_error = "; ".join(errors) if errors else last_error
            if clean_b64 and "face_url" in human_error.lower():
                human_error = f"{human_error}. Inline ISUP face payload qabul qilinmadi."
            return {
                "ok": False,
                "error": human_error,
                "transport": "isup_sdk_ptxml",
                "status_code": None,
                "sdk_error": None,
            }

        return {
            "ok": True,
            "personal_id": personal_id,
            "face_url": face_url or None,
            "inline_payload": bool(clean_b64),
            "transport": response.get("transport"),
            "status_code": response.get("status_code"),
            "method_used": method_used,
            "path_used": path_used,
            "mode_used": mode_used,
            "message": f"{personal_id} uchun face yozildi.",
        }

    def _cmd_sync_faces(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        device_row = self._find_device_row(target_device_id, state) or {}
        org_override = params.get("organization_id")
        org_id = self._safe_int(org_override, -1) if org_override is not None else device_row.get("organization_id")
        if org_id == -1:
            org_id = None

        max_sync = max(1, min(self._safe_int(params.get("max_sync"), 500), 5000))
        dry_run = self._parse_bool(params.get("dry_run"), False)
        employees = self._fetch_sync_employees(org_id, max_sync)
        if not employees:
            return {
                "ok": True,
                "queued": False,
                "dry_run": dry_run,
                "total_candidates": 0,
                "synced_users": 0,
                "failed_users": 0,
                "skipped_users": 0,
                "message": "Sinxron qilish uchun xodimlar topilmadi (DB bo'sh).",
            }

        synced = 0
        skipped = 0
        failed = 0
        failed_items: list[dict[str, Any]] = []
        skipped_items: list[dict[str, Any]] = []

        for row in employees:
            personal_id = str(row.get("personal_id") or "").strip()
            if not self._valid_personal_id(personal_id):
                skipped += 1
                if len(skipped_items) < 10:
                    skipped_items.append(
                        {
                            "employee_id": row.get("id"),
                            "reason": "personal_id noto'g'ri yoki bo'sh",
                        }
                    )
                continue

            first_name = str(row.get("first_name") or "").strip()
            last_name = str(row.get("last_name") or "").strip()
            full_name = f"{first_name} {last_name}".strip() or f"Employee {row.get('id')}"

            if dry_run:
                synced += 1
                continue

            request_body = self._build_user_record_payload(personal_id, full_name)
            response = self._request_camera(
                target_device_id,
                state,
                "POST",
                "/ISAPI/AccessControl/UserInfo/Record?format=json",
                params,
                json_body=request_body,
            )
            if response.get("ok"):
                synced += 1
            else:
                failed += 1
                if len(failed_items) < 10:
                    failed_items.append(
                        {
                            "employee_id": row.get("id"),
                            "personal_id": personal_id,
                            "error": response.get("error"),
                        }
                    )

        count_payload = self._cmd_get_face_count(target_device_id, state, params)
        face_count = count_payload.get("face_count") if isinstance(count_payload, dict) else None
        return {
            "ok": True,
            "queued": False,
            "dry_run": dry_run,
            "total_candidates": len(employees),
            "synced_users": synced,
            "failed_users": failed,
            "skipped_users": skipped,
            "failed_examples": failed_items,
            "skipped_examples": skipped_items,
            "face_count": face_count,
            "message": f"Sinxron yakunlandi: {synced} muvaffaqiyatli, {failed} xato, {skipped} o'tkazib yuborildi.",
        }

    def _cmd_reboot(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        response = self._request_camera(
            target_device_id,
            state,
            "PUT",
            "/ISAPI/System/reboot",
            params,
        )
        if not response.get("ok"):
            return {
                "ok": False,
                "error": response.get("error") or "Reboot buyrug'i yuborilmadi",
                "transport": response.get("transport"),
                "status_code": response.get("status_code"),
                "sdk_error": response.get("sdk_error"),
            }
        return {
            "ok": True,
            "transport": response.get("transport"),
            "status_code": response.get("status_code"),
            "message": "Reboot buyrug'i kameraga yuborildi.",
        }

    def _cmd_open_door(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        door_no = max(1, self._safe_int(params.get("door_no"), 1))
        payload = {"RemoteControlDoor": {"cmd": "open"}}

        response = self._request_camera(
            target_device_id,
            state,
            "PUT",
            f"/ISAPI/AccessControl/RemoteControl/door/{door_no}",
            params,
            json_body=payload,
        )
        if not response.get("ok"):
            response = self._request_camera(
                target_device_id,
                state,
                "POST",
                f"/ISAPI/AccessControl/RemoteControl/door/{door_no}",
                params,
                json_body=payload,
            )
        if not response.get("ok"):
            return {
                "ok": False,
                "error": response.get("error") or "Eshikni ochish buyrug'i bajarilmadi",
                "transport": response.get("transport"),
                "status_code": response.get("status_code"),
                "sdk_error": response.get("sdk_error"),
            }
        return {
            "ok": True,
            "transport": response.get("transport"),
            "status_code": response.get("status_code"),
            "door_no": door_no,
            "message": f"Eshik {door_no} uchun open buyrug'i yuborildi.",
        }

    def _cmd_raw_isapi(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        """ISAPI orqali har qanday yo'lga raw so'rov yuboradi (GET/PUT/POST)."""
        command = str(params.get("command") or params.get("_command") or "raw_get").lower()
        method = "GET"
        if "put" in command:
            method = "PUT"
        elif "post" in command:
            method = "POST"
        method = str(params.get("method") or method).upper()
        path = str(params.get("path") or params.get("url") or "").strip()
        body = params.get("body") or params.get("data")
        if not path:
            return {"ok": False, "error": "path parametri kerak"}
        login_id = state.login_id
        if login_id is None:
            return {"ok": False, "error": "login_id mavjud emas"}
        resp = self.runtime.isapi_passthrough(
            login_id=login_id,
            method=method,
            request_path=path,
            body=body.encode("utf-8") if isinstance(body, str) else body,
        )
        return {
            "ok": True,
            "path": path,
            "method": method,
            "response": resp.get("text", ""),
            "transport": "isup_sdk_ptxml",
            "message": f"ISAPI {method} {path} bajarildi.",
        }

    def _cmd_set_alarm_server(self, target_device_id: str, state: DeviceState, params: dict[str, Any]) -> dict[str, Any]:
        """Kameraga EHome + HTTP event notification konfiguratsiyasini yozadi."""
        login_id = state.login_id
        if login_id is None:
            return {"ok": False, "error": "login_id mavjud emas"}
        try:
            if params.get("public_web_base_url"):
                custom_base = str(params.get("public_web_base_url") or "").strip()
                if normalize_public_web_base_url is not None:
                    custom_base = normalize_public_web_base_url(custom_base)
                if custom_base:
                    self.runtime.public_web_base_url = custom_base
            if params.get("host"):
                custom_host = str(params.get("host") or "").strip()
                if normalize_isup_public_host is not None:
                    custom_host = normalize_isup_public_host(custom_host)
                if custom_host:
                    self.runtime.public_host = custom_host
            if params.get("port"):
                self.runtime.alarm_port = int(params.get("port") or self.runtime.alarm_port or 7661)

            resp = self.runtime.push_event_notification_config(login_id)
            response_text = str(resp.get("text") or "")
            if not resp.get("ok"):
                reason = str(resp.get("error") or "Event notification konfiguratsiyasi yozilmadi").strip()
                return {
                    "ok": False,
                    "host": self.runtime.public_host,
                    "port": self.runtime.alarm_port,
                    "public_web_base_url": self.runtime.public_web_base_url or None,
                    "response": response_text[:300],
                    "steps": resp.get("steps"),
                    "transport": "isup_sdk_ptxml",
                    "error": reason,
                    "message": "Event notification konfiguratsiyasi kameraga yozilmadi.",
                }
            return {
                "ok": True,
                "host": self.runtime.public_host,
                "port": self.runtime.alarm_port,
                "public_web_base_url": self.runtime.public_web_base_url or None,
                "response": response_text[:300],
                "steps": resp.get("steps"),
                "transport": "isup_sdk_ptxml",
                "message": f"EHome alarm {self.runtime.public_host}:{self.runtime.alarm_port} va webhook fallback yangilandi.",
            }
        except Exception as exc:
            return {"ok": False, "error": str(exc)}

    def _dispatch(self, target_device_id: str, raw_data: Any) -> dict[str, Any]:
        command_raw, params, request_id = self._parse_command(raw_data)
        command = command_raw.strip().lower()
        if command == "restart":
            command = "reboot"

        state = self.runtime.registry.find(target_device_id)

        if state is None:
            payload: dict[str, Any] = {
                "ok": False,
                "error": "Device not connected",
                "device_id": target_device_id,
                "command": command,
                "ts": int(time.time()),
            }
            if request_id:
                payload["request_id"] = request_id
            return payload

        if not state.online:
            payload = {
                "ok": False,
                "error": "Device offline",
                "device_id": state.device_id,
                "command": command,
                "ts": int(time.time()),
            }
            if request_id:
                payload["request_id"] = request_id
            return payload

        payload = {
            "ok": True,
            "result": "ACK",
            "device_id": state.device_id,
            "command": command,
            "camera_ip": state.ip,
            "camera_port": state.port,
            "model": state.model,
            "firmware": state.firmware,
            "isup_version": state.isup_version,
            "online": state.online,
            "source": "hikvision_sdk_bridge",
            "ts": int(time.time()),
        }
        if request_id:
            payload["request_id"] = request_id

        handlers = {
            "ping": self._cmd_ping,
            "check_connection": self._cmd_ping,
            "get_info": self._cmd_get_info,
            "get_device_snapshot": self._cmd_get_device_snapshot,
            "get_face_count": self._cmd_get_face_count,
            "get_users": self._cmd_get_users,
            "get_attendance_events": self._cmd_get_attendance_events,
            "get_face_records": self._cmd_get_face_records,
            "sync_faces": self._cmd_sync_faces,
            "add_user": self._cmd_add_user,
            "delete_user": self._cmd_delete_user,
            "set_face": self._cmd_set_face,
            "reboot": self._cmd_reboot,
            "open_door": self._cmd_open_door,
            "raw_get": self._cmd_raw_isapi,
            "raw_put": self._cmd_raw_isapi,
            "raw_post": self._cmd_raw_isapi,
            "set_alarm_server": self._cmd_set_alarm_server,
        }

        handler = handlers.get(command)
        if handler is None:
            payload.update(
                {
                    "ok": False,
                    "result": "ERROR",
                    "error": f"'{command}' buyrug'i hali joriy qilinmagan",
                    "message": f"'{command}' buyrug'i qo'llab-quvvatlanmaydi.",
                }
            )
            return payload

        try:
            if isinstance(params, dict):
                params.setdefault("_command", command)
            result = handler(target_device_id, state, params)
        except Exception as exc:
            payload.update(
                {
                    "ok": False,
                    "result": "ERROR",
                    "error": str(exc),
                    "message": f"Buyruq bajarishda kutilmagan xatolik: {exc}",
                }
            )
            return payload

        if isinstance(result, dict):
            payload.update(result)

        payload["model"] = state.model
        payload["firmware"] = state.firmware
        payload["camera_ip"] = state.ip
        payload["camera_port"] = state.port

        if payload.get("ok"):
            if payload.get("result") == "ACK":
                payload["result"] = "OK"
        else:
            payload["result"] = "ERROR"
        return payload


class HikvisionSdkRuntime:
    def __init__(
        self,
        *,
        isup_key: str,
        register_port: int,
        alarm_port: int,
        picture_port: int,
        api_port: int,
        redis_host: str,
        redis_port: int,
        sdk_dir: Path,
        public_host: str,
        public_web_base_url: str,
        picture_dir: Path,
    ) -> None:
        self.isup_key = isup_key
        self.register_port = int(register_port)
        self.alarm_port = int(alarm_port)
        self.picture_port = int(picture_port)
        self.api_port = int(api_port)
        self.redis_host = redis_host
        self.redis_port = int(redis_port)
        self.sdk_dir = sdk_dir
        self.public_host = public_host
        self.public_web_base_url = public_web_base_url
        self.picture_dir = picture_dir
        self.registry = DeviceRegistry()
        self.command_bridge = RedisCommandBridge(self, self.redis_host, self.redis_port)

        self._cms = None
        self._alarm = None
        self._ss = None

        self._cms_handle: Optional[int] = None
        self._alarm_handle: Optional[int] = None
        self._ss_handle: Optional[int] = None

        self._dll_dirs: list[Any] = []
        self._init_cfg_refs: list[Any] = []

        # Snapshot correlation: log_id → inserted alarm id pending snapshot upload
        import threading as _threading
        self._snap_pending: list[tuple[int, float]] = []  # [(log_id, insert_time), ...]
        self._snap_lock = _threading.Lock()

        # Keep callback references to avoid GC.
        self._cms_cb = DEVICE_REGISTER_CB(self._on_device_register)
        self._alarm_cb = EHOME_MSG_CB(self._on_alarm_message)
        self._ss_storage_cb = EHOME_SS_STORAGE_CB(self._on_ss_storage)
        self._ss_msg_cb = EHOME_SS_MSG_CB(self._on_ss_msg)
        self._ss_rw_cb = EHOME_SS_RW_CB(self._on_ss_rw)

    @staticmethod
    def _notification_error_reason(response_text: str) -> Optional[str]:
        text = str(response_text or "").strip()
        if not text:
            return None
        try:
            root = ET.fromstring(text)
        except Exception:
            lowered = text.lower()
            if "invalidcontent" in lowered:
                return "subStatusCode=invalidContent"
            return None

        fields: dict[str, str] = {}
        for elem in root.iter():
            tag = elem.tag.rsplit("}", 1)[-1]
            if tag in {"statusCode", "statusString", "subStatusCode", "errorMsg"} and tag not in fields:
                value = (elem.text or "").strip()
                if value:
                    fields[tag] = value

        code_text = fields.get("statusCode")
        if code_text:
            try:
                status_code = int(code_text)
            except Exception:
                status_code = -1
            if status_code not in {0, 1}:
                details = [f"statusCode={status_code}"]
                sub_status = fields.get("subStatusCode")
                error_msg = fields.get("errorMsg")
                if sub_status:
                    details.append(f"subStatusCode={sub_status}")
                if error_msg:
                    details.append(f"errorMsg={error_msg}")
                return ", ".join(details)

        sub_status = str(fields.get("subStatusCode") or "").strip()
        if sub_status and sub_status.lower() not in {"ok", "success", "completed"}:
            return f"subStatusCode={sub_status}"
        return None

    def _build_ehome_notification_xml(self) -> str:
        return (
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
            "<HttpHostNotification version=\"2.0\" xmlns=\"http://www.isapi.org/ver20/XMLSchema\">"
            "<id>1</id>"
            "<url></url>"
            "<protocolType>EHome</protocolType>"
            "<parameterFormatType>XML</parameterFormatType>"
            "<addressingFormatType>ipaddress</addressingFormatType>"
            f"<ipAddress>{self.public_host}</ipAddress>"
            f"<portNo>{self.alarm_port}</portNo>"
            "<httpAuthenticationMethod>none</httpAuthenticationMethod>"
            "</HttpHostNotification>"
        )

    def _build_webhook_notification_xml(self) -> tuple[Optional[str], Optional[str]]:
        public_base = str(self.public_web_base_url or "").strip().rstrip("/")
        if not public_base:
            return None, None

        parsed = urlsplit(public_base)
        host = (parsed.hostname or "").strip()
        if not host:
            return None, None

        scheme = (parsed.scheme or "https").lower()
        protocol = "HTTP" if scheme == "http" else "HTTPS"
        port = parsed.port or (443 if protocol == "HTTPS" else 80)
        webhook_url = f"{public_base}/api/hik-event"
        xml_body = (
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
            "<HttpHostNotification version=\"2.0\" xmlns=\"http://www.isapi.org/ver20/XMLSchema\">"
            "<id>2</id>"
            f"<url>{webhook_url}</url>"
            f"<protocolType>{protocol}</protocolType>"
            "<parameterFormatType>JSON</parameterFormatType>"
            "<addressingFormatType>hostname</addressingFormatType>"
            f"<hostName>{host}</hostName>"
            f"<portNo>{port}</portNo>"
            "<httpAuthenticationMethod>none</httpAuthenticationMethod>"
            "<SubscribeEvent>"
            "<heartbeat>30</heartbeat>"
            "<eventMode>all</eventMode>"
            "</SubscribeEvent>"
            "</HttpHostNotification>"
        )
        return xml_body, webhook_url

    def push_event_notification_config(self, login_id: int) -> dict[str, Any]:
        steps: list[dict[str, Any]] = []

        ehome_resp = self.isapi_passthrough(
            login_id=login_id,
            method="PUT",
            request_path="/ISAPI/Event/notification/httpHosts/1",
            body=self._build_ehome_notification_xml().encode("utf-8"),
        )
        ehome_text = str(ehome_resp.get("text") or "")
        ehome_error = self._notification_error_reason(ehome_text)
        steps.append(
            {
                "name": "ehome",
                "path": "/ISAPI/Event/notification/httpHosts/1",
                "ok": ehome_error is None,
                "error": ehome_error,
                "response": ehome_text[:400],
            }
        )
        if ehome_error:
            return {
                "ok": False,
                "error": ehome_error,
                "text": ehome_text,
                "steps": steps,
            }

        webhook_xml, webhook_url = self._build_webhook_notification_xml()
        if webhook_xml:
            webhook_resp = self.isapi_passthrough(
                login_id=login_id,
                method="PUT",
                request_path="/ISAPI/Event/notification/httpHosts/2",
                body=webhook_xml.encode("utf-8"),
            )
            webhook_text = str(webhook_resp.get("text") or "")
            webhook_error = self._notification_error_reason(webhook_text)
            steps.append(
                {
                    "name": "webhook",
                    "path": "/ISAPI/Event/notification/httpHosts/2",
                    "ok": webhook_error is None,
                    "error": webhook_error,
                    "response": webhook_text[:400],
                    "url": webhook_url,
                }
            )
            if webhook_error:
                return {
                    "ok": False,
                    "error": webhook_error,
                    "text": webhook_text,
                    "steps": steps,
                    "webhook_url": webhook_url,
                }
        else:
            steps.append(
                {
                    "name": "webhook",
                    "path": "/ISAPI/Event/notification/httpHosts/2",
                    "ok": True,
                    "skipped": True,
                    "response": "PUBLIC_WEB_BASE_URL sozlanmagan",
                }
            )

        summary = "; ".join(
            (
                f"{step['name']}={'ok' if step.get('ok') else step.get('error') or 'error'}"
                + (f" ({step.get('url')})" if step.get("url") else "")
            )
            for step in steps
        )
        return {
            "ok": True,
            "text": summary,
            "steps": steps,
            "webhook_url": webhook_url,
        }

    def _load_dlls(self) -> None:
        if not self.sdk_dir.exists():
            raise FileNotFoundError(f"SDK papkasi topilmadi: {self.sdk_dir}")

        if hasattr(os, "add_dll_directory"):
            self._dll_dirs.append(os.add_dll_directory(str(self.sdk_dir)))
            hcaap = self.sdk_dir / "HCAapSDKCom"
            if hcaap.exists():
                self._dll_dirs.append(os.add_dll_directory(str(hcaap)))

        os.chdir(self.sdk_dir)

        self._cms = ctypes.WinDLL(str(self.sdk_dir / "HCISUPCMS.dll"))
        self._alarm = ctypes.WinDLL(str(self.sdk_dir / "HCISUPAlarm.dll"))
        self._ss = ctypes.WinDLL(str(self.sdk_dir / "HCISUPSS.dll"))

        self._configure_signatures()
        self._configure_sdk_init_cfg()

    def _configure_signatures(self) -> None:
        self._cms.NET_ECMS_Init.restype = BOOL
        self._cms.NET_ECMS_Fini.restype = BOOL
        self._cms.NET_ECMS_GetLastError.restype = DWORD
        self._cms.NET_ECMS_SetSDKInitCfg.argtypes = [LONG, ctypes.c_void_p]
        self._cms.NET_ECMS_SetSDKInitCfg.restype = BOOL
        self._cms.NET_ECMS_StartListen.argtypes = [ctypes.POINTER(NET_EHOME_CMS_LISTEN_PARAM)]
        self._cms.NET_ECMS_StartListen.restype = LONG
        self._cms.NET_ECMS_StopListen.argtypes = [LONG]
        self._cms.NET_ECMS_StopListen.restype = BOOL
        self._cms.NET_ECMS_ForceLogout.argtypes = [LONG]
        self._cms.NET_ECMS_ForceLogout.restype = BOOL
        self._cms.NET_ECMS_SetDeviceSessionKey.argtypes = [ctypes.POINTER(NET_EHOME_DEV_SESSIONKEY)]
        self._cms.NET_ECMS_SetDeviceSessionKey.restype = BOOL
        self._cms.NET_ECMS_GetPTXMLConfig.argtypes = [LONG, ctypes.c_void_p]
        self._cms.NET_ECMS_GetPTXMLConfig.restype = BOOL
        self._cms.NET_ECMS_PutPTXMLConfig.argtypes = [LONG, ctypes.c_void_p]
        self._cms.NET_ECMS_PutPTXMLConfig.restype = BOOL
        self._cms.NET_ECMS_PostPTXMLConfig.argtypes = [LONG, ctypes.c_void_p]
        self._cms.NET_ECMS_PostPTXMLConfig.restype = BOOL
        self._cms.NET_ECMS_DeletePTXMLConfig.argtypes = [LONG, ctypes.c_void_p]
        self._cms.NET_ECMS_DeletePTXMLConfig.restype = BOOL
        self._cms.NET_ECMS_ISAPIPassThrough.argtypes = [LONG, ctypes.c_void_p]
        self._cms.NET_ECMS_ISAPIPassThrough.restype = BOOL

        self._alarm.NET_EALARM_Init.restype = BOOL
        self._alarm.NET_EALARM_Fini.restype = BOOL
        self._alarm.NET_EALARM_GetLastError.restype = DWORD
        self._alarm.NET_EALARM_SetSDKInitCfg.argtypes = [LONG, ctypes.c_void_p]
        self._alarm.NET_EALARM_SetSDKInitCfg.restype = BOOL
        self._alarm.NET_EALARM_StartListen.argtypes = [ctypes.POINTER(NET_EHOME_ALARM_LISTEN_PARAM)]
        self._alarm.NET_EALARM_StartListen.restype = LONG
        self._alarm.NET_EALARM_StopListen.argtypes = [LONG]
        self._alarm.NET_EALARM_StopListen.restype = BOOL
        self._alarm.NET_EALARM_SetDeviceSessionKey.argtypes = [ctypes.POINTER(NET_EHOME_DEV_SESSIONKEY)]
        self._alarm.NET_EALARM_SetDeviceSessionKey.restype = BOOL

        self._ss.NET_ESS_Init.restype = BOOL
        self._ss.NET_ESS_Fini.restype = BOOL
        self._ss.NET_ESS_GetLastError.restype = DWORD
        self._ss.NET_ESS_SetSDKInitCfg.argtypes = [LONG, ctypes.c_void_p]
        self._ss.NET_ESS_SetSDKInitCfg.restype = BOOL
        self._ss.NET_ESS_StartListen.argtypes = [ctypes.POINTER(NET_EHOME_SS_LISTEN_PARAM)]
        self._ss.NET_ESS_StartListen.restype = LONG
        self._ss.NET_ESS_StopListen.argtypes = [LONG]
        self._ss.NET_ESS_StopListen.restype = BOOL

    def _ansi_buffer(self, text: str) -> ctypes.Array:
        encoded = text.encode("mbcs", errors="ignore")
        return ctypes.create_string_buffer(encoded + b"\x00")

    def _configure_sdk_init_cfg(self) -> None:
        libeay_path = str((self.sdk_dir / "libeay32.dll").resolve())
        ssleay_path = str((self.sdk_dir / "ssleay32.dll").resolve())

        cms_libeay = self._ansi_buffer(libeay_path)
        cms_ssleay = self._ansi_buffer(ssleay_path)
        alarm_libeay = self._ansi_buffer(libeay_path)
        alarm_ssleay = self._ansi_buffer(ssleay_path)
        ss_libeay = self._ansi_buffer(libeay_path)
        ss_ssleay = self._ansi_buffer(ssleay_path)

        ss_sdk_path = NET_EHOME_SS_LOCAL_SDK_PATH()
        sdk_path = str(self.sdk_dir.resolve()) + os.sep
        sdk_path_bytes = sdk_path.encode("mbcs", errors="ignore")[: MAX_PATH_LEN - 1]
        ss_sdk_path.sPath = sdk_path_bytes + b"\x00"

        self._init_cfg_refs.extend(
            [
                cms_libeay,
                cms_ssleay,
                alarm_libeay,
                alarm_ssleay,
                ss_libeay,
                ss_ssleay,
                ss_sdk_path,
            ]
        )

        self._ensure_ok(
            bool(self._cms.NET_ECMS_SetSDKInitCfg(CMS_INIT_CFG_LIBEAY_PATH, ctypes.byref(cms_libeay))),
            self._cms,
            "NET_ECMS_GetLastError",
            "NET_ECMS_SetSDKInitCfg(libeay)",
        )
        self._ensure_ok(
            bool(self._cms.NET_ECMS_SetSDKInitCfg(CMS_INIT_CFG_SSLEAY_PATH, ctypes.byref(cms_ssleay))),
            self._cms,
            "NET_ECMS_GetLastError",
            "NET_ECMS_SetSDKInitCfg(ssleay)",
        )
        self._ensure_ok(
            bool(self._alarm.NET_EALARM_SetSDKInitCfg(ALARM_INIT_CFG_LIBEAY_PATH, ctypes.byref(alarm_libeay))),
            self._alarm,
            "NET_EALARM_GetLastError",
            "NET_EALARM_SetSDKInitCfg(libeay)",
        )
        self._ensure_ok(
            bool(self._alarm.NET_EALARM_SetSDKInitCfg(ALARM_INIT_CFG_SSLEAY_PATH, ctypes.byref(alarm_ssleay))),
            self._alarm,
            "NET_EALARM_GetLastError",
            "NET_EALARM_SetSDKInitCfg(ssleay)",
        )
        self._ensure_ok(
            bool(self._ss.NET_ESS_SetSDKInitCfg(SS_INIT_CFG_SDK_PATH, ctypes.byref(ss_sdk_path))),
            self._ss,
            "NET_ESS_GetLastError",
            "NET_ESS_SetSDKInitCfg(sdk_path)",
        )
        self._ensure_ok(
            bool(self._ss.NET_ESS_SetSDKInitCfg(SS_INIT_CFG_LIBEAY_PATH, ctypes.byref(ss_libeay))),
            self._ss,
            "NET_ESS_GetLastError",
            "NET_ESS_SetSDKInitCfg(libeay)",
        )
        self._ensure_ok(
            bool(self._ss.NET_ESS_SetSDKInitCfg(SS_INIT_CFG_SSLEAY_PATH, ctypes.byref(ss_ssleay))),
            self._ss,
            "NET_ESS_GetLastError",
            "NET_ESS_SetSDKInitCfg(ssleay)",
        )

    def _ensure_ok(self, ok: bool, dll_obj: Any, err_fn_name: str, action: str) -> None:
        if ok:
            return
        err_code = int(getattr(dll_obj, err_fn_name)())
        raise RuntimeError(f"{action} xatoligi (code={err_code})")

    def _ensure_handle(self, handle: int, dll_obj: Any, err_fn_name: str, action: str) -> None:
        if handle >= 0:
            return
        err_code = int(getattr(dll_obj, err_fn_name)())
        raise RuntimeError(f"{action} xatoligi (code={err_code})")

    def start(self) -> None:
        self.picture_dir.mkdir(parents=True, exist_ok=True)
        self._load_dlls()

        self._ensure_ok(bool(self._cms.NET_ECMS_Init()), self._cms, "NET_ECMS_GetLastError", "NET_ECMS_Init")
        self._ensure_ok(bool(self._alarm.NET_EALARM_Init()), self._alarm, "NET_EALARM_GetLastError", "NET_EALARM_Init")
        self._ensure_ok(bool(self._ss.NET_ESS_Init()), self._ss, "NET_ESS_GetLastError", "NET_ESS_Init")

        cms_param = NET_EHOME_CMS_LISTEN_PARAM()
        set_ip_address(cms_param.struAddress, "0.0.0.0", self.register_port)
        cms_param.fnCB = self._cms_cb
        cms_param.pUserData = None
        cms_param.dwKeepAliveSec = 15
        cms_param.dwTimeOutCount = 6
        self._cms_handle = int(self._cms.NET_ECMS_StartListen(ctypes.byref(cms_param)))
        self._ensure_handle(self._cms_handle, self._cms, "NET_ECMS_GetLastError", "NET_ECMS_StartListen")

        alarm_param = NET_EHOME_ALARM_LISTEN_PARAM()
        set_ip_address(alarm_param.struAddress, "0.0.0.0", self.alarm_port)
        alarm_param.fnMsgCb = self._alarm_cb
        alarm_param.pUserData = None
        alarm_param.byProtocolType = 0  # TCP
        alarm_param.byUseCmsPort = 0
        alarm_param.byUseThreadPool = 0
        alarm_param.dwKeepAliveSec = 30
        alarm_param.dwTimeOutCount = 3
        self._alarm_handle = int(self._alarm.NET_EALARM_StartListen(ctypes.byref(alarm_param)))
        self._ensure_handle(self._alarm_handle, self._alarm, "NET_EALARM_GetLastError", "NET_EALARM_StartListen")

        ss_param = NET_EHOME_SS_LISTEN_PARAM()
        set_ip_address(ss_param.struAddress, "0.0.0.0", self.picture_port)
        ss_param.fnSStorageCb = self._ss_storage_cb
        ss_param.fnSSMsgCb = self._ss_msg_cb
        ss_param.pUserData = None
        ss_param.byHttps = 0
        ss_param.fnSSRWCb = self._ss_rw_cb
        ss_param.fnSSRWCbEx = None
        ss_param.bySecurityMode = 0
        self._ss_handle = int(self._ss.NET_ESS_StartListen(ctypes.byref(ss_param)))
        self._ensure_handle(self._ss_handle, self._ss, "NET_ESS_GetLastError", "NET_ESS_StartListen")

        self.command_bridge.start()
        print(
            f"[ISUP SDK] listeners started: register={self.register_port}, "
            f"alarm={self.alarm_port}, picture={self.picture_port}, api={self.api_port}"
        )
        # Background thread: barcha online kameralarga alarm/picture server info yuboradi
        import threading as _thrd
        self._server_info_pusher = _thrd.Thread(
            target=self._periodic_server_info_push,
            daemon=True,
        )
        self._server_info_pusher.start()

    def _periodic_server_info_push(self) -> None:
        """
        Background thread: har 60 soniyada barcha online kameralarga
        EHome + HTTP fallback event notification konfiguratsiyasini yozadi.
        Bu ENUM_DEV_ON callback kelmasa ham ishlaydi.
        """
        import time as _time
        _time.sleep(8)  # Birinchi push ni biroz kechiktirish
        while True:
            try:
                for state in self.registry.all():
                    if not state.online or state.login_id is None:
                        continue
                    try:
                        self.push_event_notification_config(state.login_id)
                        print(
                            "[ISUP SDK] event notification pushed to "
                            f"{state.device_id}: ehome={self.public_host}:{self.alarm_port}, "
                            f"webhook={self.public_web_base_url or '-'}"
                        )
                    except Exception:
                        pass
            except Exception as exc:
                print(f"[ISUP SDK] periodic push xato: {exc}")
            _time.sleep(60)

    def stop(self) -> None:
        self.command_bridge.stop()

        try:
            if self._ss is not None and self._ss_handle is not None and self._ss_handle >= 0:
                self._ss.NET_ESS_StopListen(self._ss_handle)
        except Exception:
            pass
        finally:
            self._ss_handle = None

        try:
            if self._alarm is not None and self._alarm_handle is not None and self._alarm_handle >= 0:
                self._alarm.NET_EALARM_StopListen(self._alarm_handle)
        except Exception:
            pass
        finally:
            self._alarm_handle = None

        try:
            if self._cms is not None and self._cms_handle is not None and self._cms_handle >= 0:
                self._cms.NET_ECMS_StopListen(self._cms_handle)
        except Exception:
            pass
        finally:
            self._cms_handle = None

        try:
            if self._ss is not None:
                self._ss.NET_ESS_Fini()
        except Exception:
            pass
        try:
            if self._alarm is not None:
                self._alarm.NET_EALARM_Fini()
        except Exception:
            pass
        try:
            if self._cms is not None:
                self._cms.NET_ECMS_Fini()
        except Exception:
            pass

    def force_logout(self, device_id: str) -> bool:
        login_id = self.registry.login_id_for_device(device_id)
        if login_id is None:
            return self.registry.mark_offline(device_id)
        ok = bool(self._cms.NET_ECMS_ForceLogout(login_id))
        self.registry.mark_offline(device_id)
        return ok

    def isapi_passthrough(
        self,
        *,
        login_id: int,
        method: str,
        request_path: str,
        body: str | bytes | None = None,
        out_size: int = 1024 * 1024,
    ) -> dict[str, Any]:
        if self._cms is None:
            raise RuntimeError("HCISUPCMS hali yuklanmagan.")

        method_upper = (method or "").strip().upper()
        method_map = {
            "GET": self._cms.NET_ECMS_GetPTXMLConfig,
            "PUT": self._cms.NET_ECMS_PutPTXMLConfig,
            "POST": self._cms.NET_ECMS_PostPTXMLConfig,
            "DELETE": self._cms.NET_ECMS_DeletePTXMLConfig,
        }
        func = method_map.get(method_upper)
        if func is None:
            raise ValueError(f"PTXML method qo'llab-quvvatlanmaydi: {method_upper or method!r}")

        clean_path = (request_path or "").strip()
        if not clean_path:
            raise ValueError("ISAPI path bo'sh bo'lmasligi kerak.")
        if not clean_path.startswith("/"):
            clean_path = f"/{clean_path}"

        request_bytes = clean_path.encode("utf-8", errors="ignore")
        request_buffer = ctypes.create_string_buffer(request_bytes + b"\x00")

        body_bytes = b""
        input_buffer = None
        if body is not None:
            if isinstance(body, bytes):
                body_bytes = body
            else:
                body_bytes = str(body).encode("utf-8", errors="ignore")
            input_buffer = ctypes.create_string_buffer(body_bytes) if body_bytes else None

        safe_out_size = max(4096, min(int(out_size), 4 * 1024 * 1024))
        output_buffer = ctypes.create_string_buffer(safe_out_size)

        params = NET_EHOME_PTXML_PARAM()
        params.pRequestUrl = ctypes.cast(request_buffer, ctypes.c_void_p)
        params.dwRequestUrlLen = len(request_bytes)
        params.pCondBuffer = None
        params.dwCondSize = 0
        if input_buffer is not None:
            params.pInBuffer = ctypes.cast(input_buffer, ctypes.c_void_p)
            params.dwInSize = len(body_bytes)
        else:
            params.pInBuffer = None
            params.dwInSize = 0
        params.pOutBuffer = ctypes.cast(output_buffer, ctypes.c_void_p)
        params.dwOutSize = safe_out_size
        params.dwReturnedXMLLen = 0

        ok = bool(func(int(login_id), ctypes.byref(params)))
        if not ok:
            err_code = int(self._cms.NET_ECMS_GetLastError())
            raise RuntimeError(f"NET_ECMS_{method_upper}PTXML xatoligi (code={err_code})")

        returned_len = int(params.dwReturnedXMLLen)
        if returned_len <= 0 or returned_len > safe_out_size:
            returned_len = safe_out_size

        raw = ctypes.string_at(output_buffer, returned_len)
        # raw_bytes: to'liq binary ma'lumot (JPEG snapshot uchun kerak)
        # Null-term bo'lmasligi mumkin — faqat text uchun null-split qilamiz
        is_jpeg = raw[:2] == b"\xff\xd8"
        if is_jpeg:
            text = ""
            raw_bytes = raw
        else:
            text = raw.split(b"\x00", 1)[0].decode("utf-8", errors="ignore").strip()
            raw_bytes = raw if returned_len > 0 else b""
        return {
            "method": method_upper,
            "request_path": clean_path,
            "returned_len": returned_len,
            "text": text,
            "raw_bytes": raw_bytes,
        }

    def _on_device_register(
        self,
        user_id: int,
        data_type: int,
        p_out_buffer: int,
        out_len: int,
        p_in_buffer: int,
        in_len: int,
        p_user: int,
    ) -> bool:
        try:
            reg_info: Optional[NET_EHOME_DEV_REG_INFO_V12] = None
            if data_type in (
                ENUM_DEV_ON,
                ENUM_DEV_AUTH,
                ENUM_DEV_SESSIONKEY,
                ENUM_DEV_ADDRESS_CHANGED,
            ) and p_out_buffer:
                reg_info = ctypes.cast(
                    p_out_buffer,
                    ctypes.POINTER(NET_EHOME_DEV_REG_INFO_V12),
                ).contents

            if data_type == ENUM_DEV_AUTH:
                # EHome 5.0 auth callback: write ISUP key to input buffer.
                write_c_string(p_in_buffer, self.isup_key, 32)
                return True

            if data_type == ENUM_DEV_SESSIONKEY and reg_info is not None:
                self._sync_session_key(reg_info)
                # ISUP5.0 da ba'zan ENUM_DEV_ON kelmaydi — SESSIONKEY da ham server info yuboramiz
                if p_in_buffer:
                    try:
                        server_info = ctypes.cast(
                            p_in_buffer,
                            ctypes.POINTER(NET_EHOME_SERVER_INFO_V50),
                        ).contents
                        self._fill_server_info(server_info)
                    except Exception:
                        pass
                return True

            if data_type == ENUM_DEV_ON and reg_info is not None:
                state = self.registry.upsert_from_register(user_id, reg_info)
                self._sync_session_key(reg_info)
                if p_in_buffer:
                    server_info = ctypes.cast(
                        p_in_buffer,
                        ctypes.POINTER(NET_EHOME_SERVER_INFO_V50),
                    ).contents
                    self._fill_server_info(server_info)
                print(f"[ISUP SDK] device online: {state.device_id} ({state.ip}:{state.port})")
                return True

            if data_type == ENUM_DEV_OFF:
                self.registry.mark_offline_by_login(user_id)
                print(f"[ISUP SDK] device offline by login: {user_id}")
                return True

            if data_type == ENUM_DEV_DAS_REQ and p_in_buffer:
                # Return DAS redirect JSON for EHome 5.0 devices.
                port = self.register_port
                payload = (
                    f'{{"Type":"DAS","DasInfo":{{"Address":"{self.public_host}",'
                    f'"Domain":"bioface.local","ServerID":"das_{self.public_host}_{port}",'
                    f'"Port":{port},"UdpPort":{port}}}}}'
                )
                write_c_string(p_in_buffer, payload, 1024)
                return True

            if data_type == ENUM_DEV_ADDRESS_CHANGED and reg_info is not None:
                self.registry.upsert_from_register(user_id, reg_info)
                return True

            return True
        except Exception as exc:
            print(f"[ISUP SDK] register callback exception: {exc}")
            # Do not break device flow on callback errors.
            return True

    def _fill_server_info(self, info: NET_EHOME_SERVER_INFO_V50, *, device_state: Optional["DeviceState"] = None) -> None:
        info.dwSize = ctypes.sizeof(NET_EHOME_SERVER_INFO_V50)
        info.dwKeepAliveSec = 15
        info.dwTimeOutCount = 6
        info.dwNTPInterval = 3600
        info.dwAlarmKeepAliveSec = 15
        info.dwAlarmTimeOutCount = 5
        info.dwAlarmServerType = 0  # 0=TCP only (more reliable for face access controllers)
        info.dwPicServerType = 0    # 0=ISUP Storage Server (binary stream) / port 7662

        # Kameraga yuboradigan server IP: kamera shu IP orqali ulangan bo'lsa,
        # alarm va picture serverini ham shu local IP orqali ko'rsatamiz.
        # Bu boshqa tarmoqdagi kameralarga ham ishlaydi.
        server_ip = self._detect_server_bind_ip()
        print(f"[ISUP SDK] fill_server_info: alarm/picture host={server_ip}:{self.alarm_port}/{self.picture_port}")

        set_ip_address(info.struTCPAlarmSever, server_ip, self.alarm_port)
        set_ip_address(info.struUDPAlarmSever, server_ip, self.alarm_port)
        set_ip_address(info.struPictureSever, server_ip, self.picture_port)
        set_ip_address(info.struRedirectSever, server_ip, self.register_port)

    def _detect_server_bind_ip(self) -> str:
        """
        Kameraga yuboradigan server IP.
        pfSense/NAT arxitekturasida public_host (masalan 203.0.113.10) to'g'ri —
        chunki kamera ham 7661/7662 portlarini shu IP orqali ko'radi.
        """
        return self.public_host


    def _sync_session_key(self, reg_info: NET_EHOME_DEV_REG_INFO_V12) -> None:
        try:
            key = NET_EHOME_DEV_SESSIONKEY()
            key.sDeviceID[:] = reg_info.struRegInfo.byDeviceID
            key.sSessionKey[:] = reg_info.struRegInfo.bySessionKey
            self._cms.NET_ECMS_SetDeviceSessionKey(ctypes.byref(key))
            self._alarm.NET_EALARM_SetDeviceSessionKey(ctypes.byref(key))
        except Exception as exc:
            print(f"[ISUP SDK] set session key exception: {exc}")

    @staticmethod
    def _read_pointer_text(ptr: Any, length: int) -> str:
        try:
            if not ptr or int(length or 0) <= 0:
                return ""
            raw = ctypes.string_at(ptr, int(length))
            return raw.split(b"\x00", 1)[0].decode("utf-8", errors="ignore").strip()
        except Exception:
            return ""

    @staticmethod
    def _try_parse_json_text(text: str) -> Any:
        clean = (text or "").strip()
        if not clean or (not clean.startswith("{") and not clean.startswith("[")):
            return None
        try:
            return json.loads(clean)
        except Exception:
            return None

    @staticmethod
    def _find_first_value(data: Any, wanted_keys: set[str]) -> Optional[str]:
        stack: list[Any] = [data]
        normalized = {k.lower() for k in wanted_keys}
        while stack:
            cur = stack.pop()
            if isinstance(cur, dict):
                for key, value in cur.items():
                    if isinstance(key, str) and key.lower() in normalized:
                        if not isinstance(value, (dict, list)):
                            text = str(value).strip() if value is not None else ""
                            if text and text.lower() != "none":
                                return text
                    if isinstance(value, (dict, list)):
                        stack.append(value)
            elif isinstance(cur, list):
                stack.extend(cur)
        return None

    @staticmethod
    def _extract_alarm_xml_fields(text: str) -> dict[str, str]:
        if not text or "<" not in text:
            return {}
        try:
            root = ET.fromstring(text)
        except Exception:
            return {}

        result: dict[str, str] = {}
        wanted = {
            "employeeNo",
            "personID",
            "personId",
            "employeeID",
            "employeeId",
            "name",
            "personName",
            "employeeName",
            "serialNo",
            "serialNumber",
            "deviceID",
            "deviceId",
            "devIndex",
            "macAddress",
            "mac",
            "ipAddress",
            "eventTime",
            "dateTime",
            "time",
            "snapshotUrl",
            "snapshotURL",
            "faceURL",
            "pictureURL",
            "picUrl",
        }
        for elem in root.iter():
            tag = elem.tag.rsplit("}", 1)[-1]
            if tag not in wanted:
                continue
            value = (elem.text or "").strip()
            if value and tag not in result:
                result[tag] = value
        return result

    @staticmethod
    def _parse_alarm_timestamp(value: Optional[str]) -> datetime:
        text = str(value or "").strip()
        if not text:
            return utc_now().replace(tzinfo=None)

        normalized = text.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(normalized)
            if dt.tzinfo is not None:
                return dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except Exception:
            pass

        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y%m%d%H%M%S"):
            try:
                return datetime.strptime(text, fmt)
            except Exception:
                continue
        return utc_now().replace(tzinfo=None)

    def _db_connect(self) -> sqlite3.Connection:
        db_path = (Path(__file__).resolve().parent / "bioface.db").resolve()
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _state_by_serial(self, serial: str) -> Optional[DeviceState]:
        serial_key = str(serial or "").strip().lower()
        if not serial_key:
            return None
        for state in self.registry.all():
            if str(state.serial or "").strip().lower() == serial_key:
                return state
        return None

    def _on_alarm_message(self, handle: int, alarm_msg_ptr: Any, p_user: int) -> bool:
        try:
            if not alarm_msg_ptr:
                return True
            self.registry.bump_alarm()
            alarm_msg = alarm_msg_ptr.contents
            serial = decode_bytes(bytes(alarm_msg.sSerialNumber)).strip()

            xml_text = self._read_pointer_text(alarm_msg.pXmlBuf, int(alarm_msg.dwXmlBufLen))
            alarm_info_text = self._read_pointer_text(alarm_msg.pAlarmInfo, int(alarm_msg.dwAlarmInfoLen))
            json_payload = self._try_parse_json_text(alarm_info_text) or self._try_parse_json_text(xml_text)
            xml_fields = self._extract_alarm_xml_fields(xml_text)

            person_id = (
                (json_payload and self._find_first_value(json_payload, {"employeeNo", "person_id", "personId", "employeeID", "employeeId"}))
                or xml_fields.get("employeeNo")
                or xml_fields.get("personID")
                or xml_fields.get("personId")
                or xml_fields.get("employeeID")
                or xml_fields.get("employeeId")
                or ""
            ).strip()
            person_name = (
                (json_payload and self._find_first_value(json_payload, {"name", "personName", "employeeName"}))
                or xml_fields.get("personName")
                or xml_fields.get("employeeName")
                or xml_fields.get("name")
                or ""
            ).strip()
            snapshot_url = (
                (json_payload and self._find_first_value(json_payload, {"snapshotUrl", "snapshot_url", "faceURL", "pictureURL", "picUrl"}))
                or xml_fields.get("snapshotUrl")
                or xml_fields.get("snapshotURL")
                or xml_fields.get("faceURL")
                or xml_fields.get("pictureURL")
                or xml_fields.get("picUrl")
                or None
            )

            # Alarm ichida base64 rasm bo'lsa — uni faylga yozamiz
            img_b64 = (
                (json_payload and self._find_first_value(json_payload, {"image", "imageBase64", "faceImage", "captureImage", "base64Image", "picture"}))
                or xml_fields.get("image")
                or xml_fields.get("imageBase64")
                or xml_fields.get("faceImage")
                or xml_fields.get("captureImage")
                or None
            )
            if img_b64 and not snapshot_url:
                try:
                    import base64 as _b64
                    img_data = _b64.b64decode(img_b64.strip())
                    ts_str = utc_now().strftime("%Y%m%d_%H%M%S_%f")
                    img_name = f"alarm_{ts_str}.jpg"
                    img_path = self.picture_dir / img_name
                    img_path.write_bytes(img_data)
                    rel = img_path.relative_to(Path(__file__).resolve().parent)
                    snapshot_url = "/" + rel.as_posix()
                    print(f"[ISUP SDK] alarm embedded image saved: {snapshot_url}")
                except Exception as img_exc:
                    print(f"[ISUP SDK] embedded image decode xato: {img_exc}")

            event_time_text = (
                (json_payload and self._find_first_value(json_payload, {"eventTime", "dateTime", "timestamp", "time"}))
                or xml_fields.get("eventTime")
                or xml_fields.get("dateTime")
                or xml_fields.get("time")
                or None
            )
            event_time = self._parse_alarm_timestamp(event_time_text)
            event_time_sql = event_time.strftime("%Y-%m-%d %H:%M:%S")

            state = self.registry.find(serial) if serial else None
            if state is None and serial:
                state = self._state_by_serial(serial)

            device_candidates: list[str] = []
            for item in (
                serial,
                xml_fields.get("deviceID"),
                xml_fields.get("deviceId"),
                xml_fields.get("devIndex"),
                xml_fields.get("serialNo"),
                xml_fields.get("serialNumber"),
                json_payload and self._find_first_value(json_payload, {"deviceID", "deviceId", "device_id", "devIndex", "serialNo", "serialNumber"}),
                state.device_id if state else None,
                state.serial if state else None,
            ):
                text = str(item or "").strip()
                if text and text not in device_candidates:
                    device_candidates.append(text)

            camera_mac = (
                (json_payload and self._find_first_value(json_payload, {"camera_mac", "macAddress", "mac"}))
                or xml_fields.get("macAddress")
                or xml_fields.get("mac")
                or ""
            ).strip() or None

            with self._db_connect() as conn:
                device_row: Optional[sqlite3.Row] = None
                for key in device_candidates:
                    row = conn.execute(
                        """
                        SELECT id, name, mac_address, isup_device_id
                        FROM devices
                        WHERE lower(COALESCE(isup_device_id, '')) = lower(?)
                           OR lower(COALESCE(mac_address, '')) = lower(?)
                           OR lower(COALESCE(name, '')) = lower(?)
                        LIMIT 1
                        """,
                        (key, key, key),
                    ).fetchone()
                    if row is not None:
                        device_row = row
                        break

                if device_row is None and camera_mac:
                    device_row = conn.execute(
                        """
                        SELECT id, name, mac_address, isup_device_id
                        FROM devices
                        WHERE lower(COALESCE(mac_address, '')) = lower(?)
                        LIMIT 1
                        """,
                        (camera_mac,),
                    ).fetchone()

                employee_row: Optional[sqlite3.Row] = None
                if person_id:
                    employee_row = conn.execute(
                        """
                        SELECT id, first_name, last_name, personal_id
                        FROM employees
                        WHERE trim(COALESCE(personal_id, '')) = ?
                        LIMIT 1
                        """,
                        (person_id,),
                    ).fetchone()
                    if employee_row is None and person_id.isdigit():
                        employee_row = conn.execute(
                            """
                            SELECT id, first_name, last_name, personal_id
                            FROM employees
                            WHERE id = ?
                            LIMIT 1
                            """,
                            (int(person_id),),
                        ).fetchone()

                if employee_row is not None and not person_name:
                    first = str(employee_row["first_name"] or "").strip()
                    last = str(employee_row["last_name"] or "").strip()
                    person_name = f"{first} {last}".strip()

                device_id = int(device_row["id"]) if device_row is not None else None
                if device_row is not None and not camera_mac:
                    camera_mac = str(device_row["mac_address"] or "").strip() or None

                dedupe = conn.execute(
                    """
                    SELECT id
                    FROM attendance_logs
                    WHERE COALESCE(device_id, -1) = COALESCE(?, -1)
                      AND COALESCE(person_id, '') = COALESCE(?, '')
                      AND ABS(strftime('%s', timestamp) - strftime('%s', ?)) <= 8
                    ORDER BY id DESC
                    LIMIT 1
                    """,
                    (device_id, person_id or None, event_time_sql),
                ).fetchone()

                inserted_log_id: Optional[int] = None
                if dedupe is None:
                    status = "aniqlandi" if employee_row is not None else "noma'lum"
                    cur = conn.execute(
                        """
                        INSERT INTO attendance_logs
                        (employee_id, device_id, camera_mac, person_id, person_name, snapshot_url, timestamp, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            int(employee_row["id"]) if employee_row is not None else None,
                            device_id,
                            camera_mac,
                            person_id or None,
                            person_name or None,
                            snapshot_url,
                            event_time_sql,
                            status,
                        ),
                    )
                    inserted_log_id = cur.lastrowid

                if device_row is not None:
                    conn.execute(
                        """
                        UPDATE devices
                        SET is_online = 1, last_seen_at = ?
                        WHERE id = ?
                        """,
                        (utc_now().replace(tzinfo=None).isoformat(), int(device_row["id"])),
                    )

                conn.commit()

            # Snapshot correlation: if no snapshot in alarm, queue for SS upload
            if inserted_log_id and not snapshot_url:
                import time as _time
                with self._snap_lock:
                    self._snap_pending.append((inserted_log_id, _time.time()))
                # Agar state mavjud bo'lsa — ISAPI orqali async snapshot olishga urinib ko'ramiz
                if state is not None:
                    import threading as _thrd
                    _thrd.Thread(
                        target=self._fetch_device_snapshot_async,
                        args=(state.device_id, inserted_log_id),
                        daemon=True,
                    ).start()

            print(
                f"[ISUP SDK] alarm received: type={alarm_msg.dwAlarmType}, serial={serial or '-'}, "
                f"person_id={person_id or '-'}, snapshot={'yes' if snapshot_url else 'pending'}"
            )
            return True
        except Exception as exc:
            print(f"[ISUP SDK] alarm callback exception: {exc}")
            return True

    def _fetch_device_snapshot_async(self, device_id: str, log_id: int) -> None:
        """
        Background threadda kameradan ISUP SDK PTXML orqali snapshot olib attendance_log ni yangilaydi.
        ISUP PTXML — boshqa tarmoqdagi kameralarda ham ishlaydi (HTTP direct shart emas).
        DS-K1T343MX: /ISAPI/Streaming/channels/1/picture
        """
        import time as _time
        _time.sleep(1.5)  # Alarm kelgandan keyin kamera tayyorlansin

        try:
            state = self.registry.find(device_id)
            if state is None:
                print(f"[ISUP SDK] snapshot: state topilmadi ({device_id})")
                return

            # 1. ISUP SDK PTXML orqali snapshot (boshqa tarmoq safe)
            # out_size 4MB — JPEG uchun yetarli
            login_id = state.login_id
            if login_id is None:
                print(f"[ISUP SDK] snapshot: {device_id} login_id yo'q")
            else:
                for snap_path in (
                    "/ISAPI/Streaming/channels/1/picture",
                    "/ISAPI/Streaming/channels/101/picture",
                    "/ISAPI/Streaming/picture",
                ):
                    try:
                        sdk_result = self.isapi_passthrough(
                            login_id=login_id,
                            method="GET",
                            request_path=snap_path,
                            body=None,
                            out_size=4 * 1024 * 1024,
                        )
                        raw_bytes = sdk_result.get("raw_bytes") or b""
                        if len(raw_bytes) >= 1000 and raw_bytes[:2] == b"\xff\xd8":
                            ts_str = utc_now().strftime("%Y%m%d_%H%M%S_%f")
                            img_name = f"snap_{device_id}_{ts_str}.jpg"
                            img_path = self.picture_dir / img_name
                            img_path.write_bytes(raw_bytes)
                            rel = img_path.relative_to(Path(__file__).resolve().parent)
                            snap_url = "/" + rel.as_posix()
                            with self._db_connect() as conn:
                                conn.execute(
                                    "UPDATE attendance_logs SET snapshot_url=? WHERE id=? AND (snapshot_url IS NULL OR snapshot_url='')",
                                    (snap_url, log_id)
                                )
                                conn.commit()
                            self.registry.bump_picture()
                            print(f"[ISUP SDK] PTXML snapshot OK: log_id={log_id}, path={snap_path}, url={snap_url}")
                            return
                        else:
                            text_resp = sdk_result.get("text") or ""
                            print(f"[ISUP SDK] PTXML snapshot: '{snap_path}' rasm kelmadi ({device_id}): {text_resp[:120]}")
                    except Exception as ptxml_exc:
                        print(f"[ISUP SDK] PTXML snapshot xato '{snap_path}' ({device_id}): {ptxml_exc}")

            # 2. Fallback: bir tarmoqdagi kameralar uchun HTTP direct
            try:
                device_ip = state.ip
                if not device_ip or device_ip in ("0.0.0.0", "127.0.0.1", ""):
                    return
                with self._db_connect() as conn:
                    row = conn.execute(
                        "SELECT username, password FROM devices WHERE isup_device_id=? OR mac_address=? LIMIT 1",
                        (device_id, device_id)
                    ).fetchone()
                cam_user = (row["username"] if row else None) or "admin"
                cam_pass = (row["password"] if row else None) or "Hikvision"
                import urllib.request as _req
                import base64 as _b64
                url = f"http://{device_ip}:80/ISAPI/Streaming/channels/1/picture"
                credentials = _b64.b64encode(f"{cam_user}:{cam_pass}".encode()).decode()
                req = _req.Request(url)
                req.add_header("Authorization", f"Basic {credentials}")
                req.add_header("User-Agent", "BioFace/1.0")
                with _req.urlopen(req, timeout=4) as resp:
                    img_data = resp.read()
                    if len(img_data) >= 1000 and img_data[:2] == b"\xff\xd8":
                        ts_str = utc_now().strftime("%Y%m%d_%H%M%S_%f")
                        img_name = f"snap_{device_id}_{ts_str}.jpg"
                        img_path = self.picture_dir / img_name
                        img_path.write_bytes(img_data)
                        rel = img_path.relative_to(Path(__file__).resolve().parent)
                        snap_url = "/" + rel.as_posix()
                        with self._db_connect() as conn:
                            conn.execute(
                                "UPDATE attendance_logs SET snapshot_url=? WHERE id=? AND (snapshot_url IS NULL OR snapshot_url='')",
                                (snap_url, log_id)
                            )
                            conn.commit()
                        self.registry.bump_picture()
                        print(f"[ISUP SDK] HTTP fallback snapshot OK: log_id={log_id}, url={snap_url}")
            except Exception as http_exc:
                print(f"[ISUP SDK] HTTP fallback snapshot ham ishlamadi ({device_id}): {http_exc}")
        except Exception as exc:
            print(f"[ISUP SDK] _fetch_device_snapshot_async xato: {exc}")


    def _on_ss_storage(
        self,
        handle: int,
        p_file_name: bytes | None,
        p_file_buf: int,
        dw_file_len: int,
        p_file_path: int,
        p_user: int,
    ) -> bool:
        try:
            raw_name = p_file_name.decode("utf-8", errors="ignore") if p_file_name else ""
            safe_name = Path(raw_name).name if raw_name else ""
            if not safe_name:
                safe_name = f"snapshot_{int(utc_now().timestamp())}.jpg"

            out_name = f"{utc_now().strftime('%Y%m%d_%H%M%S_%f')}_{safe_name}"
            out_path = self.picture_dir / out_name

            if p_file_buf and dw_file_len > 0:
                data = ctypes.string_at(p_file_buf, int(dw_file_len))
                out_path.write_bytes(data)

            write_c_string(p_file_path, str(out_path), 259)
            self.registry.bump_picture()
            print(f"[ISUP SDK] picture saved: {out_path}")

            # Snapshot URL (HTTP path relative to static)
            rel = out_path.relative_to(Path(__file__).resolve().parent)
            url_path = "/" + rel.as_posix()

            # Link this snapshot to the most recent pending alarm log (within 15s)
            import time as _time
            now_t = _time.time()
            with self._snap_lock:
                # Remove stale entries (older than 15 seconds)
                self._snap_pending = [(lid, t) for lid, t in self._snap_pending if now_t - t <= 15]
                if self._snap_pending:
                    # Take the most recent pending alarm
                    log_id, _ = self._snap_pending.pop()  # last = most recent
                else:
                    log_id = None

            if log_id:
                try:
                    with self._db_connect() as conn:
                        conn.execute(
                            "UPDATE attendance_logs SET snapshot_url = ? WHERE id = ? AND (snapshot_url IS NULL OR snapshot_url = '')",
                            (url_path, log_id),
                        )
                        conn.commit()
                    print(f"[ISUP SDK] snapshot linked to log_id={log_id}: {url_path}")
                except Exception as db_exc:
                    print(f"[ISUP SDK] snapshot DB update error: {db_exc}")

            return True
        except Exception as exc:
            print(f"[ISUP SDK] picture callback exception: {exc}")
            return False

    def _on_ss_msg(
        self,
        handle: int,
        enum_type: int,
        p_out_buffer: int,
        out_len: int,
        p_in_buffer: int,
        in_len: int,
        p_user: int,
    ) -> bool:
        # Optional SS message callback (Tomcat/KMS/Cloud), keep as pass-through.
        return True

    def _on_ss_rw(
        self,
        handle: int,
        by_act: int,
        p_file_name: bytes | None,
        p_file_buf: int,
        p_file_len: Any,
        p_file_url: bytes | None,
        p_user: int,
    ) -> bool:
        # Optional read/write callback, not used in this deployment.
        return True


def build_app(runtime: HikvisionSdkRuntime) -> FastAPI:
    app = FastAPI(title="BioFace Hikvision ISUP SDK Server", version="1.0.0")

    @app.on_event("shutdown")
    def _shutdown_runtime() -> None:
        runtime.stop()

    @app.get("/health")
    def health() -> dict[str, Any]:
        stats = runtime.registry.stats()
        redis_status = runtime.command_bridge.status()
        return {
            "status": "ok",
            "mode": "hikvision_sdk",
            "public_host": runtime.public_host,
            "public_web_base_url": runtime.public_web_base_url or None,
            "register_port": runtime.register_port,
            "alarm_port": runtime.alarm_port,
            "picture_port": runtime.picture_port,
            "devices": stats["device_count"],
            "online_devices": stats["online_devices"],
            "alarm_events": stats["alarm_events"],
            "pictures_saved": stats["pictures_saved"],
            "redis_bridge": redis_status,
            "checked_at": iso_utc(utc_now()),
        }

    @app.get("/devices")
    def list_devices() -> list[dict[str, Any]]:
        return [item.to_payload() for item in runtime.registry.all()]

    @app.get("/devices/{device_id}")
    def get_device(device_id: str) -> dict[str, Any]:
        state = runtime.registry.get(device_id)
        if not state:
            raise HTTPException(status_code=404, detail="ISUP qurilma topilmadi")
        return state.to_payload()

    @app.delete("/devices/{device_id}")
    def disconnect_device(device_id: str) -> dict[str, Any]:
        state = runtime.registry.get(device_id)
        if not state:
            raise HTTPException(status_code=404, detail="ISUP qurilma topilmadi")
        ok = runtime.force_logout(device_id)
        return {"result": "ok" if ok else "partial", "action": "disconnected", "device_id": device_id}

    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="BioFace Hikvision ISUP SDK server")
    parser.add_argument("isup_key", nargs="?", default="bioface2024")
    parser.add_argument("register_port", nargs="?", type=int, default=7660)
    parser.add_argument("api_port", nargs="?", type=int, default=7670)
    parser.add_argument("redis_host", nargs="?", default="127.0.0.1")
    parser.add_argument("redis_port", nargs="?", type=int, default=6379)
    parser.add_argument("alarm_port", nargs="?", type=int, default=7661)
    parser.add_argument("picture_port", nargs="?", type=int, default=7662)
    parser.add_argument("--sdk-dir", default=str(Path(__file__).resolve().parent / "hikvision_sdk"))
    parser.add_argument("--public-host", default=resolve_public_host_from_env())
    parser.add_argument("--public-web-base-url", default=resolve_public_web_base_url_from_env())
    parser.add_argument(
        "--picture-dir",
        default=str(Path(__file__).resolve().parent / "static" / "uploads" / "isup"),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    runtime = HikvisionSdkRuntime(
        isup_key=args.isup_key,
        register_port=args.register_port,
        alarm_port=args.alarm_port,
        picture_port=args.picture_port,
        api_port=args.api_port,
        redis_host=args.redis_host,
        redis_port=args.redis_port,
        sdk_dir=Path(args.sdk_dir).resolve(),
        public_host=args.public_host,
        public_web_base_url=args.public_web_base_url,
        picture_dir=Path(args.picture_dir).resolve(),
    )
    runtime.start()

    app = build_app(runtime)
    uvicorn.run(app, host="0.0.0.0", port=int(args.api_port), access_log=False)


if __name__ == "__main__":
    main()
