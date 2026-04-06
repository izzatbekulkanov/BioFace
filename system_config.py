import os
import socket
import ipaddress
import re
from pathlib import Path
from urllib.parse import urlsplit


BASE_DIR = Path(__file__).resolve().parent

BIOFACE_HOST = os.getenv("BIOFACE_HOST", "0.0.0.0")
BIOFACE_PORT = int(os.getenv("BIOFACE_PORT", "8000"))

ISUP_KEY = os.getenv("ISUP_KEY", "bioface2024")
ISUP_REGISTER_PORT = int(os.getenv("ISUP_REGISTER_PORT", "7660"))
ISUP_ALARM_PORT = int(os.getenv("ISUP_ALARM_PORT", "7661"))
ISUP_PICTURE_PORT = int(os.getenv("ISUP_PICTURE_PORT", "7662"))
ISUP_API_PORT = int(os.getenv("ISUP_API_PORT", "7670"))
INVALID_ISUP_PUBLIC_HOSTS = {"0.0.0.0", "::", "localhost", "127.0.0.1"}
INVALID_PUBLIC_WEB_HOSTS = {"0.0.0.0", "::", "localhost", "127.0.0.1"}
_HOSTNAME_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$")


def _detect_lan_ipv4() -> str:
    # Prefer active interface IP; fallback to hostname lookup.
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


def get_detected_lan_ipv4() -> str:
    return _detect_lan_ipv4()


def normalize_isup_public_host(value: str | None) -> str:
    candidate = (value or "").strip()
    if not candidate:
        return ""

    if "://" in candidate:
        candidate = candidate.split("://", 1)[1].strip()
    if "/" in candidate:
        candidate = candidate.split("/", 1)[0].strip()

    if candidate.startswith("[") and "]" in candidate:
        candidate = candidate[1 : candidate.index("]")]
    elif candidate.count(":") == 1 and candidate.rsplit(":", 1)[1].isdigit():
        candidate = candidate.rsplit(":", 1)[0].strip()

    if not candidate or candidate in INVALID_ISUP_PUBLIC_HOSTS:
        return ""

    try:
        ipaddress.ip_address(candidate)
        return candidate
    except ValueError:
        pass

    if (
        _HOSTNAME_RE.fullmatch(candidate)
        and ".." not in candidate
        and not candidate.startswith(".")
        and not candidate.endswith(".")
    ):
        return candidate

    return ""


def get_isup_public_host() -> str:
    # Priority: value saved from Settings page -> env -> auto LAN detect.
    try:
        from menu_utils import get_menu_data

        saved = normalize_isup_public_host(get_menu_data().get("isup_public_host"))
        if saved:
            return saved
    except Exception:
        pass

    configured = normalize_isup_public_host(os.getenv("ISUP_PUBLIC_HOST"))
    if configured:
        return configured

    return _detect_lan_ipv4()


def normalize_public_web_base_url(value: str | None) -> str:
    candidate = (value or "").strip().rstrip("/")
    if not candidate:
        return ""

    if "://" not in candidate:
        candidate = f"https://{candidate}"

    try:
        parsed = urlsplit(candidate)
    except Exception:
        return ""

    scheme = (parsed.scheme or "").strip().lower()
    host = (parsed.hostname or "").strip().lower()
    if scheme not in {"http", "https"} or not host:
        return ""
    if host in INVALID_PUBLIC_WEB_HOSTS:
        return ""

    netloc = parsed.netloc.strip()
    if not netloc:
        return ""
    return f"{scheme}://{netloc.rstrip('/')}"


def get_public_web_base_url() -> str:
    try:
        from menu_utils import get_menu_data

        saved = normalize_public_web_base_url(get_menu_data().get("public_web_base_url"))
        if saved:
            return saved
    except Exception:
        pass

    configured = normalize_public_web_base_url(os.getenv("PUBLIC_WEB_BASE_URL"))
    if configured:
        return configured

    return ""


# Backward-compatible constant for modules that still import static value.
ISUP_PUBLIC_HOST = get_isup_public_host()

REDIS_HOST = os.getenv("REDIS_HOST", "127.0.0.1")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

ISUP_BINARY_PATH = Path(
    os.getenv(
        "ISUP_BINARY_PATH",
        str(BASE_DIR / "isup_server" / "build" / "isup_server.exe"),
    )
)
ISUP_SDK_SERVER_SCRIPT = Path(
    os.getenv("ISUP_SDK_SERVER_SCRIPT", str(BASE_DIR / "isup_sdk_server.py"))
)
ISUP_RUNTIME_DIR = BASE_DIR / ".runtime"
ISUP_PID_FILE = ISUP_RUNTIME_DIR / "isup_server.pid"

ISUP_API_URL = os.getenv("ISUP_API_URL", f"http://127.0.0.1:{ISUP_API_PORT}")

# ISUP implementation mode:
# - "emulated": custom lightweight C++ server
# - "hikvision_sdk": requires official Hikvision EHome/ISUP SDK DLL package
_mode = os.getenv("ISUP_IMPLEMENTATION_MODE", "hikvision_sdk").strip().lower()
ISUP_IMPLEMENTATION_MODE = _mode if _mode in {"emulated", "hikvision_sdk"} else "emulated"
HIKVISION_SDK_DIR = Path(os.getenv("HIKVISION_SDK_DIR", str(BASE_DIR / "hikvision_sdk")))
