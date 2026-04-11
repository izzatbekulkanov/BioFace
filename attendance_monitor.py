from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass
from datetime import date
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.orm import selectinload

from database import SessionLocal, ensure_schema
from models import AttendanceLog, Employee, Organization
from schedule_utils import (
    ATTENDANCE_GRACE_MINUTES,
    get_attendance_deadline,
    is_holiday_for_org,
    resolve_employee_schedule,
)
from time_utils import now_tashkent, today_tashkent_range


LOGGER = logging.getLogger(__name__)
CHECK_INTERVAL_SECONDS = max(30, int(os.getenv("BIOFACE_ATTENDANCE_MONITOR_INTERVAL", "60") or 60))
NEUTRAL_NOTIFICATION_TYPE = "missed_shift"


def _format_employee_name(employee: Employee) -> str:
    return " ".join(
        part for part in [employee.first_name, employee.last_name, employee.middle_name] if part and str(part).strip()
    ).strip() or f"Employee #{employee.id}"


def _build_neutral_message(employee: Employee, *, target_date: date, start_time: str, language: str) -> str:
    full_name = _format_employee_name(employee)
    date_label = target_date.strftime("%d.%m.%Y")
    if str(language or "").strip().lower() == "ru":
        return f"{full_name} по состоянию на {start_time} {date_label} не прибыл на свою смену."
    return f"{full_name} {date_label} kuni soat {start_time} holatiga ko'ra o'z smenasiga yetib kelmadi."


def _send_telegram_message(token: str, chat_id: str, text_message: str) -> None:
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    with httpx.Client(timeout=12.0, trust_env=False) as client:
        response = client.post(
            url,
            json={
                "chat_id": chat_id,
                "text": text_message,
            },
        )
    response.raise_for_status()
    payload = response.json()
    if not bool(payload.get("ok")):
        raise RuntimeError(str(payload.get("description") or "Telegram API xatoligi"))


def _claim_notification_slot(db, *, employee_id: int, target_date: date, schedule_id: int | None) -> bool:
    result = db.execute(
        text(
            """
            INSERT OR IGNORE INTO attendance_notification_logs
            (employee_id, target_date, notification_type, schedule_id, sent_at)
            VALUES (:employee_id, :target_date, :notification_type, :schedule_id, CURRENT_TIMESTAMP)
            """
        ),
        {
            "employee_id": int(employee_id),
            "target_date": target_date.isoformat(),
            "notification_type": NEUTRAL_NOTIFICATION_TYPE,
            "schedule_id": int(schedule_id) if schedule_id is not None else None,
        },
    )
    return int(getattr(result, "rowcount", 0) or 0) > 0


def _release_notification_slot(db, *, employee_id: int, target_date: date) -> None:
    db.execute(
        text(
            """
            DELETE FROM attendance_notification_logs
            WHERE employee_id = :employee_id
              AND target_date = :target_date
              AND notification_type = :notification_type
            """
        ),
        {
            "employee_id": int(employee_id),
            "target_date": target_date.isoformat(),
            "notification_type": NEUTRAL_NOTIFICATION_TYPE,
        },
    )


@dataclass
class AttendanceMonitorSnapshot:
    running: bool
    interval_seconds: int
    last_run_at: str | None
    last_success_at: str | None
    last_error: str | None
    checked_employees: int
    notified_employees: int
    skipped_employees: int


class AttendanceMonitor:
    def __init__(self) -> None:
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()
        self._state: dict[str, Any] = {
            "last_run_at": None,
            "last_success_at": None,
            "last_error": None,
            "checked_employees": 0,
            "notified_employees": 0,
            "skipped_employees": 0,
        }

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        ensure_schema()
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, name="bioface-attendance-monitor", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3.0)

    def status(self) -> AttendanceMonitorSnapshot:
        with self._lock:
            return AttendanceMonitorSnapshot(
                running=bool(self._thread and self._thread.is_alive() and not self._stop_event.is_set()),
                interval_seconds=CHECK_INTERVAL_SECONDS,
                last_run_at=self._state.get("last_run_at"),
                last_success_at=self._state.get("last_success_at"),
                last_error=self._state.get("last_error"),
                checked_employees=int(self._state.get("checked_employees") or 0),
                notified_employees=int(self._state.get("notified_employees") or 0),
                skipped_employees=int(self._state.get("skipped_employees") or 0),
            )

    def run_once(self) -> dict[str, int]:
        now_local = now_tashkent()
        today = now_local.date()
        today_start, today_end = today_tashkent_range()
        checked = 0
        notified = 0
        skipped = 0

        with self._lock:
            self._state["last_run_at"] = now_local.isoformat()
            self._state["last_error"] = None

        with SessionLocal() as db:
            employees = (
                db.query(Employee)
                .options(
                    selectinload(Employee.organization),
                    selectinload(Employee.schedule),
                    selectinload(Employee.telegram_contacts),
                )
                .filter(Employee.has_access.is_(True))
                .order_by(Employee.id.asc())
                .all()
            )
            if not employees:
                with self._lock:
                    self._state["last_success_at"] = now_local.isoformat()
                    self._state["checked_employees"] = 0
                    self._state["notified_employees"] = 0
                    self._state["skipped_employees"] = 0
                return {"checked": 0, "notified": 0, "skipped": 0}

            present_employee_ids = {
                int(row[0])
                for row in (
                    db.query(AttendanceLog.employee_id)
                    .filter(
                        AttendanceLog.employee_id.isnot(None),
                        AttendanceLog.status == "aniqlandi",
                        AttendanceLog.timestamp >= today_start,
                        AttendanceLog.timestamp < today_end,
                    )
                    .distinct()
                    .all()
                )
                if row[0] is not None
            }

            for employee in employees:
                checked += 1
                organization = employee.organization
                if organization is None or organization.id is None:
                    skipped += 1
                    continue

                sub_status = str(
                    organization.subscription_status.value
                    if hasattr(organization.subscription_status, "value")
                    else organization.subscription_status or ""
                ).strip().lower()
                if sub_status == "expired":
                    skipped += 1
                    continue

                contacts = [contact for contact in list(employee.telegram_contacts or []) if bool(contact.is_active)]
                token = str(getattr(organization, "telegram_bot_token", "") or "").strip()
                if not contacts or not bool(getattr(organization, "telegram_enabled", False)) or not token:
                    skipped += 1
                    continue

                if is_holiday_for_org(db, today, int(organization.id)):
                    skipped += 1
                    continue

                schedule_payload = resolve_employee_schedule(employee)
                deadline = get_attendance_deadline(employee, today, grace_minutes=ATTENDANCE_GRACE_MINUTES)
                if now_local < deadline:
                    skipped += 1
                    continue

                if int(employee.id) in present_employee_ids:
                    skipped += 1
                    continue

                claimed = _claim_notification_slot(
                    db,
                    employee_id=int(employee.id),
                    target_date=today,
                    schedule_id=schedule_payload.get("schedule_id"),
                )
                if not claimed:
                    skipped += 1
                    continue

                sent_any = False
                try:
                    for contact in contacts:
                        chat_id = str(contact.telegram_chat_id or "").strip()
                        if not chat_id:
                            continue
                        message_text = _build_neutral_message(
                            employee,
                            target_date=today,
                            start_time=str(schedule_payload.get("start_time") or "09:00"),
                            language=str(contact.language or "uz"),
                        )
                        _send_telegram_message(token, chat_id, message_text)
                        sent_any = True
                    if sent_any:
                        db.commit()
                        notified += 1
                    else:
                        _release_notification_slot(db, employee_id=int(employee.id), target_date=today)
                        db.commit()
                        skipped += 1
                except Exception as exc:
                    db.rollback()
                    with db.begin():
                        _release_notification_slot(db, employee_id=int(employee.id), target_date=today)
                    LOGGER.exception("Attendance monitor failed to send notification for employee %s", employee.id)
                    skipped += 1
                    with self._lock:
                        self._state["last_error"] = str(exc)

        with self._lock:
            self._state["last_success_at"] = now_local.isoformat()
            self._state["checked_employees"] = checked
            self._state["notified_employees"] = notified
            self._state["skipped_employees"] = skipped
        return {"checked": checked, "notified": notified, "skipped": skipped}

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.run_once()
            except Exception as exc:
                LOGGER.exception("Attendance monitor loop failed")
                with self._lock:
                    self._state["last_error"] = str(exc)
            self._stop_event.wait(CHECK_INTERVAL_SECONDS)


attendance_monitor = AttendanceMonitor()


def start_attendance_monitor() -> None:
    attendance_monitor.start()


def stop_attendance_monitor() -> None:
    attendance_monitor.stop()


def get_attendance_monitor_status() -> dict[str, Any]:
    snapshot = attendance_monitor.status()
    return {
        "running": snapshot.running,
        "interval_seconds": snapshot.interval_seconds,
        "last_run_at": snapshot.last_run_at,
        "last_success_at": snapshot.last_success_at,
        "last_error": snapshot.last_error,
        "checked_employees": snapshot.checked_employees,
        "notified_employees": snapshot.notified_employees,
        "skipped_employees": snapshot.skipped_employees,
    }

