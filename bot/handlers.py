from __future__ import annotations

from datetime import date
from typing import Any, Tuple

from bot.formatters import (
    format_daily_attendance_summary,
    format_month_calendar_message,
    format_month_day_detail,
    format_employee_profile,
    format_monthly_attendance_summary,
    build_month_calendar_keyboard,
)
from bot.i18n import build_language_keyboard, build_main_menu_keyboard, get_message, normalize_language
from bot.services.attendance import get_employee_attendance_details, get_employee_today_summary
from bot.services.bindings import delete_binding, get_binding, upsert_binding
from bot.services.employee_lookup import find_employee_by_personal_id

SELECT_LANGUAGE, ENTER_ID, AUTH_MENU = range(3)


def _telegram_ids(update: Any) -> Tuple[str, str]:
    user = getattr(update, "effective_user", None)
    chat = getattr(update, "effective_chat", None)
    user_id = str(getattr(user, "id", "") or "").strip()
    chat_id = str(getattr(chat, "id", "") or "").strip()
    return user_id, chat_id


def _current_language(update: Any, context: Any) -> str:
    binding = get_binding(_telegram_ids(update)[0])
    persisted = getattr(binding, "language", None)
    if persisted:
        return normalize_language(persisted, fallback="uz")
    return normalize_language(context.user_data.get("lang", "uz"))


def _looks_like_personal_id(value: str) -> bool:
    clean = (value or "").strip()
    return clean.isdigit() and 4 <= len(clean) <= 12


async def _send_profile_card(message_obj: Any, employee: Any, language: str) -> None:
    await message_obj.reply_text(format_employee_profile(employee, language), reply_markup=build_main_menu_keyboard(language))


async def start(update: Any, context: Any) -> int:
    context.user_data.clear()
    default_language = normalize_language(context.application.bot_data.get("default_language", "uz"))
    user_id, chat_id = _telegram_ids(update)

    binding = get_binding(user_id)
    language = normalize_language(getattr(binding, "language", None), fallback=default_language)
    context.user_data["lang"] = language

    if binding is not None and binding.employee is not None and update.message:
        context.user_data["employee_id"] = binding.employee.id
        context.user_data["personal_id"] = binding.employee.personal_id
        upsert_binding(user_id, chat_id, language, binding.employee.id)
        context.user_data["awaiting_id"] = False
        await _send_profile_card(update.message, binding.employee, language)
        return AUTH_MENU

    if update.message:
        await update.message.reply_text(
            get_message(language, "welcome"),
            reply_markup=build_language_keyboard(),
        )
    return SELECT_LANGUAGE


async def choose_language(update: Any, context: Any) -> int:
    query = update.callback_query
    if query is None or query.data is None:
        return SELECT_LANGUAGE

    await query.answer()
    language = normalize_language(query.data.split(":", 1)[-1], fallback="uz")
    context.user_data["lang"] = language

    user_id, chat_id = _telegram_ids(update)
    existing = get_binding(user_id)
    employee_id = existing.employee_id if existing is not None else None
    upsert_binding(user_id, chat_id, language, employee_id)

    if existing is not None and existing.employee is not None:
        context.user_data["awaiting_id"] = False
        await query.edit_message_text(get_message(language, "language_updated"))
        if query.message:
            await _send_profile_card(query.message, existing.employee, language)
        return AUTH_MENU

    context.user_data["awaiting_id"] = True
    await query.edit_message_text(get_message(language, "selected_language"))
    if query.message:
        await query.message.reply_text(get_message(language, "enter_id"))
    return ENTER_ID


async def handle_id(update: Any, context: Any) -> int:
    language = normalize_language(context.user_data.get("lang", "uz"))
    if not update.message:
        return ENTER_ID

    personal_id = (update.message.text or "").strip()
    if not personal_id:
        await update.message.reply_text(get_message(language, "invalid_id"))
        return ENTER_ID

    user_id, chat_id = _telegram_ids(update)
    existing = get_binding(user_id)
    awaiting_id = bool(context.user_data.get("awaiting_id"))
    if existing is not None and existing.employee_id is not None and not awaiting_id:
        return await handle_menu_text(update, context)

    if not _looks_like_personal_id(personal_id):
        await update.message.reply_text(get_message(language, "invalid_id"))
        return ENTER_ID

    employee = find_employee_by_personal_id(personal_id)
    if employee is None:
        await update.message.reply_text(get_message(language, "not_found"))
        return ENTER_ID

    context.user_data["employee_id"] = employee.id
    context.user_data["personal_id"] = employee.personal_id
    context.user_data["awaiting_id"] = False

    upsert_binding(user_id, chat_id, language, employee.id)

    await _send_profile_card(update.message, employee, language)
    return AUTH_MENU


async def handle_action(update: Any, context: Any) -> int:
    query = update.callback_query
    if query is None or query.data is None:
        return AUTH_MENU

    await query.answer()
    language = _current_language(update, context)
    action = query.data.split(":", 1)[-1]
    user_id, chat_id = _telegram_ids(update)

    if action == "change_language":
        await query.edit_message_text(get_message(language, "welcome"), reply_markup=build_language_keyboard())
        return SELECT_LANGUAGE

    if action == "logout":
        delete_binding(user_id)
        context.user_data.clear()
        await query.edit_message_text(get_message(language, "logout_done"), reply_markup=build_language_keyboard())
        return SELECT_LANGUAGE

    return AUTH_MENU


async def show_today(update: Any, context: Any) -> int:
    language = _current_language(update, context)
    user_id, _ = _telegram_ids(update)
    binding = get_binding(user_id)
    if binding is None or binding.employee_id is None or update.message is None:
        if update.message:
            await update.message.reply_text(get_message(language, "unknown_state"))
        return SELECT_LANGUAGE

    summary = get_employee_today_summary(binding.employee_id, date.today())
    if summary is None:
        await update.message.reply_text(get_message(language, "not_found"))
        return AUTH_MENU

    await update.message.reply_text(format_daily_attendance_summary(summary, language), reply_markup=build_main_menu_keyboard(language))
    return AUTH_MENU


async def show_month(update: Any, context: Any) -> int:
    language = _current_language(update, context)
    user_id, _ = _telegram_ids(update)
    binding = get_binding(user_id)
    if binding is None or binding.employee_id is None or update.message is None:
        if update.message:
            await update.message.reply_text(get_message(language, "unknown_state"))
        return SELECT_LANGUAGE

    details = get_employee_attendance_details(binding.employee_id, date.today())
    if details is None:
        await update.message.reply_text(get_message(language, "not_found"))
        return AUTH_MENU

    await update.message.reply_text(
        format_month_calendar_message(details.month_summary, language, selected_day=None),
        reply_markup=build_month_calendar_keyboard(details.days, details.month_summary.year, details.month_summary.month, language),
    )
    return AUTH_MENU


async def show_profile(update: Any, context: Any) -> int:
    language = _current_language(update, context)
    user_id, _ = _telegram_ids(update)
    binding = get_binding(user_id)
    if binding is None or binding.employee is None or update.message is None:
        if update.message:
            await update.message.reply_text(get_message(language, "unknown_state"))
        return SELECT_LANGUAGE

    await update.message.reply_text(format_employee_profile(binding.employee, language), reply_markup=build_main_menu_keyboard(language))
    return AUTH_MENU


async def handle_menu_text(update: Any, context: Any) -> int:
    if not update.message:
        return AUTH_MENU

    language = _current_language(update, context)
    text = (update.message.text or "").strip()
    if not text:
        return AUTH_MENU

    if text == get_message(language, "menu_profile"):
        return await show_profile(update, context)
    if text == get_message(language, "menu_today"):
        return await show_today(update, context)
    if text == get_message(language, "menu_month"):
        return await show_month(update, context)
    if text == get_message(language, "menu_language"):
        return await _show_language_selection(update, context)
    if text == get_message(language, "menu_logout"):
        return await _do_logout(update, context)

    user_id, _ = _telegram_ids(update)
    binding = get_binding(user_id)
    if bool(context.user_data.get("awaiting_id")):
        return await handle_id(update, context)
    if binding is not None and binding.employee is not None:
        if update.message:
            await update.message.reply_text(get_message(language, "menu_title"), reply_markup=build_main_menu_keyboard(language))
        return AUTH_MENU
    return SELECT_LANGUAGE


async def handle_calendar_action(update: Any, context: Any) -> int:
    query = update.callback_query
    if query is None or query.data is None:
        return AUTH_MENU

    await query.answer()
    language = _current_language(update, context)
    parts = query.data.split(":", 2)
    if len(parts) < 3 or parts[1] != "day":
        return AUTH_MENU

    day_label = parts[2]
    user_id, _ = _telegram_ids(update)
    binding = get_binding(user_id)
    if binding is None or binding.employee_id is None:
        return SELECT_LANGUAGE

    details = get_employee_attendance_details(binding.employee_id, date.today())
    if details is None:
        return AUTH_MENU

    selected_day = next((item for item in details.days if item.date_label == day_label), None)
    if selected_day is None:
        return AUTH_MENU

    if query.message is not None:
        await query.edit_message_text(
            text=format_month_calendar_message(details.month_summary, language, selected_day=selected_day),
            reply_markup=build_month_calendar_keyboard(details.days, details.month_summary.year, details.month_summary.month, language),
        )
    return AUTH_MENU


async def handle_calendar_noop(update: Any, context: Any) -> int:
    query = update.callback_query
    if query is not None:
        await query.answer()
    return AUTH_MENU


async def _show_language_selection(update: Any, context: Any) -> int:
    language = _current_language(update, context)
    if update.message:
        await update.message.reply_text(get_message(language, "welcome"), reply_markup=build_language_keyboard())
    return SELECT_LANGUAGE



async def _do_logout(update: Any, context: Any) -> int:
    language = _current_language(update, context)
    user_id, _ = _telegram_ids(update)
    delete_binding(user_id)
    context.user_data.clear()
    if update.message:
        await update.message.reply_text(get_message(language, "logout_done"), reply_markup=build_language_keyboard())
    return SELECT_LANGUAGE


async def logout(update: Any, context: Any) -> int:
    return await _do_logout(update, context)


async def unknown_state(update: Any, context: Any) -> int:
    language = normalize_language(context.user_data.get("lang", "uz"))
    if update.message:
        await update.message.reply_text(get_message(language, "unknown_state"))
    return SELECT_LANGUAGE

