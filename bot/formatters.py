from __future__ import annotations

import calendar
from datetime import datetime

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

from bot.i18n import get_message
from bot.services.attendance import DailyAttendanceSummary, MonthlyAttendanceDay, MonthlyAttendanceSummary


def _format_value(value: object | None) -> str:
    if value is None:
        return "—"
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    text = str(value).strip()
    return text if text else "—"


def _format_event_timestamp(value: object | None) -> str:
    if value is None:
        return "—"
    if isinstance(value, datetime):
        return value.strftime("%d.%m.%Y %H:%M:%S")

    text = str(value).strip()
    if not text:
        return "—"

    normalized = text.replace("Z", "+00:00")
    for candidate in (normalized, text):
        try:
            dt = datetime.fromisoformat(candidate)
            if dt.tzinfo is not None:
                dt = dt.astimezone()
            return dt.strftime("%d.%m.%Y %H:%M:%S")
        except Exception:
            continue
    return text


def _format_duration_hms(seconds: int | None) -> str:
    total = max(0, int(seconds or 0))
    hours = total // 3600
    minutes = (total % 3600) // 60
    secs = total % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def _status_label(language: str, status: str) -> str:
    status = (status or "").lower().strip()
    if status == "present":
        return get_message(language, "status_present")
    if status == "late":
        return get_message(language, "status_late")
    return get_message(language, "status_absent")


def _status_emoji(status: str) -> str:
    normalized = (status or "").strip().lower()
    if normalized == "present":
        return "✅"
    if normalized == "late":
        return "⚠️"
    return "❌"


def format_employee_profile(employee, language: str = "uz") -> str:
    full_name = " ".join(
        part for part in [employee.first_name, employee.last_name, employee.middle_name] if part and str(part).strip()
    )
    organization_name = None
    default_start_time = None
    default_end_time = None
    if getattr(employee, "organization", None) is not None:
        organization_name = getattr(employee.organization, "name", None)
        default_start_time = getattr(employee.organization, "default_start_time", None)
        default_end_time = getattr(employee.organization, "default_end_time", None)

    start_time = employee.start_time if str(employee.start_time or "").strip() else default_start_time
    end_time = employee.end_time if str(employee.end_time or "").strip() else default_end_time

    access_label = get_message(language, "access_yes") if employee.has_access else get_message(language, "access_no")

    lines = [
        f"{get_message(language, 'profile_title')}",
        "",
        f"{get_message(language, 'field_full_name')}: {_format_value(full_name)}",
        f"{get_message(language, 'field_personal_id')}: {_format_value(employee.personal_id)}",
        f"{get_message(language, 'field_employee_type')}: {_format_value(employee.employee_type)}",
        f"{get_message(language, 'field_organization')}: {_format_value(organization_name)}",
        f"{get_message(language, 'field_access')}: {access_label}",
        f"{get_message(language, 'field_start_time')}: {_format_value(start_time)}",
        f"{get_message(language, 'field_end_time')}: {_format_value(end_time)}",
    ]
    return "\n".join(lines)


def format_employee_dashboard(employee, daily_summary: DailyAttendanceSummary, monthly_summary: MonthlyAttendanceSummary, language: str = "uz") -> str:
    profile = format_employee_profile(employee, language)
    today = format_daily_attendance_summary(daily_summary, language)
    month = format_monthly_attendance_summary(monthly_summary, language)
    return "\n\n".join([profile, today, month])


def format_daily_attendance_summary(summary: DailyAttendanceSummary, language: str = "uz") -> str:
    status_text = _status_label(language, summary.status)
    status_emoji = _status_emoji(summary.status)
    lines = [
        f"📅 {get_message(language, 'today_summary_title')}",
        "",
        f"🗓 {get_message(language, 'summary_date')}: {_format_value(summary.date_label)}",
        f"{status_emoji} {get_message(language, 'summary_status')}: {status_text}",
        f"🚪 {get_message(language, 'summary_total_events')}: {_format_value(summary.total_events)}",
        f"⏰ {get_message(language, 'summary_first_seen')}: {_format_value(summary.first_seen)}",
        f"🏁 {get_message(language, 'summary_last_seen')}: {_format_value(summary.last_seen)}",
        f"⌛ {get_message(language, 'summary_late')}: {_format_duration_hms(summary.late_seconds)}",
        f"🕒 {get_message(language, 'summary_worked')}: {_format_duration_hms(summary.worked_seconds)}",
    ]
    return "\n".join(lines)


def format_monthly_attendance_summary(summary: MonthlyAttendanceSummary, language: str = "uz") -> str:
    lines = [
        get_message(language, "month_summary_title"),
        "",
        f"{get_message(language, 'summary_year_month')}: {summary.year}-{summary.month:02d}",
        f"{get_message(language, 'summary_present_days')}: {_format_value(summary.present_days)}",
        f"{get_message(language, 'summary_absent_days')}: {_format_value(summary.absent_days)}",
        f"{get_message(language, 'summary_late_days')}: {_format_value(summary.late_days)}",
        f"{get_message(language, 'summary_total_events')}: {_format_value(summary.total_events)}",
        f"{get_message(language, 'summary_avg_late')}: {_format_duration_hms(summary.avg_late_seconds)}",
        f"{get_message(language, 'summary_total_late')}: {_format_duration_hms(summary.total_late_seconds)}",
    ]
    return "\n".join(lines)


def format_camera_event_message(
    employee_name: str,
    timestamp: datetime | str | None,
    language: str = "uz",
    wellbeing_note: str | None = None,
    psychological_state: str | None = None,
    psychological_profile: str | None = None,
) -> str:
    if language == "ru":
        lines = [
            "📸 BioFace",
            "",
            f"👤 Ф.И.О.: {_format_value(employee_name)}",
            f"🕒 Время: {_format_event_timestamp(timestamp)}",
            "✅ Посещаемость отмечена",
        ]
        note_text = str(wellbeing_note or "").strip()
        if note_text:
            lines.extend([
                "",
                f"🧾 Заметка о состоянии: {note_text}",
            ])
        psych_text = str(psychological_state or "").strip()
        if psych_text:
            lines.extend([
                "",
                f"🧠 Психологическое состояние: {psych_text}",
            ])
        profile_text = str(psychological_profile or "").strip()
        if profile_text:
            lines.extend([
                f"📊 Профиль эмоций: {profile_text}",
            ])
        return "\n".join(lines)

    lines = [
        "📸 BioFace",
        "",
        f"👤 F.I.Sh.: {_format_value(employee_name)}",
        f"🕒 Vaqt: {_format_event_timestamp(timestamp)}",
        "✅ Davomat qayd etildi",
    ]
    note_text = str(wellbeing_note or "").strip()
    if note_text:
        lines.extend([
            "",
            f"🧾 Holat eslatmasi: {note_text}",
        ])
    psych_text = str(psychological_state or "").strip()
    if psych_text:
        lines.extend([
            "",
            f"🧠 Psixologik holat: {psych_text}",
        ])
    profile_text = str(psychological_profile or "").strip()
    if profile_text:
        lines.extend([
            f"📊 Emotsiya profili: {profile_text}",
        ])
    return "\n".join(lines)


def format_month_calendar_message(
    summary: MonthlyAttendanceSummary,
    language: str = "uz",
    selected_day: MonthlyAttendanceDay | None = None,
) -> str:
    lines = [
        get_message(language, "month_summary_title"),
        "",
        f"{get_message(language, 'summary_year_month')}: {summary.year}-{summary.month:02d}",
        f"{get_message(language, 'summary_present_days')}: {_format_value(summary.present_days)}",
        f"{get_message(language, 'summary_absent_days')}: {_format_value(summary.absent_days)}",
        f"{get_message(language, 'summary_late_days')}: {_format_value(summary.late_days)}",
        f"{get_message(language, 'summary_total_events')}: {_format_value(summary.total_events)}",
        "",
        get_message(language, "calendar_legend"),
    ]
    if selected_day is not None:
        lines.extend(["", format_month_day_detail(selected_day, language)])
    return "\n".join(lines)


def build_month_calendar_keyboard(days: list[MonthlyAttendanceDay], year: int, month: int, language: str = "uz") -> InlineKeyboardMarkup:
    weekdays = [
        get_message(language, "weekday_mon"),
        get_message(language, "weekday_tue"),
        get_message(language, "weekday_wed"),
        get_message(language, "weekday_thu"),
        get_message(language, "weekday_fri"),
        get_message(language, "weekday_sat"),
        get_message(language, "weekday_sun"),
    ]

    rows: list[list[InlineKeyboardButton]] = [[InlineKeyboardButton(day, callback_data="noop") for day in weekdays]]
    day_map = {item.day: item for item in days}
    weeks = calendar.Calendar(firstweekday=0).monthdayscalendar(year, month)
    for week in weeks:
        row: list[InlineKeyboardButton] = []
        for day_num in week:
            if day_num == 0:
                row.append(InlineKeyboardButton("\u00A0", callback_data="noop"))
                continue
            item = day_map.get(day_num)
            label = f"{day_num:02d}"
            if item is not None:
                if item.status == "present":
                    label = f"🟩{day_num:02d}"
                elif item.status == "late":
                    label = f"🟨{day_num:02d}"
                else:
                    label = f"🟥{day_num:02d}"
            row.append(InlineKeyboardButton(label, callback_data=f"cal:day:{item.date_label if item else f'{year:04d}-{month:02d}-{day_num:02d}'}"))
        rows.append(row)
    return InlineKeyboardMarkup(rows)


def format_month_day_detail(day: MonthlyAttendanceDay, language: str = "uz") -> str:
    lines = [
        get_message(language, "day_detail_title"),
        "",
        f"{get_message(language, 'summary_date')}: {_format_value(day.date_label)}",
        f"{get_message(language, 'summary_status')}: {_status_label(language, day.status)}",
        f"{get_message(language, 'summary_total_events')}: {_format_value(day.event_count)}",
        f"{get_message(language, 'summary_first_seen')}: {_format_value(day.first_seen)}",
        f"{get_message(language, 'summary_last_seen')}: {_format_value(day.last_seen)}",
        f"{get_message(language, 'summary_late')}: {_format_duration_hms(day.late_seconds)}",
        f"{get_message(language, 'summary_worked')}: {_format_duration_hms(day.worked_seconds)}",
    ]
    return "\n".join(lines)


