from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import psutil

from core.system_config import BASE_DIR

RUNTIME_DIR = BASE_DIR / ".runtime"
AI_PID_FILE = RUNTIME_DIR / "bioface_ai.pid"
AI_STDOUT_LOG = RUNTIME_DIR / "bioface_ai_stdout.log"
AI_STDERR_LOG = RUNTIME_DIR / "bioface_ai_stderr.log"


def _ensure_runtime_dir() -> None:
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)


def _read_pid() -> Optional[int]:
    try:
        return int(AI_PID_FILE.read_text(encoding="utf-8").strip())
    except Exception:
        return None


def _write_pid(pid: int) -> None:
    _ensure_runtime_dir()
    AI_PID_FILE.write_text(str(pid), encoding="utf-8")


def _clear_pid() -> None:
    try:
        AI_PID_FILE.unlink(missing_ok=True)
    except Exception:
        pass


def _build_start_command() -> list[str]:
    # Runs the inference service
    return [sys.executable, "services/inference_service.py"]


def _matches_ai_process(proc: psutil.Process) -> bool:
    try:
        cmdline = [str(part).lower() for part in (proc.cmdline() or [])]
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        return False

    if not cmdline:
        return False

    if "inference_service.py" in cmdline:
        return True

    for part in cmdline:
        path = Path(part)
        if path.name.lower() == "inference_service.py" and path.parent.name.lower() == "services":
            return True

    return False


def _find_process_by_pid(pid: Optional[int]) -> Optional[psutil.Process]:
    if not pid:
        return None
    try:
        proc = psutil.Process(pid)
        if proc.is_running() and _matches_ai_process(proc):
            return proc
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        return None
    return None


def _find_running_process() -> Optional[psutil.Process]:
    proc = _find_process_by_pid(_read_pid())
    if proc:
        return proc

    for candidate in psutil.process_iter():
        if _matches_ai_process(candidate):
            _write_pid(candidate.pid)
            return candidate
    return None


def is_port_in_use(port: int) -> bool:
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', port)) == 0


def get_ai_process_status() -> dict:
    proc = _find_running_process()
    port_active = is_port_in_use(7690)
    status = {
        "running": proc is not None or port_active,
        "pid_file": str(AI_PID_FILE),
        "start_command": _build_start_command(),
        "stdout_log": str(AI_STDOUT_LOG),
        "stderr_log": str(AI_STDERR_LOG),
    }

    if proc is None:
        if port_active:
            # If the port is active, try to find the process by searching psutil again
            # to populate additional details.
            for candidate in psutil.process_iter():
                if _matches_ai_process(candidate):
                    _write_pid(candidate.pid)
                    proc = candidate
                    break
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
        status["running"] = port_active

    return status


def start_ai_process() -> dict:
    if is_port_in_use(7690):
        return get_ai_process_status()

    lock_file = RUNTIME_DIR / "bioface_ai.lock"
    
    # Clean up stale lock file if service is not running
    if lock_file.exists():
        status = get_ai_process_status()
        if not status["running"]:
            try:
                lock_file.unlink(missing_ok=True)
            except Exception:
                pass

    try:
        _ensure_runtime_dir()
        with open(lock_file, "x") as f:
            f.write(str(os.getpid()))
    except FileExistsError:
        # Another worker is already starting it, wait and return status
        time.sleep(1.0)
        return get_ai_process_status()

    # Now we are the owner of the lock, check status once more
    status = get_ai_process_status()
    if status["running"]:
        try:
            lock_file.unlink(missing_ok=True)
        except Exception:
            pass
        return status

    kwargs = {
        "cwd": str(BASE_DIR),
        "stdin": subprocess.DEVNULL,
        "stdout": open(AI_STDOUT_LOG, "a", encoding="utf-8"),
        "stderr": open(AI_STDERR_LOG, "a", encoding="utf-8"),
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

    try:
        process = subprocess.Popen(_build_start_command(), **kwargs)
        _write_pid(process.pid)
        time.sleep(1.0)
    finally:
        # Always remove the lock file after we finish spawning
        try:
            lock_file.unlink(missing_ok=True)
        except Exception:
            pass

    return get_ai_process_status()


def stop_ai_process() -> dict:
    proc = _find_running_process()
    if proc is None:
        _clear_pid()
        return get_ai_process_status()

    try:
        proc.terminate()
        proc.wait(timeout=5)
    except psutil.TimeoutExpired:
        proc.kill()
    except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
        pass

    _clear_pid()
    time.sleep(0.2)
    return get_ai_process_status()


def restart_ai_process() -> dict:
    stop_ai_process()
    return start_ai_process()
