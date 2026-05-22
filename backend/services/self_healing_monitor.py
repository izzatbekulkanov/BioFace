import time
import logging
import threading
from datetime import datetime, timedelta
from typing import Any, Dict

from database import SessionLocal
from models import Device
from utils.time_utils import now_tashkent

# Configure Logging
logging.basicConfig(level=logging.INFO)
LOGGER = logging.getLogger("SelfHealingMonitor")

CHECK_INTERVAL_SECONDS = 60
OFFLINE_THRESHOLD_MINUTES = 5
REBOOT_COOLDOWN_MINUTES = 30

class SelfHealingMonitor:
    def __init__(self) -> None:
        self._stop_event = threading.Event()
        self._thread = None
        self._lock = threading.Lock()
        self._state = {
            "running": False,
            "last_run_at": None,
            "last_success_at": None,
            "last_error": None,
            "healed_count": 0,
        }
        self._last_reboot_time: Dict[int, float] = {}

    def start(self) -> None:
        with self._lock:
            if self._state["running"]:
                return
            self._stop_event.clear()
            self._state["running"] = True
            self._thread = threading.Thread(
                target=self._run_loop,
                name="self-healing-monitor",
                daemon=True
            )
            self._thread.start()
            LOGGER.info("iSUP Self-Healing Monitor background thread started.")

    def stop(self) -> None:
        with self._lock:
            if not self._state["running"]:
                return
            self._stop_event.set()
            self._state["running"] = False
            
        if self._thread:
            self._thread.join(timeout=5)
            LOGGER.info("iSUP Self-Healing Monitor background thread stopped.")

    def status(self) -> dict:
        with self._lock:
            return dict(self._state)

    def run_once(self) -> None:
        now_ts = time.time()
        now_local = now_tashkent()
        
        with self._lock:
            self._state["last_run_at"] = now_local.isoformat()
            
        db = SessionLocal()
        try:
            # Query all devices that are offline
            devices = db.query(Device).filter(
                (Device.is_online == False) | (Device.is_online == 0)
            ).all()
            
            for device in devices:
                if not device.isup_device_id:
                    continue
                
                # Check how long the camera has been offline
                last_seen = device.last_seen_at or device.created_at or now_local
                offline_duration = now_local - last_seen
                
                if offline_duration >= timedelta(minutes=OFFLINE_THRESHOLD_MINUTES):
                    # Check if the device is in cooldown
                    last_reboot = self._last_reboot_time.get(device.id, 0)
                    if now_ts - last_reboot >= REBOOT_COOLDOWN_MINUTES * 60:
                        LOGGER.info(
                            f"Camera '{device.name}' (ID: {device.id}, iSUP: {device.isup_device_id}) is offline "
                            f"for {offline_duration.total_seconds() // 60} minutes. Triggering soft-reboot self-healing..."
                        )
                        
                        # Set last reboot timestamp to prevent double trigger
                        self._last_reboot_time[device.id] = now_ts
                        
                        # Send reboot command via Redis bridge
                        try:
                            from services.redis_client import send_command_and_wait, is_connected as redis_ok
                            if redis_ok():
                                # Send reboot command
                                response = send_command_and_wait(
                                    device.isup_device_id,
                                    "reboot",
                                    {},
                                    timeout=10.0
                                )
                                LOGGER.info(f"Self-healing reboot response for camera '{device.name}': {response}")
                                with self._lock:
                                    self._state["healed_count"] += 1
                            else:
                                LOGGER.warning("Redis connection offline. Cannot send self-healing command.")
                        except Exception as e:
                            LOGGER.exception(f"Failed to send self-healing reboot command for camera '{device.name}': {e}")
                            
            with self._lock:
                self._state["last_success_at"] = now_local.isoformat()
                
        except Exception as exc:
            LOGGER.exception("Self-healing monitor run cycle failed")
            with self._lock:
                self._state["last_error"] = str(exc)
        finally:
            db.close()

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.run_once()
            except Exception as exc:
                LOGGER.exception("Self-healing monitor loop exception")
                with self._lock:
                    self._state["last_error"] = str(exc)
            self._stop_event.wait(CHECK_INTERVAL_SECONDS)


self_healing_monitor = SelfHealingMonitor()

def start_self_healing_monitor() -> None:
    self_healing_monitor.start()

def stop_self_healing_monitor() -> None:
    self_healing_monitor.stop()

def get_self_healing_monitor_status() -> dict:
    return self_healing_monitor.status()
