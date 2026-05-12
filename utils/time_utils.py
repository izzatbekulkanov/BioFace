from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Any
from xml.sax.saxutils import escape as xml_escape

UTC = timezone.utc
TASHKENT_POSIX_TZ = "UZT-5:00:00"


def _resolve_tashkent_tz():
    try:
        return ZoneInfo("Asia/Tashkent")
    except ZoneInfoNotFoundError:
        # Fallback for environments without IANA timezone database (common on Windows).
        return timezone(timedelta(hours=5))


TASHKENT_TZ = _resolve_tashkent_tz()


def now_tashkent() -> datetime:
    """Return current time in Asia/Tashkent as naive local datetime for DB storage."""
    return datetime.now(TASHKENT_TZ).replace(tzinfo=None)


def tashkent_localtime_text(value: Any = None) -> str:
    """Return local Asia/Tashkent time as ISO 8601 text without offset."""
    if value is None:
        dt = now_tashkent()
    else:
        dt = normalize_timestamp_tashkent(value) or now_tashkent()
    return dt.replace(microsecond=0).isoformat(timespec="seconds")


def build_tashkent_time_xml(*, include_namespace: bool = True, posix_tz: str = TASHKENT_POSIX_TZ) -> str:
    """
    Build Hikvision /ISAPI/System/time XML.

    Hikvision expects a POSIX time zone string here. For Asia/Tashkent (UTC+05:00),
    the correct POSIX offset sign is reversed, so "UZT-5:00:00" means UTC+05:00.
    """
    xmlns_attr = ' xmlns="http://www.isapi.org/ver20/XMLSchema"' if include_namespace else ""
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<Time version="2.0"{xmlns_attr}>\n'
        '  <timeMode>manual</timeMode>\n'
        f'  <localTime>{xml_escape(tashkent_localtime_text())}</localTime>\n'
        f'  <timeZone>{xml_escape(str(posix_tz or TASHKENT_POSIX_TZ))}</timeZone>\n'
        '</Time>'
    )


def today_tashkent_range() -> tuple[datetime, datetime]:
    """Return current day range in Asia/Tashkent as naive datetimes."""
    start = now_tashkent().replace(hour=0, minute=0, second=0, microsecond=0)
    return start, start + timedelta(days=1)


def normalize_timestamp_tashkent(value: Any) -> datetime | None:
    """Normalize incoming timestamps to naive Asia/Tashkent datetime."""
    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is not None:
            return dt.astimezone(TASHKENT_TZ).replace(tzinfo=None)
        return dt

    if isinstance(value, (int, float)):
        try:
            raw = float(value)
            if raw > 10_000_000_000:
                raw = raw / 1000.0
            return datetime.fromtimestamp(raw, tz=UTC).astimezone(TASHKENT_TZ).replace(tzinfo=None)
        except Exception:
            return None

    raw_text = str(value or "").strip()
    if not raw_text:
        return None

    normalized = raw_text.replace("Z", "+00:00")
    for candidate in (normalized, raw_text):
        try:
            dt = datetime.fromisoformat(candidate)
            if dt.tzinfo is not None:
                return dt.astimezone(TASHKENT_TZ).replace(tzinfo=None)
            return dt
        except Exception:
            pass

    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
    ):
        try:
            return datetime.strptime(raw_text, fmt)
        except Exception:
            continue
    return None

