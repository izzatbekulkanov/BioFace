"""Google Calendar API orqali O'zbekiston bayram kunlarini import qilish.

Requires: httpx (already installed)
API: https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events
Public calendar ID for Uzbekistan holidays: 'uz.uzbekistan#holiday@group.v.calendar.google.com'
"""
from __future__ import annotations

import logging
import os
from datetime import date
from typing import Optional

import httpx

LOGGER = logging.getLogger(__name__)

# O'zbekiston uchun Google umumiy bayramlar taqvimi
UZBEKISTAN_CALENDAR_ID = "uz.uzbekistan#holiday@group.v.calendar.google.com"
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

# Google Calendar API key (public calendar uchun kerak)
# .env da GOOGLE_CALENDAR_API_KEY o'rnatish kerak
GOOGLE_API_KEY = os.getenv("GOOGLE_CALENDAR_API_KEY", "")


def fetch_uzbekistan_holidays(
    year: int,
    api_key: Optional[str] = None,
    calendar_id: str = UZBEKISTAN_CALENDAR_ID,
) -> list[dict]:
    """Google Calendar dan O'zbekiston bayram kunlarini olish.

    Returns:
        list of dicts: [{title, date, is_weekend}, ...]
    """
    key = api_key or GOOGLE_API_KEY
    if not key:
        LOGGER.warning("GOOGLE_CALENDAR_API_KEY sozlanmagan. Umumiy bayramlar ishlatiladi.")
        return _get_default_uzbekistan_holidays(year)

    time_min = f"{year}-01-01T00:00:00Z"
    time_max = f"{year}-12-31T23:59:59Z"

    url = f"{GOOGLE_CALENDAR_API}/calendars/{calendar_id}/events"
    params = {
        "key": key,
        "timeMin": time_min,
        "timeMax": time_max,
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": "100",
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            r = client.get(url, params=params)
        r.raise_for_status()
        data = r.json()
        items = data.get("items", [])
        result = []
        for item in items:
            title = item.get("summary", "Bayram")
            start = item.get("start", {})
            date_str = start.get("date")  # 'YYYY-MM-DD' format
            if not date_str:
                continue
            try:
                d = date.fromisoformat(date_str)
            except Exception:
                continue
            result.append({
                "title": title,
                "date": d,
                "is_weekend": d.weekday() in (5, 6),  # shanba, yakshanba
            })
        LOGGER.info("Google Calendar dan %d ta bayram olindi (%d yil)", len(result), year)
        return result
    except Exception as exc:
        LOGGER.warning("Google Calendar fetch failed: %s. Default bayramlar ishlatiladi.", exc)
        return _get_default_uzbekistan_holidays(year)


def _get_default_uzbekistan_holidays(year: int) -> list[dict]:
    """Google API ishlamasa ishlatiladigan O'zbekiston rasmiy bayramlari."""
    holidays = [
        {"month": 1,  "day": 1,  "title": "Yangi yil"},
        {"month": 1,  "day": 2,  "title": "Yangi yil (2-kun)"},
        {"month": 3,  "day": 8,  "title": "Xalqaro xotin-qizlar kuni"},
        {"month": 3,  "day": 21, "title": "Navro'z"},
        {"month": 3,  "day": 22, "title": "Navro'z (2-kun)"},
        {"month": 3,  "day": 23, "title": "Navro'z (3-kun)"},
        {"month": 5,  "day": 9,  "title": "Xotira va qadrlash kuni"},
        {"month": 6,  "day": 1,  "title": "Bolalar himoyasi kuni"},
        {"month": 8,  "day": 31, "title": "O'zbekiston Respublikasi Mustaqillik kuni"},
        {"month": 9,  "day": 1,  "title": "O'zbekiston Respublikasi Mustaqillik kuni"},
        {"month": 10, "day": 1,  "title": "O'qituvchi va murabbiylar kuni"},
        {"month": 12, "day": 8,  "title": "O'zbekiston Respublikasi Konstitutsiyasi kuni"},
    ]
    result = []
    for h in holidays:
        try:
            d = date(year, h["month"], h["day"])
            result.append({
                "title": h["title"],
                "date": d,
                "is_weekend": d.weekday() in (5, 6),
            })
        except Exception:
            pass
    return result
