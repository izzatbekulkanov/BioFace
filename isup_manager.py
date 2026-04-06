import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import psutil

from hikvision_sdk import get_sdk_status
from system_config import (
    BIOFACE_HOST,
    BIOFACE_PORT,
    ISUP_ALARM_PORT,
    ISUP_API_PORT,
    ISUP_BINARY_PATH,
    ISUP_IMPLEMENTATION_MODE,
    ISUP_KEY,
    ISUP_PICTURE_PORT,
    ISUP_PID_FILE,
    ISUP_REGISTER_PORT,
    ISUP_SDK_SERVER_SCRIPT,
    REDIS_HOST,
    REDIS_PORT,
    get_isup_public_host,
)


def _ensure_runtime_dir() -> None:
    ISUP_PID_FILE.parent.mkdir(parents=True, exist_ok=True)


def _binary_candidates() -> list[Path]:
    if ISUP_IMPLEMENTATION_MODE == "hikvision_sdk":
        return [ISUP_SDK_SERVER_SCRIPT]

    candidates = [ISUP_BINARY_PATH]
    if ISUP_BINARY_PATH.suffix.lower() == ".exe":
        candidates.append(ISUP_BINARY_PATH.with_suffix(""))
    else:
        candidates.append(ISUP_BINARY_PATH.with_suffix(".exe"))
    return candidates


def get_binary_path() -> Path:
    for candidate in _binary_candidates():
        if candidate.exists():
            return candidate
    return ISUP_BINARY_PATH


def _read_pid() -> Optional[int]:
    try:
        return int(ISUP_PID_FILE.read_text(encoding="utf-8").strip())
    except Exception:
        return None


def _write_pid(pid: int) -> None:
    _ensure_runtime_dir()
    ISUP_PID_FILE.write_text(str(pid), encoding="utf-8")


def _clear_pid() -> None:
    try:
        ISUP_PID_FILE.unlink(missing_ok=True)
    except Exception:
        pass


def _matches_isup_process(proc: psutil.Process) -> bool:
    try:
        name = (proc.name() or "").lower()
        exe = (proc.exe() or "").lower()
        cmdline_parts = [part.lower() for part in (proc.cmdline() or [])]
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        return False

    if ISUP_IMPLEMENTATION_MODE == "hikvision_sdk":
        script_name = ISUP_SDK_SERVER_SCRIPT.name.lower()
        script_in_cmd = any(Path(part).name == script_name for part in cmdline_parts)
        return script_in_cmd

    binary_name = get_binary_path().name.lower()
    exe_name = Path(exe).name if exe else ""
    entrypoint = Path(cmdline_parts[0]).name if cmdline_parts else ""
    return (
        "isup_server" in name
        or exe_name == binary_name
        or entrypoint == binary_name
        or entrypoint == "isup_server"
    )


def _find_process_by_pid(pid: Optional[int]) -> Optional[psutil.Process]:
    if not pid:
        return None
    try:
        proc = psutil.Process(pid)
        if proc.is_running() and _matches_isup_process(proc):
            return proc
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        return None
    return None


def _find_running_process() -> Optional[psutil.Process]:
    proc = _find_process_by_pid(_read_pid())
    if proc:
        return proc

    for candidate in psutil.process_iter():
        if _matches_isup_process(candidate):
            _write_pid(candidate.pid)
            return candidate
    return None


def _get_listening_ports() -> dict[int, Optional[bool]]:
    ports = {
        BIOFACE_PORT: False,
        ISUP_REGISTER_PORT: False,
        ISUP_ALARM_PORT: False,
        ISUP_PICTURE_PORT: False,
        ISUP_API_PORT: False,
        REDIS_PORT: False,
    }

    try:
        for conn in psutil.net_connections(kind="tcp"):
            if conn.status != psutil.CONN_LISTEN or not conn.laddr:
                continue
            port = getattr(conn.laddr, "port", None)
            if port in ports:
                ports[port] = True
    except Exception:
        for port in ports:
            ports[port] = None

    return ports


def get_port_map() -> list[dict]:
    listeners = _get_listening_ports()
    return [
        {
            "key": "bioface",
            "title": "BioFace Web UI",
            "host": BIOFACE_HOST,
            "port": BIOFACE_PORT,
            "purpose": "Admin panel va API",
            "listening": listeners.get(BIOFACE_PORT),
        },
        {
            "key": "register",
            "title": "ISUP Register",
            "host": "0.0.0.0",
            "port": ISUP_REGISTER_PORT,
            "purpose": "Kameralar register va keepalive ulanishi",
            "listening": listeners.get(ISUP_REGISTER_PORT),
        },
        {
            "key": "alarm",
            "title": "Alarm",
            "host": "0.0.0.0",
            "port": ISUP_ALARM_PORT,
            "purpose": "Alarm/event callback uchun tavsiya port",
            "listening": listeners.get(ISUP_ALARM_PORT),
        },
        {
            "key": "picture",
            "title": "Picture",
            "host": "0.0.0.0",
            "port": ISUP_PICTURE_PORT,
            "purpose": "Snapshot/picture upload uchun tavsiya port",
            "listening": listeners.get(ISUP_PICTURE_PORT),
        },
        {
            "key": "api",
            "title": "ISUP REST API",
            "host": "0.0.0.0",
            "port": ISUP_API_PORT,
            "purpose": "BioFace -> ISUP health va device API",
            "listening": listeners.get(ISUP_API_PORT),
        },
        {
            "key": "redis",
            "title": "Redis",
            "host": REDIS_HOST,
            "port": REDIS_PORT,
            "purpose": "ISUP command/response va live data",
            "listening": listeners.get(REDIS_PORT),
        },
    ]


def _build_start_command() -> list[str]:
    def _sdk_python_executable() -> str:
        if os.name == "nt":
            base_python = Path(sys.base_prefix) / "python.exe"
        else:
            base_python = Path(sys.base_prefix) / "bin" / "python3"
        if base_python.exists():
            return str(base_python)
        return sys.executable

    if ISUP_IMPLEMENTATION_MODE == "hikvision_sdk":
        public_host = get_isup_public_host()
        return [
            _sdk_python_executable(),
            str(ISUP_SDK_SERVER_SCRIPT),
            ISUP_KEY,
            str(ISUP_REGISTER_PORT),
            str(ISUP_API_PORT),
            REDIS_HOST,
            str(REDIS_PORT),
            str(ISUP_ALARM_PORT),
            str(ISUP_PICTURE_PORT),
            "--public-host",
            public_host,
        ]

    return [
        str(get_binary_path()),
        ISUP_KEY,
        str(ISUP_REGISTER_PORT),
        str(ISUP_API_PORT),
        REDIS_HOST,
        str(REDIS_PORT),
        str(ISUP_ALARM_PORT),
        str(ISUP_PICTURE_PORT),
    ]


def get_process_status() -> dict:
    binary_path = get_binary_path()
    proc = _find_running_process()
    ports = get_port_map()
    sdk_status = get_sdk_status()

    status = {
        "running": proc is not None,
        "binary_exists": binary_path.exists(),
        "binary_path": str(binary_path),
        "pid_file": str(ISUP_PID_FILE),
        "start_command": _build_start_command(),
        "ports": ports,
        "panel": {
            "host": BIOFACE_HOST,
            "port": BIOFACE_PORT,
            "bind": f"{BIOFACE_HOST}:{BIOFACE_PORT}",
        },
        "redis": {
            "host": REDIS_HOST,
            "port": REDIS_PORT,
        },
        "sdk": sdk_status,
    }

    if proc is None:
        return status

    try:
        with proc.oneshot():
            status.update(
                {
                    "pid": proc.pid,
                    "name": proc.name(),
                    "exe": proc.exe(),
                    "status_text": proc.status(),
                    "memory_mb": round(proc.memory_info().rss / (1024 * 1024), 2),
                    "cpu_percent": round(proc.cpu_percent(interval=0.1), 2),
                    "created_at": proc.create_time(),
                    "uptime_seconds": int(time.time() - proc.create_time()),
                }
            )
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        _clear_pid()
        status["running"] = False

    return status


def start_isup_server() -> dict:
    status = get_process_status()
    if status["running"]:
        return status

    binary_path = get_binary_path()
    if not binary_path.exists():
        raise FileNotFoundError(f"ISUP binary topilmadi: {binary_path}")

    if ISUP_IMPLEMENTATION_MODE == "hikvision_sdk":
        sdk_status = get_sdk_status()
        if not sdk_status.get("ready"):
            raise FileNotFoundError(
                "Hikvision SDK runtime tayyor emas. /api/isup-sdk-status ni tekshiring."
            )

    kwargs = {
        "cwd": str(binary_path.parent),
        "stdin": subprocess.DEVNULL,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
        "close_fds": True,
    }

    if os.name == "nt":
        creationflags = 0
        creationflags |= getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        creationflags |= getattr(subprocess, "DETACHED_PROCESS", 0)
        creationflags |= getattr(subprocess, "CREATE_NO_WINDOW", 0)
        kwargs["creationflags"] = creationflags
    else:
        kwargs["start_new_session"] = True

    process = subprocess.Popen(_build_start_command(), **kwargs)
    _write_pid(process.pid)
    time.sleep(0.7)
    return get_process_status()


def stop_isup_server() -> dict:
    proc = _find_running_process()
    if proc is None:
        _clear_pid()
        return get_process_status()

    try:
        proc.terminate()
        proc.wait(timeout=5)
    except psutil.TimeoutExpired:
        proc.kill()
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        pass

    _clear_pid()
    time.sleep(0.3)
    return get_process_status()


def restart_isup_server() -> dict:
    stop_isup_server()
    return start_isup_server()
