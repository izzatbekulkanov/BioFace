from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Iterable


def _read_positive_int_env(name: str, default: int, *, minimum: int = 1, maximum: int = 24 * 60 * 60) -> int:
    raw = str(os.getenv(name, "")).strip()
    if not raw:
        return int(default)
    try:
        value = int(raw)
    except Exception:
        return int(default)
    return max(int(minimum), min(int(maximum), value))


ATTENDANCE_VISIT_SESSION_GAP_SECONDS = _read_positive_int_env(
    "ATTENDANCE_VISIT_SESSION_GAP_SECONDS",
    300,
    minimum=30,
    maximum=12 * 60 * 60,
)

ATTENDANCE_FLOOD_GUARD_SECONDS = _read_positive_int_env(
    "ATTENDANCE_FLOOD_GUARD_SECONDS",
    60,
    minimum=8,
    maximum=30 * 60,
)


def _extract_timestamp(item: Any) -> datetime | None:
    if item is None:
        return None
    if isinstance(item, dict):
        value = item.get("timestamp")
    else:
        value = getattr(item, "timestamp", None)
    return value if isinstance(value, datetime) else None


def build_attendance_sessions(
    items: Iterable[Any],
    *,
    gap_seconds: int = ATTENDANCE_VISIT_SESSION_GAP_SECONDS,
) -> list[list[Any]]:
    """
    Group consecutive attendance detections into visit sessions.

    A new session starts only when the gap between two consecutive detections is
    greater than the configured threshold.
    """
    safe_gap = max(1, int(gap_seconds or ATTENDANCE_VISIT_SESSION_GAP_SECONDS))
    ordered = sorted(
        [item for item in items if _extract_timestamp(item) is not None],
        key=lambda item: (_extract_timestamp(item) or datetime.min, getattr(item, "id", 0) or 0),
    )
    sessions: list[list[Any]] = []
    for item in ordered:
        ts = _extract_timestamp(item)
        if ts is None:
            continue
        if not sessions:
            sessions.append([item])
            continue
        last_item = sessions[-1][-1]
        last_ts = _extract_timestamp(last_item)
        if last_ts is None or (ts - last_ts).total_seconds() > safe_gap:
            sessions.append([item])
            continue
        sessions[-1].append(item)
    return sessions
