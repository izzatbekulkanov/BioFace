from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import psutil


BASE_DIR = Path(__file__).parent
RUNTIME_DIR = BASE_DIR / ".runtime"
BOT_PID_FILE = RUNTIME_DIR / "telegram_bot.pid"
BOT_STDOUT_LOG = RUNTIME_DIR / "telegram_bot_stdout.log"
BOT_STDERR_LOG = RUNTIME_DIR / "telegram_bot_stderr.log"


def _ensure_runtime_dir() -> None:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)


def _read_pid() -> Optional[int]:
    try:
        return int(BOT_PID_FILE.read_text(encoding="utf-8").strip())
    except Exception:
        return None


def _write_pid(pid: int) -> None:
    _ensure_runtime_dir()
    BOT_PID_FILE.write_text(str(pid), encoding="utf-8")


def _clear_pid() -> None:
    try:
        BOT_PID_FILE.unlink(missing_ok=True)
    except Exception:
        pass


def _build_start_command() -> list[str]:
    return [sys.executable, "-m", "bot.main"]


def _matches_bot_process(proc: psutil.Process) -> bool:
    try:
        cmdline = [str(part).lower() for part in (proc.cmdline() or [])]
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        return False

    if not cmdline:
        return False

    if "bot.main" in cmdline:
        return True

    for part in cmdline:
        path = Path(part)
        if path.name.lower() == "main.py" and path.parent.name.lower() == "bot":
            return True
        normalized = part.replace("/", "\\")
        if normalized.endswith("\\bot\\main.py"):
            return True

    return False


def _find_process_by_pid(pid: Optional[int]) -> Optional[psutil.Process]:
    if not pid:
        return None
    try:
        proc = psutil.Process(pid)
        if proc.is_running() and _matches_bot_process(proc):
            return proc
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        return None
    return None


def _find_running_process() -> Optional[psutil.Process]:
    proc = _find_process_by_pid(_read_pid())
    if proc:
        return proc

    for candidate in psutil.process_iter():
        if _matches_bot_process(candidate):
            _write_pid(candidate.pid)
            return candidate
    return None


def get_bot_process_status() -> dict:
    proc = _find_running_process()
    status = {
        "running": proc is not None,
        "pid_file": str(BOT_PID_FILE),
        "start_command": _build_start_command(),
        "stdout_log": str(BOT_STDOUT_LOG),
        "stderr_log": str(BOT_STDERR_LOG),
    }

    if proc is None:
        return status

    try:
        with proc.oneshot():
            status.update(
                {
                    "pid": proc.pid,
                    "name": proc.name(),
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


def start_bot_process() -> dict:
    status = get_bot_process_status()
    if status["running"]:
        return status

    _ensure_runtime_dir()

    kwargs = {
        "cwd": str(BASE_DIR),
        "stdin": subprocess.DEVNULL,
        "stdout": open(BOT_STDOUT_LOG, "a", encoding="utf-8"),
        "stderr": open(BOT_STDERR_LOG, "a", encoding="utf-8"),
        "close_fds": False,
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
    time.sleep(1.0)
    return get_bot_process_status()


def stop_bot_process() -> dict:
    proc = _find_running_process()
    if proc is None:
        _clear_pid()
        return get_bot_process_status()

    try:
        proc.terminate()
        proc.wait(timeout=5)
    except psutil.TimeoutExpired:
        proc.kill()
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        pass

    _clear_pid()
    time.sleep(0.2)
    return get_bot_process_status()


def restart_bot_process() -> dict:
    stop_bot_process()
    return start_bot_process()

