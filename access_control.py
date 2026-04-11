from __future__ import annotations

import json
import re
from typing import Any, Iterable

from models import UserRole


MENU_PERMISSION_METADATA = [
    {
        "key": "dashboard",
        "group": "general",
        "titles": {"uz": "Boshqaruv paneli", "ru": "Панель управления"},
        "descriptions": {"uz": "Asosiy dashboard va umumiy statistika", "ru": "Главный дашборд и общая статистика"},
    },
    {
        "key": "devices",
        "group": "cameras",
        "titles": {"uz": "Kameralar", "ru": "Камеры"},
        "descriptions": {"uz": "Kamera ro'yxati va sozlamalari", "ru": "Список камер и их настройки"},
    },
    {
        "key": "commands",
        "group": "cameras",
        "titles": {"uz": "Kamera buyruqlari", "ru": "Команды камеры"},
        "descriptions": {"uz": "Kameraga yuboriladigan buyruqlar", "ru": "Команды, отправляемые на камеры"},
    },
    {
        "key": "employees",
        "group": "employees",
        "titles": {"uz": "Xodimlar", "ru": "Сотрудники"},
        "descriptions": {"uz": "Xodimlar kartalari va ma'lumotlari", "ru": "Карточки и данные сотрудников"},
    },
    {
        "key": "attendance",
        "group": "employees",
        "titles": {"uz": "Davomat", "ru": "Посещаемость"},
        "descriptions": {"uz": "Jonli va saqlangan davomat yozuvlari", "ru": "Живая и сохраненная посещаемость"},
    },
    {
        "key": "sync_attendance",
        "group": "employees",
        "titles": {"uz": "Sinxron davomat", "ru": "Синхронная посещаемость"},
        "descriptions": {"uz": "Kameradan davomatni qo'lda sinxronlash", "ru": "Ручная синхронизация посещаемости с камер"},
    },
    {
        "key": "psychological_portrait",
        "group": "employees",
        "titles": {"uz": "Psixologik portret", "ru": "Психологический портрет"},
        "descriptions": {"uz": "AI holat profillari va foizlari", "ru": "AI-профили состояний и проценты"},
    },
    {
        "key": "reports",
        "group": "employees",
        "titles": {"uz": "Hisobotlar", "ru": "Отчеты"},
        "descriptions": {"uz": "Kechikish va faoliyat hisobotlari", "ru": "Отчеты по опозданиям и активности"},
    },
    {
        "key": "organizations",
        "group": "management",
        "titles": {"uz": "Tashkilotlar", "ru": "Организации"},
        "descriptions": {"uz": "Tashkilotlarni boshqarish", "ru": "Управление организациями"},
    },
    {
        "key": "users",
        "group": "management",
        "titles": {"uz": "Foydalanuvchilar", "ru": "Пользователи"},
        "descriptions": {"uz": "Tizim foydalanuvchilari va rollari", "ru": "Системные пользователи и роли"},
    },
    {
        "key": "user_approvals",
        "group": "management",
        "titles": {"uz": "Tasdiqlash navbati", "ru": "Очередь подтверждения"},
        "descriptions": {"uz": "Google orqali kirgan tasdiqlanmagan foydalanuvchilar", "ru": "Пользователи, вошедшие через Google и ожидающие подтверждения"},
    },
    {
        "key": "settings",
        "group": "management",
        "titles": {"uz": "Sozlamalar", "ru": "Настройки"},
        "descriptions": {"uz": "Umumiy tizim sozlamalari", "ru": "Общие системные настройки"},
    },
    {
        "key": "isup_server",
        "group": "system",
        "titles": {"uz": "ISUP server", "ru": "ISUP сервер"},
        "descriptions": {"uz": "ISUP holati va integratsiya boshqaruvi", "ru": "Состояние ISUP и управление интеграцией"},
    },
    {
        "key": "redis_monitor",
        "group": "system",
        "titles": {"uz": "Redis monitor", "ru": "Монитор Redis"},
        "descriptions": {"uz": "Redis holati va navbatlar", "ru": "Состояние Redis и очереди"},
    },
    {
        "key": "middleware_logs",
        "group": "system",
        "titles": {"uz": "Tizim loglari", "ru": "Системные логи"},
        "descriptions": {"uz": "HTTP va middleware loglari", "ru": "HTTP и middleware-логи"},
    },
    {
        "key": "api_helper",
        "group": "system",
        "titles": {"uz": "API helper", "ru": "API helper"},
        "descriptions": {"uz": "Texnik API yordamchi sahifa", "ru": "Техническая страница API helper"},
    },
    {
        "key": "about",
        "group": "general",
        "titles": {"uz": "Tizim haqida", "ru": "О системе"},
        "descriptions": {"uz": "Platforma haqida ma'lumot", "ru": "Информация о платформе"},
    },
]

PERMISSION_GROUP_TITLES = {
    "general": {"uz": "Umumiy", "ru": "Общее"},
    "cameras": {"uz": "Kameralar", "ru": "Камеры"},
    "employees": {"uz": "Xodimlar", "ru": "Сотрудники"},
    "management": {"uz": "Boshqaruv", "ru": "Управление"},
    "system": {"uz": "Tizim", "ru": "Система"},
}

MENU_PERMISSION_KEYS = [item["key"] for item in MENU_PERMISSION_METADATA]
ALL_MENU_PERMISSIONS = tuple(MENU_PERMISSION_KEYS)
LIMITED_ADMIN_DEFAULTS = (
    "dashboard",
    "devices",
    "commands",
    "employees",
    "attendance",
    "sync_attendance",
    "psychological_portrait",
    "reports",
    "user_approvals",
    "settings",
    "about",
)

ROLE_DEFAULT_MENU_KEYS = {
    UserRole.super_admin: ALL_MENU_PERMISSIONS,
    UserRole.mahalla_admin: LIMITED_ADMIN_DEFAULTS,
    UserRole.maktab_admin: LIMITED_ADMIN_DEFAULTS,
    UserRole.kollej_admin: LIMITED_ADMIN_DEFAULTS,
    UserRole.tashkilot_admin: LIMITED_ADMIN_DEFAULTS,
    UserRole.korxona_admin: LIMITED_ADMIN_DEFAULTS,
}

_PATH_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"^/api/cameras/\d+/command(?:/|$)"), "commands"),
    (re.compile(r"^/api/dashboard(?:/|$)"), "dashboard"),
    (re.compile(r"^/$"), "dashboard"),
    (re.compile(r"^/devices(?:/|$)"), "devices"),
    (re.compile(r"^/api/cameras(?:/|$)"), "devices"),
    (re.compile(r"^/commands(?:/|$)"), "commands"),
    (re.compile(r"^/employees(?:/|$)"), "employees"),
    (re.compile(r"^/api/employees(?:/|$)"), "employees"),
    (re.compile(r"^/attendance(?:/|$)"), "attendance"),
    (re.compile(r"^/attendance-sync(?:/|$)"), "sync_attendance"),
    (re.compile(r"^/psixologik-portret(?:/|$)"), "psychological_portrait"),
    (re.compile(r"^/reports(?:/|$)"), "reports"),
    (re.compile(r"^/organizations(?:/|$)"), "organizations"),
    (re.compile(r"^/api/organizations(?:/|$)"), "organizations"),
    # Keep approval APIs ahead of the generic /api/users matcher.
    (re.compile(r"^/api/users/pending(?:/|$)"), "user_approvals"),
    (re.compile(r"^/api/users/\d+/approve(?:/|$)"), "user_approvals"),
    (re.compile(r"^/users(?:/|$)"), "users"),
    (re.compile(r"^/api/users(?:/|$)"), "users"),
    (re.compile(r"^/user-approvals(?:/|$)"), "user_approvals"),
    (re.compile(r"^/settings(?:/|$)"), "settings"),
    (re.compile(r"^/api/settings(?:/|$)"), "settings"),
    (re.compile(r"^/api/menu_settings(?:/|$)"), "settings"),
    (re.compile(r"^/api/telegram(?:/|$)"), "settings"),
    (re.compile(r"^/isup-server(?:/|$)"), "isup_server"),
    (re.compile(r"^/api/isup(?:/|$)"), "isup_server"),
    (re.compile(r"^/api/isup-health(?:/|$)"), "isup_server"),
    (re.compile(r"^/api/isup-traces(?:/|$)"), "isup_server"),
    (re.compile(r"^/api/isup-sdk-status(?:/|$)"), "isup_server"),
    (re.compile(r"^/redis(?:/|$)"), "redis_monitor"),
    (re.compile(r"^/api/redis(?:/|$)"), "redis_monitor"),
    (re.compile(r"^/middleware-logs(?:/|$)"), "middleware_logs"),
    (re.compile(r"^/api/middleware-logs(?:/|$)"), "middleware_logs"),
    (re.compile(r"^/api-helper(?:/|$)"), "api_helper"),
    (re.compile(r"^/about(?:/|$)"), "about"),
]


def all_menu_permissions() -> list[str]:
    return list(ALL_MENU_PERMISSIONS)


def normalize_role_value(value: Any) -> str:
    if isinstance(value, UserRole):
        return value.value
    return str(value or "").strip()


def get_role_default_menu_permissions(role: Any) -> list[str]:
    normalized = normalize_role_value(role)
    for enum_value, permissions in ROLE_DEFAULT_MENU_KEYS.items():
        if enum_value.value == normalized:
            return [key for key in permissions if key in MENU_PERMISSION_KEYS]
    return list(LIMITED_ADMIN_DEFAULTS)


def serialize_menu_permissions(values: Iterable[Any]) -> str:
    normalized = normalize_menu_permissions(values)
    return json.dumps(normalized, ensure_ascii=True)


def deserialize_menu_permissions(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return normalize_menu_permissions(value)

    raw = str(value or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return normalize_menu_permissions(parsed)
    except Exception:
        pass
    return normalize_menu_permissions(chunk.strip() for chunk in raw.split(","))


def normalize_menu_permissions(values: Iterable[Any]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in values:
        key = str(item or "").strip()
        if not key or key not in MENU_PERMISSION_KEYS or key in seen:
            continue
        seen.add(key)
        result.append(key)
    return result


def resolve_user_menu_permissions(*, role: Any, stored_permissions: Any) -> list[str]:
    if normalize_role_value(role) == UserRole.super_admin.value:
        return list(ALL_MENU_PERMISSIONS)
    explicit = deserialize_menu_permissions(stored_permissions)
    if explicit:
        return explicit
    return get_role_default_menu_permissions(role)


def user_has_menu_access(menu_permissions: Iterable[Any], menu_key: str | None) -> bool:
    if not menu_key:
        return True
    allowed = set(normalize_menu_permissions(menu_permissions))
    return menu_key in allowed


def resolve_menu_key_for_path(path: str) -> str | None:
    normalized = str(path or "").strip() or "/"
    for pattern, menu_key in _PATH_RULES:
        if pattern.match(normalized):
            return menu_key
    return None


def filter_menu_structure_by_permissions(menu_list: list[dict[str, Any]], menu_permissions: Iterable[Any]) -> list[dict[str, Any]]:
    allowed = set(normalize_menu_permissions(menu_permissions))
    result: list[dict[str, Any]] = []
    pending_group: dict[str, Any] | None = None
    pending_group_emitted = False

    for item in menu_list:
        item_type = str(item.get("type") or "")
        if item_type == "group":
            pending_group = item
            pending_group_emitted = False
            continue

        if item_type != "link":
            continue

        if item.get("key") not in allowed:
            continue

        if pending_group is not None and not pending_group_emitted:
            result.append(pending_group)
            pending_group_emitted = True
        result.append(item)

    return result


def build_permission_groups(language: str = "uz") -> list[dict[str, Any]]:
    lang = "ru" if str(language or "").strip().lower() == "ru" else "uz"
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in MENU_PERMISSION_METADATA:
        grouped.setdefault(item["group"], []).append(
            {
                "key": item["key"],
                "title": item["titles"][lang],
                "description": item["descriptions"][lang],
            }
        )

    result: list[dict[str, Any]] = []
    for group_key in ("general", "cameras", "employees", "management", "system"):
        items = grouped.get(group_key) or []
        if not items:
            continue
        result.append(
            {
                "key": group_key,
                "title": PERMISSION_GROUP_TITLES[group_key][lang],
                "items": items,
            }
        )
    return result
