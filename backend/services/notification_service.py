"""BioFace bildirishnoma xizmati.

Qo'llab quvvatlanadigan triggerlar:
  1. Xodim kechikishi → rahbarga darhol xabar (Telegram)
  2. Haftalik davomat hisoboti → har dushanba tashkilot adminiga
  3. Kamera offline → IT adminiga darhol xabar
  4. Obuna tugash → 7, 3, 1 kun oldin ogohlantirish
"""
from __future__ import annotations

import logging
import os
import threading
from datetime import date, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Device, Employee, Organization, User
from utils.time_utils import now_tashkent

LOGGER = logging.getLogger(__name__)

# Kechikish bildirishnomasi uchun minimum kechikish (daqiqa)
LATE_NOTIFICATION_THRESHOLD_MINUTES = int(os.getenv("LATE_NOTIFY_THRESHOLD_MIN", "15"))
# Offline kamera uchun minimum offline vaqt (daqiqa)
CAMERA_OFFLINE_THRESHOLD_MINUTES = int(os.getenv("CAMERA_OFFLINE_THRESHOLD_MIN", "10"))
# Tekshirish oralig'i (soniya)
NOTIFY_CHECK_INTERVAL = int(os.getenv("NOTIFY_CHECK_INTERVAL_SEC", "300"))  # 5 daqiqa


def _send_telegram(token: str, chat_id: str, text_msg: str, parse_mode: str = "HTML") -> bool:
    """Telegram xabar yuborish. True=muvaffaqiyatli."""
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        with httpx.Client(timeout=12.0, trust_env=False) as client:
            r = client.post(url, json={"chat_id": chat_id, "text": text_msg, "parse_mode": parse_mode})
        data = r.json()
        if not data.get("ok"):
            LOGGER.warning("Telegram xato: %s", data.get("description"))
            return False
        return True
    except Exception as exc:
        LOGGER.warning("Telegram yuborishda xatolik: %s", exc)
        return False


def _org_token_chat(org: Organization) -> tuple[str, str] | None:
    """Tashkilot Telegram token va admin chat_id ni qaytaradi."""
    token = str(getattr(org, "telegram_bot_token", "") or "").strip()
    chat_id = str(getattr(org, "telegram_admin_chat_id", "") or "").strip()
    enabled = bool(getattr(org, "telegram_enabled", False))
    if not enabled or not token or not chat_id:
        return None
    return token, chat_id


def _claim_notify_slot(db: Session, *, key: str, target_date: str) -> bool:
    """Takroriy bildirishnomani oldini olish uchun slot band qilish."""
    try:
        result = db.execute(
            text("""
                INSERT OR IGNORE INTO notification_sent_log (notify_key, target_date, sent_at)
                VALUES (:key, :target_date, CURRENT_TIMESTAMP)
            """),
            {"key": key, "target_date": target_date}
        )
        db.commit()
        return int(getattr(result, "rowcount", 0) or 0) > 0
    except Exception:
        return False


def _ensure_notify_table(db: Session) -> None:
    """Bildirishnoma log jadvalini yaratish."""
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS notification_sent_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notify_key TEXT NOT NULL,
            target_date TEXT NOT NULL,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(notify_key, target_date)
        )
    """))
    db.commit()


# ── 1. KECHIKISH BILDIRISHNOMASI ──────────────────────────────────────────────

def check_late_arrivals(db: Session) -> int:
    """Kech kelgan xodimlarni aniqlash va rahbarga xabar berish."""
    now = now_tashkent()
    today_str = now.date().isoformat()
    sent = 0

    orgs = (
        db.query(Organization)
        .filter(
            Organization.telegram_enabled.is_(True),
            Organization.telegram_bot_token.isnot(None),
            Organization.telegram_admin_chat_id.isnot(None),
        )
        .all()
    )

    for org in orgs:
        tc = _org_token_chat(org)
        if not tc:
            continue
        token, admin_chat = tc

        # Sub status tekshirish
        sub = str(getattr(org, "subscription_status", "") or "").lower()
        if sub == "expired":
            continue

        start_time = str(getattr(org, "default_start_time", "09:00") or "09:00")
        try:
            sh, sm = map(int, start_time.split(":"))
        except Exception:
            sh, sm = 9, 0

        deadline = now.replace(hour=sh, minute=sm + LATE_NOTIFICATION_THRESHOLD_MINUTES, second=0, microsecond=0)
        if now < deadline:
            continue  # Hali kechikish vaqti kelmagan

        # Bu tashkilot xodimlari
        employees = (
            db.query(Employee)
            .filter(
                Employee.organization_id == org.id,
                Employee.has_access.is_(True),
                Employee.employee_type.notin_(["oquvchi", "talaba"]),
            )
            .all()
        )

        for emp in employees:
            # Maxsus statuslar (Kasallik ta'tili, Xizmat safari, Mehnat ta'tili va h.k.) ni tekshirish
            from models import EmployeeStatusRecord
            from sqlalchemy import or_
            has_special_status = db.query(EmployeeStatusRecord).filter(
                EmployeeStatusRecord.employee_id == emp.id,
                EmployeeStatusRecord.start_date <= now.date(),
                or_(
                    EmployeeStatusRecord.end_date == None,
                    EmployeeStatusRecord.end_date >= now.date()
                )
            ).first() is not None

            if has_special_status:
                continue

            # Bugun kelganmi tekshirish
            came = db.execute(
                text("""
                    SELECT COUNT(*) FROM attendance_logs
                    WHERE employee_id = :eid
                      AND date(timestamp) = :today
                      AND status = 'aniqlandi'
                """),
                {"eid": emp.id, "today": today_str}
            ).scalar() or 0

            if came > 0:
                continue  # Kelgan, skip

            slot_key = f"late_{org.id}_{emp.id}"
            if not _claim_notify_slot(db, key=slot_key, target_date=today_str):
                continue  # Bugun allaqachon yuborilgan

            name = " ".join(filter(None, [emp.first_name, emp.last_name]))
            msg = (
                f"⚠️ <b>Kechikish bildirishnomasi</b>\n\n"
                f"👤 <b>{name}</b>\n"
                f"🏢 {org.name}\n"
                f"⏰ Ish boshlanishi: {start_time}\n"
                f"📅 {today_str}\n\n"
                f"Xodim hali kelmagan!"
            )
            if _send_telegram(token, admin_chat, msg):
                sent += 1

    return sent


# ── 2. HAFTALIK DAVOMAT HISOBOTI ──────────────────────────────────────────────

def send_weekly_attendance_report(db: Session) -> int:
    """Haftalik davomat foizini hisoblab, adminlarga yuborish."""
    now = now_tashkent()
    # Faqat dushanba 09:00 da ishlaydi
    if now.weekday() != 0:  # 0 = dushanba
        return 0

    today_str = now.date().isoformat()
    week_start = (now.date() - timedelta(days=7)).isoformat()
    sent = 0

    orgs = (
        db.query(Organization)
        .filter(
            Organization.telegram_enabled.is_(True),
            Organization.telegram_bot_token.isnot(None),
            Organization.telegram_admin_chat_id.isnot(None),
        )
        .all()
    )

    for org in orgs:
        tc = _org_token_chat(org)
        if not tc:
            continue
        token, admin_chat = tc

        slot_key = f"weekly_report_{org.id}"
        if not _claim_notify_slot(db, key=slot_key, target_date=today_str):
            continue

        # Jami xodimlar
        total_emp = db.execute(
            text("SELECT COUNT(*) FROM employees WHERE organization_id=:oid AND has_access=1"),
            {"oid": org.id}
        ).scalar() or 0

        if total_emp == 0:
            continue

        # O'tgan haftada kelganlar (unique employees)
        present = db.execute(
            text("""
                SELECT COUNT(DISTINCT employee_id) FROM attendance_logs al
                JOIN employees e ON e.id = al.employee_id
                WHERE e.organization_id = :oid
                  AND al.status = 'aniqlandi'
                  AND date(al.timestamp) >= :week_start
                  AND date(al.timestamp) < :today
            """),
            {"oid": org.id, "week_start": week_start, "today": today_str}
        ).scalar() or 0

        pct = round(present / total_emp * 100) if total_emp > 0 else 0
        status_emoji = "✅" if pct >= 80 else "⚠️" if pct >= 60 else "❌"

        msg = (
            f"{status_emoji} <b>Haftalik davomat hisoboti</b>\n"
            f"🏢 {org.name}\n"
            f"📅 Hafta: {week_start} – {today_str}\n\n"
            f"👥 Jami xodimlar: <b>{total_emp}</b>\n"
            f"✅ Kelganlar (kamida 1 marta): <b>{present}</b>\n"
            f"📊 Davomat foizi: <b>{pct}%</b>\n"
        )
        if pct < 80:
            msg += f"\n⚠️ Davomat 80% dan past! Tekshirib ko'ring."

        if _send_telegram(token, admin_chat, msg):
            sent += 1

    return sent


# ── 3. KAMERA OFFLINE BILDIRISHNOMASI ────────────────────────────────────────

def check_offline_cameras(db: Session) -> int:
    """Uzoq vaqt offline bo'lgan kameralar haqida IT adminiga xabar berish."""
    now = now_tashkent()
    today_str = now.date().isoformat()
    threshold_time = now - timedelta(minutes=CAMERA_OFFLINE_THRESHOLD_MINUTES)
    sent = 0

    offline_cams = (
        db.query(Device)
        .filter(
            Device.is_online.is_(False),
            Device.organization_id.isnot(None),
        )
        .all()
    )

    org_cams: dict[int, list] = {}
    for cam in offline_cams:
        if cam.last_seen_at and cam.last_seen_at > threshold_time:
            continue  # Yaqinda ko'rilgan, hali muammo emas
        org_id = cam.organization_id
        if org_id not in org_cams:
            org_cams[org_id] = []
        org_cams[org_id].append(cam)

    for org_id, cams in org_cams.items():
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            continue
        tc = _org_token_chat(org)
        if not tc:
            continue
        token, admin_chat = tc

        slot_key = f"cam_offline_{org_id}_{'_'.join(str(c.id) for c in cams[:5])}"
        if not _claim_notify_slot(db, key=slot_key, target_date=today_str):
            continue

        cam_list = "\n".join(
            f"  📷 {c.name} ({c.mac_address or 'MAC yo\'q'})"
            for c in cams[:10]
        )
        msg = (
            f"🔴 <b>Kamera offline xabardorlik</b>\n"
            f"🏢 {org.name}\n"
            f"⏱ Tekshiruv: {now.strftime('%H:%M')} {today_str}\n\n"
            f"Offline kameralar ({len(cams)} ta):\n{cam_list}\n\n"
            f"Iltimos, kamerani tekshiring!"
        )
        if _send_telegram(token, admin_chat, msg):
            sent += 1

    return sent


# ── 4. OBUNA TUGASH OGOHLANTIRISHLARI ────────────────────────────────────────

def check_subscription_expiry(db: Session) -> int:
    """Obuna tugashidan 7, 3, 1 kun oldin xabar berish."""
    now = now_tashkent()
    today = now.date()
    today_str = today.isoformat()
    sent = 0
    alert_days = [7, 3, 1]

    orgs = (
        db.query(Organization)
        .filter(
            Organization.subscription_end_date.isnot(None),
            Organization.subscription_status == "active",
            Organization.telegram_enabled.is_(True),
            Organization.telegram_bot_token.isnot(None),
            Organization.telegram_admin_chat_id.isnot(None),
        )
        .all()
    )

    for org in orgs:
        tc = _org_token_chat(org)
        if not tc:
            continue
        token, admin_chat = tc

        end_date = org.subscription_end_date
        if hasattr(end_date, "date"):
            end_date = end_date.date()

        days_left = (end_date - today).days
        if days_left not in alert_days:
            continue

        slot_key = f"sub_expiry_{org.id}_{days_left}d"
        if not _claim_notify_slot(db, key=slot_key, target_date=today_str):
            continue

        emoji = "🔴" if days_left == 1 else "🟡" if days_left == 3 else "🟢"
        msg = (
            f"{emoji} <b>Obuna tugash ogohlantirishsi</b>\n"
            f"🏢 {org.name}\n"
            f"📅 Obuna tugash sanasi: <b>{end_date}</b>\n"
            f"⏳ Qolgan kunlar: <b>{days_left} kun</b>\n\n"
            f"Obunani yangilash uchun BioFace jamoasi bilan bog'laning!"
        )
        if _send_telegram(token, admin_chat, msg):
            sent += 1

    return sent


# ── ASOSIY NOTIFICATION MONITOR ───────────────────────────────────────────────

class NotificationMonitor:
    def __init__(self) -> None:
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._state: dict[str, Any] = {
            "last_run_at": None,
            "last_error": None,
            "late_sent": 0,
            "weekly_sent": 0,
            "offline_cam_sent": 0,
            "sub_expiry_sent": 0,
        }
        self._lock = threading.Lock()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run_loop,
            name="bioface-notification-monitor",
            daemon=True
        )
        self._thread.start()
        LOGGER.info("NotificationMonitor started.")

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)

    def status(self) -> dict:
        with self._lock:
            return dict(self._state)

    def run_once(self) -> dict:
        now = now_tashkent()
        results = {"late": 0, "weekly": 0, "offline_cam": 0, "sub_expiry": 0, "error": None}
        with SessionLocal() as db:
            try:
                _ensure_notify_table(db)
            except Exception:
                pass
            try:
                results["late"] = check_late_arrivals(db)
            except Exception as exc:
                LOGGER.exception("Late arrival check failed")
                results["error"] = str(exc)
            try:
                results["weekly"] = send_weekly_attendance_report(db)
            except Exception as exc:
                LOGGER.exception("Weekly report failed")
            try:
                results["offline_cam"] = check_offline_cameras(db)
            except Exception as exc:
                LOGGER.exception("Offline camera check failed")
            try:
                results["sub_expiry"] = check_subscription_expiry(db)
            except Exception as exc:
                LOGGER.exception("Subscription expiry check failed")

        with self._lock:
            self._state["last_run_at"] = now.isoformat()
            self._state["last_error"] = results["error"]
            self._state["late_sent"] = results["late"]
            self._state["weekly_sent"] = results["weekly"]
            self._state["offline_cam_sent"] = results["offline_cam"]
            self._state["sub_expiry_sent"] = results["sub_expiry"]
        return results

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.run_once()
            except Exception as exc:
                LOGGER.exception("NotificationMonitor loop failed")
                with self._lock:
                    self._state["last_error"] = str(exc)
            self._stop_event.wait(NOTIFY_CHECK_INTERVAL)


notification_monitor = NotificationMonitor()


def start_notification_monitor() -> None:
    notification_monitor.start()


def stop_notification_monitor() -> None:
    notification_monitor.stop()


def get_notification_monitor_status() -> dict:
    return notification_monitor.status()
