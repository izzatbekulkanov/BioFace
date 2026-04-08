from __future__ import annotations

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup

LANGUAGE_LABELS = {
    "uz": "O'zbekcha",
    "ru": "Русский",
}

MESSAGES = {
    "uz": {
        "welcome": "BioFace botiga xush kelibsiz. Davom etish uchun tilni tanlang.",
        "selected_language": "Til tanlandi. Endi ID ni kiriting.",
        "enter_id": "Iltimos, ID ni kiriting.",
        "invalid_id": "ID bo'sh bo'lmasligi kerak. Qaytadan kiriting.",
        "not_found": "Ushbu ID bo'yicha foydalanuvchi topilmadi. Iltimos, ID ni tekshirib qayta yuboring.",
        "profile_title": "Foydalanuvchi ma'lumotlari",
        "logout": "Siz tizimdan chiqdingiz. Qayta kirish uchun /start bosing.",
        "unknown_state": "Boshlash uchun /start buyrug'ini bosing.",
        "access_yes": "Ha",
        "access_no": "Yo'q",
        "field_full_name": "F.I.Sh.",
        "field_personal_id": "ID",
        "field_department": "Bo'lim",
        "field_position": "Lavozim",
        "field_employee_type": "Turi",
        "field_organization": "Tashkilot",
        "field_access": "Kirish ruxsati",
        "field_start_time": "Boshlanish vaqti",
        "field_end_time": "Tugash vaqti",
        "field_created_at": "Yaratilgan sana",
        "today_summary_title": "Bugungi davomat",
        "month_summary_title": "Joriy oy davomati",
        "camera_event_title": "Kamera orqali o'tdingiz",
        "summary_date": "Sana",
        "summary_status": "Holat",
        "summary_total_events": "Jami kirishlar",
        "summary_first_seen": "Birinchi kirish",
        "summary_last_seen": "Oxirgi chiqish",
        "summary_late": "Kechikish",
        "summary_worked": "Binoda bo'lgan vaqt",
        "summary_cameras": "Kameralar",
        "summary_year_month": "Oy",
        "summary_present_days": "Kelgan kunlar",
        "summary_absent_days": "Kelmagan kunlar",
        "summary_late_days": "Kech kelgan kunlar",
        "summary_avg_late": "O'rtacha kechikish",
        "summary_total_late": "Jami kechikish",
        "summary_camera_name": "Kamera",
        "summary_time": "Vaqt",
        "day_detail_title": "Kun tafsiloti",
        "status_present": "Kelgan",
        "status_late": "Kech kelgan",
        "status_absent": "Kelmagan",
        "calendar_legend": "Legenda: yashil = kelgan, sariq = kech kelgan, qizil = kelmagan",
        "weekday_mon": "D",
        "weekday_tue": "S",
        "weekday_wed": "C",
        "weekday_thu": "P",
        "weekday_fri": "J",
        "weekday_sat": "Sh",
        "weekday_sun": "Ya",
        "actions_hint": "Kerakli amalni tanlang:",
        "menu_profile": "Profil",
        "menu_today": "Bugun",
        "menu_month": "Oy",
        "menu_language": "Til",
        "menu_logout": "Chiqish",
        "menu_title": "Asosiy menyu",
        "switch_id_prompt": "Yangi ID ni kiriting.",
        "language_updated": "Til yangilandi.",
        "logout_done": "Siz tizimdan chiqdingiz. Qayta kirish uchun tilni tanlang.",
    },
    "ru": {
        "welcome": "Добро пожаловать в бот BioFace. Выберите язык, чтобы продолжить.",
        "selected_language": "Язык выбран. Теперь введите ID.",
        "enter_id": "Пожалуйста, введите ID.",
        "invalid_id": "ID не должен быть пустым. Отправьте его ещё раз.",
        "not_found": "Пользователь с таким ID не найден. Проверьте ID и отправьте его ещё раз.",
        "profile_title": "Данные пользователя",
        "logout": "Вы вышли из системы. Для повторного входа нажмите /start.",
        "unknown_state": "Нажмите /start, чтобы начать.",
        "access_yes": "Да",
        "access_no": "Нет",
        "field_full_name": "Ф.И.О.",
        "field_personal_id": "ID",
        "field_department": "Отдел",
        "field_position": "Должность",
        "field_employee_type": "Тип",
        "field_organization": "Организация",
        "field_access": "Доступ",
        "field_start_time": "Время начала",
        "field_end_time": "Время окончания",
        "field_created_at": "Дата создания",
        "today_summary_title": "Сегодняшняя посещаемость",
        "month_summary_title": "Посещаемость за текущий месяц",
        "camera_event_title": "Вы прошли через камеру",
        "summary_date": "Дата",
        "summary_status": "Статус",
        "summary_total_events": "Всего входов",
        "summary_first_seen": "Первый вход",
        "summary_last_seen": "Последний выход",
        "summary_late": "Опоздание",
        "summary_worked": "Отработанное время",
        "summary_cameras": "Камеры",
        "summary_year_month": "Месяц",
        "summary_present_days": "Дней присутствия",
        "summary_absent_days": "Дней отсутствия",
        "summary_late_days": "Дней с опозданием",
        "summary_avg_late": "Среднее опоздание",
        "summary_total_late": "Общее опоздание",
        "summary_camera_name": "Камера",
        "summary_time": "Время",
        "day_detail_title": "Детали дня",
        "status_present": "Присутствовал",
        "status_late": "Опоздал",
        "status_absent": "Отсутствовал",
        "calendar_legend": "Легенда: зелёный = присутствовал, жёлтый = опоздал, красный = отсутствовал",
        "weekday_mon": "Пн",
        "weekday_tue": "Вт",
        "weekday_wed": "Ср",
        "weekday_thu": "Чт",
        "weekday_fri": "Пт",
        "weekday_sat": "Сб",
        "weekday_sun": "Вс",
        "actions_hint": "Выберите действие:",
        "menu_profile": "Профиль",
        "menu_today": "Сегодня",
        "menu_month": "Месяц",
        "menu_language": "Язык",
        "menu_logout": "Выйти",
        "menu_title": "Главное меню",
        "switch_id_prompt": "Введите новый ID.",
        "language_updated": "Язык обновлён.",
        "logout_done": "Вы вышли из системы. Для повторного входа выберите язык.",
    },
}


def normalize_language(language: str | None, fallback: str = "uz") -> str:
    candidate = (language or "").strip().lower()
    return candidate if candidate in MESSAGES else fallback if fallback in MESSAGES else "uz"


def get_message(language: str | None, key: str, **kwargs) -> str:
    lang = normalize_language(language)
    template = MESSAGES[lang].get(key) or MESSAGES["uz"].get(key) or key
    return template.format(**kwargs)


def build_language_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(LANGUAGE_LABELS["uz"], callback_data="lang:uz"),
                InlineKeyboardButton(LANGUAGE_LABELS["ru"], callback_data="lang:ru"),
            ]
        ]
    )



def build_main_menu_keyboard(language: str | None) -> ReplyKeyboardMarkup:
    lang = normalize_language(language)
    return ReplyKeyboardMarkup(
        [
            [KeyboardButton(get_message(lang, "menu_profile")), KeyboardButton(get_message(lang, "menu_today"))],
            [KeyboardButton(get_message(lang, "menu_month")), KeyboardButton(get_message(lang, "menu_language"))],
            [KeyboardButton(get_message(lang, "menu_logout"))],
        ],
        resize_keyboard=True,
        is_persistent=True,
    )


