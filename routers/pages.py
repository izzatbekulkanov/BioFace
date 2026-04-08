from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import APIRouter, Request, Depends
from fastapi.templating import Jinja2Templates
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from database import get_db
from models import Device, Employee, AttendanceLog, EmployeePsychologicalState, Organization, EmployeeCameraLink, User, UserOrganizationLink
from organization_types import get_organization_type_choices, get_organization_type_label
from time_utils import now_tashkent, today_tashkent_range
from system_config import (
    ISUP_ALARM_PORT,
    ISUP_API_PORT,
    ISUP_KEY,
    ISUP_PICTURE_PORT,
    ISUP_REGISTER_PORT,
    REDIS_HOST,
    REDIS_PORT,
    get_isup_public_host,
    get_public_web_base_url,
    normalize_public_web_base_url,
)
from translations import get_translations

router = APIRouter()
templates = Jinja2Templates(directory="templates")

MENU_TITLES = {
    "uz": {
        "dashboard": "Boshqaruv Paneli",
        "devices": "Kameralar Ro'yxati",
        "commands": "Kameraga Buyruqlar",
        "employees": "Xodimlar Ro'yxati",
        "attendance": "Davomat",
        "sync_attendance": "Sinxron Davomat",
        "psychological_portrait": "Psixologik Portret",
        "reports": "Kechikish Hisoboti",
        "settings": "Sozlamalar",
        "about": "Tizim Haqida",
        "group_cameras": "Kameralar",
        "group_employees": "Xodimlar",
        "group_management": "Tashkilotlar",
        "users": "Tizim Foydalanuvchilari",
        "organizations": "Tashkilotlar",
        "isup_server": "ISUP Server",
        "api_helper": "API Helper",
        "redis_monitor": "REDIS",
    },
    "ru": {
        "dashboard": "Управление",
        "devices": "Список камер",
        "commands": "Команды",
        "employees": "Сотрудники",
        "reports": "Опоздания",
        "sync_attendance": "Синхронная посещаемость",
        "psychological_portrait": "Психологический портрет",
        "settings": "Настройки",
        "about": "О системе",
        "group_cameras": "Камеры",
        "group_employees": "Персонал",
        "group_management": "Организации",
        "users": "Системные пользователи",
        "organizations": "Организации",
        "isup_server": "ISUP Сервер",
        "api_helper": "API Helper",
        "redis_monitor": "REDIS",
    },
}

# ─────────────────────────────────────────────
#  DEFAULT MENU STRUCTURE (ORDERED)
# ─────────────────────────────────────────────
DEFAULT_MENU_STRUCTURE = [
    {"type": "link", "key": "dashboard", "href": "/", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>'},
    {"type": "group", "key": "group_cameras"},
    {"type": "link", "key": "devices", "href": "/devices", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>'},
    {"type": "link", "key": "commands", "href": "/commands", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>'},
    {"type": "group", "key": "group_employees"},
    {"type": "link", "key": "employees", "href": "/employees", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>'},
    {"type": "link", "key": "attendance", "href": "/attendance", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10m-11 8h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z"/>'},
    {"type": "link", "key": "sync_attendance", "href": "/attendance-sync", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356-2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0A8.003 8.003 0 015.03 15m14.389 0H15"/>'},
    {"type": "link", "key": "psychological_portrait", "href": "/psixologik-portret", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5h16M4 12h10M4 19h16M18 10l3 2-3 2v-4zM18 17l3 2-3 2v-4z"/>'},
    {"type": "link", "key": "reports", "href": "/reports", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>'},
    {"type": "group", "key": "group_management"},
    {"type": "link", "key": "organizations", "href": "/organizations", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v2H9V7zm0 4h1v2H9v-2zm0 4h1v2H9v-2zm3-8h1v2h-1V7zm0 4h1v2h-1v-2zm0 4h1v2h-1v-2zm3-8h1v2h-1V7zm0 4h1v2h-1v-2zm0 4h1v2h-1v-2z"/>'},
    {"type": "link", "key": "users", "href": "/users", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>'},
    {"type": "link", "key": "settings", "href": "/settings", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>'},
    {"type": "link", "key": "isup_server", "href": "/isup-server", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"/>'},
    {"type": "link", "key": "redis_monitor", "href": "/redis", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7c0-1.657 3.582-3 8-3s8 1.343 8 3-3.582 3-8 3-8-1.343-8-3zm0 5c0 1.657 3.582 3 8 3s8-1.343 8-3m-16 0v5c0 1.657 3.582 3 8 3s8-1.343 8-3v-5"/>'},
    {"type": "link", "key": "api_helper", "href": "/api-helper", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>'},
    {"type": "link", "key": "about", "href": "/about", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'}
]

# ─────────────────────────────────────────────
#  ROUTELAR
# ─────────────────────────────────────────────

from fastapi.responses import JSONResponse

@router.get("/api/set_language")
def set_language(lang: str):
    res = JSONResponse(content={"ok": True})
    res.set_cookie(key="lang", value=lang, max_age=31536000)
    return res


def _format_delay_human(total_minutes: int, lang: str = "uz") -> str:
    safe_minutes = max(0, int(total_minutes or 0))
    hours, minutes = divmod(safe_minutes, 60)
    if lang == "ru":
        if hours > 0:
            return f"{hours} ч {minutes} мин"
        return f"{minutes} мин"
    if hours > 0:
        return f"{hours} soat {minutes} daqiqa"
    return f"{minutes} daqiqa"


def _resolve_reports_org_scope(request: Request, db: Session) -> dict:
    auth_user = request.session.get("auth_user") or {}
    org_ids: set[int] = set()
    user_id = auth_user.get("id")

    if user_id is not None:
        rows = (
            db.query(UserOrganizationLink.organization_id)
            .filter(UserOrganizationLink.user_id == int(user_id))
            .all()
        )
        org_ids.update(int(row.organization_id) for row in rows if row.organization_id is not None)

    fallback_org_id = auth_user.get("organization_id")
    if not org_ids and fallback_org_id is not None:
        org_ids.add(int(fallback_org_id))

    if not org_ids:
        return {"allowed_org_ids": [], "organizations": []}

    org_rows = (
        db.query(Organization.id, Organization.name, Organization.subscription_status, Organization.default_start_time)
        .filter(Organization.id.in_(sorted(org_ids)))
        .order_by(Organization.name.asc())
        .all()
    )

    allowed_org_ids: list[int] = []
    organizations: list[dict] = []
    for org_id, org_name, sub_status, default_start_time in org_rows:
        status = str(sub_status.value if hasattr(sub_status, "value") else sub_status or "").strip().lower()
        if status == "expired":
            continue
        allowed_org_ids.append(int(org_id))
        organizations.append({
            "id": int(org_id),
            "name": str(org_name or ""),
            "default_start_time": str(default_start_time or "09:00"),
        })

    return {"allowed_org_ids": allowed_org_ids, "organizations": organizations}


def _build_reports_rows(
    db: Session,
    *,
    allowed_org_ids: list[int],
    target_day_start: datetime,
    target_day_end: datetime,
    organization_id: int | None = None,
    search: str = "",
    lang: str = "uz",
) -> list[dict]:
    if not allowed_org_ids:
        return []

    employees_query = (
        db.query(Employee)
        .outerjoin(Employee.organization)
        .filter(Employee.organization_id.in_(allowed_org_ids))
    )
    if organization_id is not None:
        employees_query = employees_query.filter(Employee.organization_id == organization_id)

    employees = employees_query.order_by(Employee.last_name.asc(), Employee.first_name.asc(), Employee.id.asc()).all()
    if not employees:
        return []

    employee_ids = [int(emp.id) for emp in employees]
    day_logs = (
        db.query(AttendanceLog)
        .filter(
            AttendanceLog.employee_id.in_(employee_ids),
            AttendanceLog.timestamp >= target_day_start,
            AttendanceLog.timestamp < target_day_end,
        )
        .order_by(AttendanceLog.timestamp.asc(), AttendanceLog.id.asc())
        .all()
    )

    first_log_by_emp: dict[int, AttendanceLog] = {}
    for log in day_logs:
        if log.employee_id is None:
            continue
        emp_id = int(log.employee_id)
        if emp_id not in first_log_by_emp:
            first_log_by_emp[emp_id] = log

    search_query = str(search or "").strip().lower()
    base_url = normalize_public_web_base_url(get_public_web_base_url())
    rows: list[dict] = []

    for emp in employees:
        emp_id = int(emp.id)
        first_log = first_log_by_emp.get(emp_id)
        org = emp.organization

        org_start = (org.default_start_time if org and org.default_start_time else "09:00")
        start_h, start_m = _parse_hhmm_or_default(emp.start_time or org_start, 9, 0)
        expected_start = target_day_start.replace(hour=start_h, minute=start_m, second=0, microsecond=0)

        status_key = "absent"
        arrival_time = None
        delay_minutes = 0
        if first_log and first_log.timestamp:
            arrival_time = first_log.timestamp
            if first_log.timestamp > expected_start:
                status_key = "late"
                delay_minutes = int((first_log.timestamp - expected_start).total_seconds() / 60)
            else:
                continue

        if status_key != "late":
            continue

        full_name = f"{emp.first_name} {emp.middle_name or ''} {emp.last_name}".replace("  ", " ").strip()
        search_text = " ".join([
            full_name,
            str(emp.first_name or ""),
            str(emp.middle_name or ""),
            str(emp.last_name or ""),
            str(emp.department or ""),
            str(emp.position or ""),
            str(org.name if org else ""),
            str(first_log.device.name if first_log and first_log.device else ""),
        ]).lower()
        if search_query and search_query not in search_text:
            continue

        avatar_url = None
        if emp.image_url:
            avatar_url = f"{base_url}{emp.image_url}" if not str(emp.image_url).startswith("http") else str(emp.image_url)

        rows.append({
            "employee_id": emp_id,
            "full_name": full_name,
            "first_name": emp.first_name,
            "middle_name": emp.middle_name,
            "last_name": emp.last_name,
            "department": emp.department,
            "organization_id": emp.organization_id,
            "organization_name": org.name if org else "-",
            "camera": first_log.device.name if first_log and first_log.device else "-",
            "arrival_time": arrival_time.isoformat() if arrival_time else None,
            "expected_time": expected_start.isoformat(),
            "delay_minutes": delay_minutes,
            "delay_human": _format_delay_human(delay_minutes, lang),
            "avatar_url": avatar_url,
            "status_key": status_key,
            "status": "Kech keldi",
            "search_text": search_text,
        })

    # Absent employees are included after late rows so the report shows both problems.
    late_employee_ids = {row["employee_id"] for row in rows}
    for emp in employees:
        emp_id = int(emp.id)
        if emp_id in late_employee_ids:
            continue
        if first_log_by_emp.get(emp_id):
            continue

        org = emp.organization
        org_start = (org.default_start_time if org and org.default_start_time else "09:00")
        start_h, start_m = _parse_hhmm_or_default(emp.start_time or org_start, 9, 0)
        expected_start = target_day_start.replace(hour=start_h, minute=start_m, second=0, microsecond=0)
        full_name = f"{emp.first_name} {emp.middle_name or ''} {emp.last_name}".replace("  ", " ").strip()
        search_text = " ".join([
            full_name,
            str(emp.first_name or ""),
            str(emp.middle_name or ""),
            str(emp.last_name or ""),
            str(emp.department or ""),
            str(emp.position or ""),
            str(org.name if org else ""),
        ]).lower()
        if search_query and search_query not in search_text:
            continue

        avatar_url = None
        if emp.image_url:
            avatar_url = f"{base_url}{emp.image_url}" if not str(emp.image_url).startswith("http") else str(emp.image_url)

        rows.append({
            "employee_id": emp_id,
            "full_name": full_name,
            "first_name": emp.first_name,
            "middle_name": emp.middle_name,
            "last_name": emp.last_name,
            "department": emp.department,
            "organization_id": emp.organization_id,
            "organization_name": org.name if org else "-",
            "camera": "-",
            "arrival_time": None,
            "expected_time": expected_start.isoformat(),
            "delay_minutes": 0,
            "delay_human": "-",
            "avatar_url": avatar_url,
            "status_key": "absent",
            "status": "Kelmadi",
            "search_text": search_text,
        })

    def _reports_sort_key(row: dict) -> tuple:
        full_name = str(row.get("full_name") or "").strip()
        first_token = full_name.split()[0] if full_name else ""
        is_numeric_name = first_token.isdigit()
        name_key = full_name.casefold()
        return (
            0 if row.get("status_key") == "late" else 1,
            1 if is_numeric_name else 0,
            name_key,
            int(row.get("employee_id") or 0),
        )

    rows.sort(key=_reports_sort_key)
    return rows


def get_menus_dict(request: Request) -> dict:
    import copy
    from menu_utils import get_menu_data
    
    lang = request.cookies.get("lang", "uz")
    defaults = MENU_TITLES["ru" if lang == "ru" else "uz"]
    
    # default names to fall back
    res = {
        "dashboard": "Boshqaruv Paneli" if lang == "uz" else "Управление",
        "devices": "Kameralar Ro'yxati" if lang == "uz" else "Список камер",
        "events": "Kamera Hodisalari" if lang == "uz" else "События",
        "commands": "Kameraga Buyruqlar" if lang == "uz" else "Команды",
        "employees": "Xodimlar Ro'yxati" if lang == "uz" else "Сотрудники",
        "sync_attendance": "Sinxron Davomat" if lang == "uz" else "Синхронная посещаемость",
        "reports": "Kechikish Hisoboti" if lang == "uz" else "Опоздания",
        "settings": "Sozlamalar" if lang == "uz" else "Настройки",
        "about": "Tizim Haqida" if lang == "uz" else "О системе",
        "group_cameras": "Kameralar" if lang == "uz" else "Камеры",
        "group_employees": "Xodimlar" if lang == "uz" else "Персонал",
        "group_management": "Tashkilotlar" if lang == "uz" else "Организации",
        "users": "Tizim Foydalanuvchilari" if lang == "uz" else "Системные пользователи",
        "isup_server": "ISUP Server" if lang == "uz" else "ISUP Сервер"
    }

    res = dict(defaults)
    menu_list = copy.deepcopy(DEFAULT_MENU_STRUCTURE)
    
    # Get JSON data
    saved_data = get_menu_data() 
    saved_menus = saved_data.get("menus", {})
    saved_order = saved_data.get("order", [])

    for idx, item in enumerate(menu_list):
        key = item["key"]
        
        # Determine title
        fallback_uz = "Boshqaruv Paneli" if key == "dashboard" else ("Kameralar Ro'yxati" if key == "devices" else ("Kamera Hodisalari" if key == "events" else ("Kameraga Buyruqlar" if key == "commands" else ("Xodimlar Ro'yxati" if key == "employees" else ("Sinxron Davomat" if key == "sync_attendance" else ("Kechikish Hisoboti" if key == "reports" else ("Sozlamalar" if key == "settings" else ("Tizim Haqida" if key == "about" else ("ISUP Server" if key == "isup_server" else ("Kameralar" if key == "group_cameras" else ("Xodimlar" if key == "group_employees" else ("Tizim Foydalanuvchilari" if key == "users" else "Tashkilotlar"))))))))))))
        fallback_ru = "Управление" if key == "dashboard" else ("Список камер" if key == "devices" else ("События" if key == "events" else ("Команды" if key == "commands" else ("Сотрудники" if key == "employees" else ("Синхронная посещаемость" if key == "sync_attendance" else ("Опоздания" if key == "reports" else ("Настройки" if key == "settings" else ("О системе" if key == "about" else ("ISUP Сервер" if key == "isup_server" else ("Камеры" if key == "group_cameras" else ("Персонал" if key == "group_employees" else ("Системные пользователи" if key == "users" else "Организации"))))))))))))

        fallback_uz = MENU_TITLES["uz"].get(key, fallback_uz)
        fallback_ru = MENU_TITLES["ru"].get(key, fallback_ru)
        custom_t = saved_menus.get(key, {})
        t_uz = fallback_uz
        t_ru = fallback_ru
        
        if isinstance(custom_t, dict):
            if custom_t.get("uz") and custom_t.get("uz").strip():
                t_uz = custom_t.get("uz").strip()
            if custom_t.get("ru") and custom_t.get("ru").strip():
                t_ru = custom_t.get("ru").strip()
        elif isinstance(custom_t, str) and custom_t.strip():
            t_uz = custom_t.strip()
            t_ru = custom_t.strip()
            
        item["translations"] = {"uz": t_uz, "ru": t_ru}
        
        title = t_ru if lang == "ru" else t_uz
        res[key] = title
        item["title"] = title

        # Determine order
        if key in saved_order:
            item["order_index"] = saved_order.index(key) * 10
        else:
            item["order_index"] = 9999 + idx # Put un-sorted items at the end
            
    menu_list.sort(key=lambda x: x["order_index"])
    res["__list__"] = menu_list
    res["app_name"] = saved_data.get("app_name", "BioFace")
    res["logo_url"] = saved_data.get("logo_url", "")
    res["favicon_url"] = saved_data.get("favicon_url", "")
    return res

def _resolve_allowed_org_ids(request: Request, db: Session) -> list[int]:
    auth_user = request.session.get("auth_user") or {}
    org_ids: set[int] = set()
    user_id = auth_user.get("id")
    has_linked_orgs = False
    if user_id is not None:
        rows = (
            db.query(UserOrganizationLink.organization_id)
            .filter(UserOrganizationLink.user_id == int(user_id))
            .all()
        )
        org_ids.update(int(row.organization_id) for row in rows if row.organization_id is not None)
        has_linked_orgs = bool(org_ids)

    fallback_org_id = auth_user.get("organization_id")
    if not has_linked_orgs and fallback_org_id is not None:
        org_ids.add(int(fallback_org_id))

    if not org_ids:
        return []

    org_rows = (
        db.query(Organization.id, Organization.subscription_status)
        .filter(Organization.id.in_(sorted(org_ids)))
        .all()
    )

    allowed_org_ids: list[int] = []
    for org_id, sub_status in org_rows:
        status = str(sub_status.value if hasattr(sub_status, "value") else sub_status or "").strip().lower()
        if status == "expired":
            continue
        allowed_org_ids.append(int(org_id))

    return sorted(allowed_org_ids)


def _parse_hhmm_or_default(value, default_h: int = 9, default_m: int = 0) -> tuple[int, int]:
    raw = str(value or "").strip()
    if not raw:
        return default_h, default_m

    parts = raw.split(":")
    if len(parts) < 2:
        return default_h, default_m

    try:
        hours = max(0, min(23, int(parts[0])))
        minutes = max(0, min(59, int(parts[1])))
        return hours, minutes
    except Exception:
        return default_h, default_m


def get_notifications(request: Request, db: Session) -> dict:
    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    if not allowed_org_ids:
        return {"late": 0, "absent": 0, "total": 0}

    today_start, _ = today_tashkent_range()
    org_defaults = {
        int(row.id): _parse_hhmm_or_default(row.default_start_time)
        for row in (
            db.query(Organization.id, Organization.default_start_time)
            .filter(Organization.id.in_(allowed_org_ids))
            .all()
        )
    }

    todays_first_logs = (
        db.query(AttendanceLog)
        .filter(
            AttendanceLog.status == "aniqlandi",
            AttendanceLog.timestamp >= today_start,
            or_(
                AttendanceLog.device.has(Device.organization_id.in_(allowed_org_ids)),
                AttendanceLog.employee.has(Employee.organization_id.in_(allowed_org_ids)),
            ),
        )
        .order_by(AttendanceLog.timestamp.asc())
        .all()
    )

    seen_emps = set()
    late_count = 0
    for log in todays_first_logs:
        emp = log.employee
        if not emp or emp.id in seen_emps:
            continue
        seen_emps.add(emp.id)

        org_id = (
            int(emp.organization_id)
            if emp and emp.organization_id is not None
            else int(log.device.organization_id)
            if log.device and log.device.organization_id is not None
            else None
        )
        expected_h, expected_m = org_defaults.get(org_id, (9, 0))
        if emp.start_time:
            expected_h, expected_m = _parse_hhmm_or_default(emp.start_time, expected_h, expected_m)

        expected_time = log.timestamp.replace(hour=expected_h, minute=expected_m, second=0, microsecond=0)
        if log.timestamp > expected_time:
            delay = int((log.timestamp - expected_time).total_seconds() // 60)
            if delay > 0:
                late_count += 1

    all_emps = (
        db.query(Employee)
        .filter(
            Employee.has_access.is_(True),
            Employee.organization_id.in_(allowed_org_ids),
        )
        .all()
    )
    absent_count = 0
    local_now = now_tashkent()
    local_now_time = local_now.time()
    for emp in all_emps:
        if emp.id in seen_emps:
            continue

        org_id = int(emp.organization_id) if emp.organization_id is not None else None
        expected_h, expected_m = org_defaults.get(org_id, (9, 0))
        if emp.start_time:
            expected_h, expected_m = _parse_hhmm_or_default(emp.start_time, expected_h, expected_m)

        if local_now_time > datetime(2000, 1, 1, expected_h, expected_m).time():
            absent_count += 1

    return {
        "late": late_count,
        "absent": absent_count,
        # Displaying total absent + late on the menu badge confused users. The report is "Kechikish". We should return late_count as total for the badge.
        "total": late_count
    }


def _resolve_public_web_base(request: Request) -> str:
    configured = get_public_web_base_url().rstrip("/")
    return configured or str(request.base_url).rstrip("/")


def _build_dashboard_metrics(request: Request, db: Session) -> dict:
    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    today_start, today_end = today_tashkent_range()

    base_payload = {
        "allowed_org_ids": allowed_org_ids,
        "summary": {
            "organizations": 0,
            "users": 0,
            "employees": 0,
            "cameras": 0,
            "active_cameras": 0,
            "present_today": 0,
            "absent_today": 0,
            "late_today": 0,
        },
        "org_cards": [],
        "charts": {
            "org_overview": {"labels": [], "users": [], "employees": [], "cameras": []},
            "attendance_today": {"labels": [], "values": []},
            "subscription": {"labels": [], "values": []},
            "camera_load": {"labels": [], "values": []},
        },
    }
    if not allowed_org_ids:
        return base_payload

    org_rows = (
        db.query(Organization.id, Organization.name, Organization.subscription_status, Organization.default_start_time)
        .filter(Organization.id.in_(allowed_org_ids))
        .order_by(Organization.name.asc())
        .all()
    )
    if not org_rows:
        return base_payload

    org_ids = [int(row.id) for row in org_rows]
    org_defaults = {
        int(row.id): _parse_hhmm_or_default(row.default_start_time)
        for row in org_rows
    }

    employees = (
        db.query(Employee.id, Employee.organization_id, Employee.has_access, Employee.start_time)
        .filter(Employee.organization_id.in_(org_ids))
        .all()
    )
    employees_by_org = defaultdict(int)
    scoped_employee_ids: list[int] = []
    for emp in employees:
        if emp.organization_id is None:
            continue
        org_id = int(emp.organization_id)
        employees_by_org[org_id] += 1
        if bool(emp.has_access):
            scoped_employee_ids.append(int(emp.id))

    first_logs_by_employee: dict[int, AttendanceLog] = {}
    if scoped_employee_ids:
        logs = (
            db.query(AttendanceLog)
            .filter(
                AttendanceLog.status == "aniqlandi",
                AttendanceLog.employee_id.in_(scoped_employee_ids),
                AttendanceLog.timestamp >= today_start,
                AttendanceLog.timestamp < today_end,
            )
            .order_by(AttendanceLog.timestamp.asc(), AttendanceLog.id.asc())
            .all()
        )
        for log in logs:
            if log.employee_id is None:
                continue
            emp_id = int(log.employee_id)
            if emp_id not in first_logs_by_employee:
                first_logs_by_employee[emp_id] = log

    attendance_by_org: dict[int, dict] = defaultdict(lambda: {"present": 0, "absent": 0, "late": 0})
    now_time = now_tashkent().time()
    for emp in employees:
        if not bool(emp.has_access) or emp.organization_id is None:
            continue
        org_id = int(emp.organization_id)
        expected_h, expected_m = org_defaults.get(org_id, (9, 0))
        if emp.start_time:
            expected_h, expected_m = _parse_hhmm_or_default(emp.start_time, expected_h, expected_m)

        first_log = first_logs_by_employee.get(int(emp.id))
        if first_log and first_log.timestamp:
            attendance_by_org[org_id]["present"] += 1
            expected_time = first_log.timestamp.replace(hour=expected_h, minute=expected_m, second=0, microsecond=0)
            if first_log.timestamp > expected_time:
                attendance_by_org[org_id]["late"] += 1
            continue

        if now_time > datetime(2000, 1, 1, expected_h, expected_m).time():
            attendance_by_org[org_id]["absent"] += 1

    devices = (
        db.query(Device.id, Device.name, Device.organization_id, Device.is_online)
        .filter(Device.organization_id.in_(org_ids))
        .order_by(Device.name.asc())
        .all()
    )
    cameras_by_org = defaultdict(int)
    active_cameras_by_org = defaultdict(int)
    camera_names_by_org: dict[int, list[str]] = defaultdict(list)
    for cam in devices:
        if cam.organization_id is None:
            continue
        org_id = int(cam.organization_id)
        cameras_by_org[org_id] += 1
        if bool(cam.is_online):
            active_cameras_by_org[org_id] += 1
        camera_names_by_org[org_id].append(str(cam.name or f"Camera {cam.id}"))

    user_ids_by_org: dict[int, set[int]] = defaultdict(set)
    linked_user_ids: set[int] = set()
    for row in (
        db.query(UserOrganizationLink.user_id, UserOrganizationLink.organization_id)
        .filter(UserOrganizationLink.organization_id.in_(org_ids))
        .all()
    ):
        if row.organization_id is None or row.user_id is None:
            continue
        org_id = int(row.organization_id)
        user_id = int(row.user_id)
        user_ids_by_org[org_id].add(user_id)
        linked_user_ids.add(user_id)

    fallback_users = (
        db.query(User.id, User.organization_id)
        .filter(User.organization_id.in_(org_ids))
        .all()
    )
    for user_id, org_id in fallback_users:
        if user_id is None or org_id is None:
            continue
        safe_user_id = int(user_id)
        if safe_user_id in linked_user_ids:
            continue
        user_ids_by_org[int(org_id)].add(safe_user_id)

    top_cameras = (
        db.query(Device.name, func.count(EmployeeCameraLink.id).label("employee_count"))
        .join(EmployeeCameraLink, EmployeeCameraLink.camera_id == Device.id)
        .join(Employee, Employee.id == EmployeeCameraLink.employee_id)
        .filter(Employee.organization_id.in_(org_ids))
        .group_by(Device.id, Device.name)
        .order_by(func.count(EmployeeCameraLink.id).desc(), Device.name.asc())
        .limit(6)
        .all()
    )

    subscription_counts = {"active": 0, "pending": 0, "expired": 0}
    org_cards: list[dict] = []
    for row in org_rows:
        org_id = int(row.id)
        status = str(row.subscription_status.value if hasattr(row.subscription_status, "value") else row.subscription_status or "pending").strip().lower()
        if status not in subscription_counts:
            status = "pending"
        subscription_counts[status] += 1

        attendance = attendance_by_org.get(org_id, {"present": 0, "absent": 0, "late": 0})
        org_cards.append({
            "id": org_id,
            "name": str(row.name or "-"),
            "subscription_status": status,
            "user_count": len(user_ids_by_org.get(org_id, set())),
            "employee_count": int(employees_by_org.get(org_id, 0)),
            "camera_count": int(cameras_by_org.get(org_id, 0)),
            "active_camera_count": int(active_cameras_by_org.get(org_id, 0)),
            "present_today": int(attendance.get("present", 0)),
            "absent_today": int(attendance.get("absent", 0)),
            "late_today": int(attendance.get("late", 0)),
            "camera_names": camera_names_by_org.get(org_id, [])[:3],
        })

    present_today = sum(int(item["present_today"]) for item in org_cards)
    absent_today = sum(int(item["absent_today"]) for item in org_cards)
    late_today = sum(int(item["late_today"]) for item in org_cards)

    base_payload["summary"] = {
        "organizations": len(org_cards),
        "users": len({uid for org_users in user_ids_by_org.values() for uid in org_users}),
        "employees": sum(int(item["employee_count"]) for item in org_cards),
        "cameras": sum(int(item["camera_count"]) for item in org_cards),
        "active_cameras": sum(int(item["active_camera_count"]) for item in org_cards),
        "present_today": present_today,
        "absent_today": absent_today,
        "late_today": late_today,
    }
    base_payload["org_cards"] = org_cards
    base_payload["charts"] = {
        "org_overview": {
            "labels": [item["name"] for item in org_cards],
            "users": [int(item["user_count"]) for item in org_cards],
            "employees": [int(item["employee_count"]) for item in org_cards],
            "cameras": [int(item["camera_count"]) for item in org_cards],
        },
        "attendance_today": {
            "labels": ["present", "absent", "late"],
            "values": [present_today, absent_today, late_today],
        },
        "subscription": {
            "labels": ["active", "pending", "expired"],
            "values": [
                int(subscription_counts["active"]),
                int(subscription_counts["pending"]),
                int(subscription_counts["expired"]),
            ],
        },
        "camera_load": {
            "labels": [str(row.name or "-") for row in top_cameras],
            "values": [int(row.employee_count or 0) for row in top_cameras],
        },
    }
    return base_payload


@router.get("/")
def dashboard(request: Request, db: Session = Depends(get_db)):
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    dashboard_data = _build_dashboard_metrics(request, db)

    context = {
        "request": request,
        "page_title": get_menus_dict(request).get("dashboard", t["dashboard_title"]),
        "menus": get_menus_dict(request),
        "t": t,
        "lang": lang,
        "dashboard": dashboard_data,
        "notifs": get_notifications(request, db),
    }
    return templates.TemplateResponse(request=request, name="dashboard.html", context=context)


@router.get("/api/dashboard/metrics")
def dashboard_metrics_api(request: Request, db: Session = Depends(get_db)):
    return {
        "ok": True,
        "dashboard": _build_dashboard_metrics(request, db),
    }


@router.get("/devices")
def devices_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse(request=request, name="devices.html", context={
        "request": request,
        "page_title": menus.get("devices"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(request, db),
        "organizations": db.query(Organization).order_by(Organization.name).all(),
    })

@router.get("/devices/add")
def add_device_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Добавить камеру" if lang == "ru" else "Kamera qo'shish"
    return templates.TemplateResponse(request=request, name="add_device.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "notifs": get_notifications(request, db),
    })

@router.get("/users")
def users_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Системные пользователи" if lang == "ru" else "Tizim Foydalanuvchilari"
    return templates.TemplateResponse(request=request, name="users.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "notifs": get_notifications(request, db),
    })

@router.get("/users/add")
def add_user_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Добавить пользователя" if lang == "ru" else "Foydalanuvchi qo'shish"
    return templates.TemplateResponse(request=request, name="add_user.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "notifs": get_notifications(request, db),
    })

@router.get("/users/{user_id}/edit")
def edit_user_page(request: Request, user_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
    user_org_ids = [
        int(row.organization_id)
        for row in db.query(UserOrganizationLink.organization_id)
        .filter(UserOrganizationLink.user_id == user_id)
        .all()
    ]
    if not user_org_ids and user.organization_id is not None:
        user_org_ids = [int(user.organization_id)]

    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Редактировать пользователя" if lang == "ru" else "Foydalanuvchini Tahrirlash"
    return templates.TemplateResponse(request=request, name="edit_user.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "user": user,
        "user_org_ids": user_org_ids,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "notifs": get_notifications(request, db),
    })


@router.get("/organization-info")
def organization_info_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Tashkilot Ma'lumoti" if lang == "uz" else "Информация об организации"
    return templates.TemplateResponse(request=request, name="organization_info.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(request, db),
    })

@router.get("/devices/edit")
def edit_camera_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Kamerani Tahrirlash" if lang == "uz" else "Редактировать камеру"
    return templates.TemplateResponse(request=request, name="edit_camera.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "notifs": get_notifications(request, db),
    })

@router.get("/devices/guide")
def camera_guide_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    base_url = _resolve_public_web_base(request)
    bind_host = get_isup_public_host()
    isup_guide = {
        "bind_host": bind_host,
        "server_host": bind_host,
        "register_port": ISUP_REGISTER_PORT,
        "alarm_port": ISUP_ALARM_PORT,
        "picture_port": ISUP_PICTURE_PORT,
        "api_port": ISUP_API_PORT,
        "isup_key": ISUP_KEY,
        "health_url": f"{base_url}/api/isup-health",
        "process_url": f"{base_url}/api/isup/process",
        "devices_url": f"{base_url}/api/isup-devices",
    }
    page_title = "Инструкция по подключению" if lang == "ru" else "Kameralarni Ulash Qo'llanmasi"
    return templates.TemplateResponse(request=request, name="camera_guide.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "isup_guide": isup_guide,
        "notifs": get_notifications(request, db),
    })

@router.get("/api-helper")
def api_helper_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    base_url = _resolve_public_web_base(request)
    bind_host = get_isup_public_host()
    now = now_tashkent()
    cams_db = db.query(Device).order_by(Device.id).all()
    cameras = [
        {
            "id": c.id,
            "name": c.name,
            "mac_address": c.mac_address,
            "isup_device_id": c.isup_device_id,
            "model": c.model,
            "is_online": bool(c.last_seen_at and (now - c.last_seen_at) <= timedelta(minutes=10)),
            "last_seen_at": c.last_seen_at.isoformat() if c.last_seen_at else None,
        }
        for c in cams_db
    ]
    isup_config = {
        "bind_host": bind_host,
        "server_host": bind_host,
        "register_port": ISUP_REGISTER_PORT,
        "alarm_port": ISUP_ALARM_PORT,
        "picture_port": ISUP_PICTURE_PORT,
        "api_port": ISUP_API_PORT,
        "api_url": f"{base_url}/api/isup-health",
        "sdk_url": f"{base_url}/api/isup-sdk-status",
        "process_url": f"{base_url}/api/isup/process",
        "devices_url": f"{base_url}/api/isup-devices",
        "redis_url": f"{base_url}/api/redis/snapshot",
        "command_example_url": f"{base_url}/api/cameras/1/command",
        "isup_key": ISUP_KEY,
        "redis_host": REDIS_HOST,
        "redis_port": REDIS_PORT,
    }
    page_title = "API Helper" if lang == "uz" else "API Helper"
    return templates.TemplateResponse(request=request, name="api_helper.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "base_url": base_url,
        "cameras": cameras,
        "isup_config": isup_config,
        "notifs": get_notifications(request, db),
    })


@router.get("/camera-info")
def camera_info_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    cam = db.query(Device).first()
    return templates.TemplateResponse(request=request, name="camera_info.html", context={
        "request": request,
        "page_title": "Kamera Ma'lumoti" if lang == "uz" else "Информация о камере",
        "menus": menus,
        "t": t,
        "lang": lang,
        "camera": cam or {},
        "cameras": [],
        "notifs": get_notifications(request, db),
    })


@router.get("/attendance")
def attendance_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse(request=request, name="attendance.html", context={
        "request": request,
        "page_title": "Davomat Arxivi" if lang == "uz" else "Архив посещаемости",
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(request, db),
    })

@router.get("/attendance-sync")
def sync_attendance_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse(request=request, name="sync_attendance.html", context={
        "request": request,
        "page_title": menus.get("sync_attendance", "Sinxron Davomat"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(request, db),
    })

@router.get("/employees")
def employees_page(request: Request, db: Session = Depends(get_db)):
    emps = db.query(Employee).all()
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse(request=request, name="employees.html", context={
        "request": request,
        "page_title": menus.get("employees"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "employees": emps,
        "notifs": get_notifications(request, db),
    })

@router.get("/employees/add")
def add_employee_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Добавить сотрудника" if lang == "ru" else "Xodim qo'shish"
    return templates.TemplateResponse(request=request, name="add_employee.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "cameras": db.query(Device).order_by(Device.name).all(),
        "notifs": get_notifications(request, db),
    })

@router.get("/employees/{emp_id}")
def employee_profile_page(request: Request, emp_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    linked_cameras = (
        db.query(Device.id, Device.name, Device.isup_device_id, Device.mac_address)
        .join(EmployeeCameraLink, EmployeeCameraLink.camera_id == Device.id)
        .filter(EmployeeCameraLink.employee_id == emp.id)
        .order_by(Device.name.asc())
        .all()
    )

    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = f"{emp.first_name} {emp.last_name} - Profil"
    return templates.TemplateResponse(request=request, name="employee_profile.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "emp": emp,
        "linked_cameras": [
            {
                "id": int(row[0]),
                "name": str(row[1]),
                "isup_device_id": str(row[2] or ""),
                "mac_address": str(row[3] or ""),
            }
            for row in linked_cameras
        ],
        "notifs": get_notifications(request, db),
    })

@router.get("/employees/{emp_id}/edit")
def edit_employee_page(request: Request, emp_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
        
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Редактировать сотрудника" if lang == "ru" else "Xodimni Tahrirlash"
    linked_camera_ids = [
        int(row.camera_id)
        for row in db.query(EmployeeCameraLink.camera_id)
        .filter(EmployeeCameraLink.employee_id == emp.id)
        .all()
    ]
    return templates.TemplateResponse(request=request, name="edit_employee.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "emp": emp,
        "linked_camera_ids": linked_camera_ids,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "cameras": db.query(Device).order_by(Device.name).all(),
        "notifs": get_notifications(request, db),
    })

@router.get("/commands")
def commands_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    organizations = db.query(Organization).order_by(Organization.name).all()
    return templates.TemplateResponse(request=request, name="commands.html", context={
        "request": request,
        "page_title": menus.get("commands"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "cameras": [{"id": c.id, "name": c.name, "organization_id": c.organization_id} for c in db.query(Device).all()],
        "organizations": organizations,
        "notifs": get_notifications(request, db),
    })


@router.get("/reports")
def reports_page(request: Request, db: Session = Depends(get_db)):
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)

    scope = _resolve_reports_org_scope(request, db)
    allowed_org_ids = list(scope.get("allowed_org_ids") or [])
    organizations = list(scope.get("organizations") or [])
    now = now_tashkent()
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0)
    today_end = today_start + timedelta(days=1)

    report_rows = _build_reports_rows(
        db,
        allowed_org_ids=allowed_org_ids,
        target_day_start=today_start,
        target_day_end=today_end,
        lang=lang,
    )
    late_count = sum(1 for row in report_rows if row.get("status_key") == "late")
    absent_count = sum(1 for row in report_rows if row.get("status_key") == "absent")

    menus = get_menus_dict(request)
    return templates.TemplateResponse(request=request, name="reports.html", context={
        "request": request,
        "page_title": menus.get("reports"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "late_arrivals": report_rows,
        "late_count": late_count,
        "absent_count": absent_count,
        "total_employees": db.query(Employee).filter(Employee.organization_id.in_(allowed_org_ids)).count() if allowed_org_ids else 0,
        "organizations": organizations,
        "notifs": get_notifications(request, db),
    })


@router.get("/employees")
def employees_page_alt(request: Request, db: Session = Depends(get_db)):
    # This duplicate is kept here for compatibility with older routes order
    emps = db.query(Employee).all()
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse(request=request, name="employees.html", context={
        "request": request,
        "page_title": menus.get("employees"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "employees": emps,
        "notifs": get_notifications(request, db),
    })


@router.get("/about")
def about_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse(request=request, name="about.html", context={
        "request": request,
        "page_title": menus.get("about"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(request, db),
    })


@router.get("/psixologik-portret")
def psychological_portrait_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)

    selected_year = str(request.query_params.get("year") or "all").strip() or "all"
    selected_month = str(request.query_params.get("month") or "all").strip() or "all"
    selected_day = str(request.query_params.get("day") or "all").strip() or "all"

    def _norm(value: str | None) -> str:
        text = str(value or "").strip().casefold().replace("yo'q", "yoq")
        for ch in ["_", "-", ".", ",", ";", ":", "!", "?", "(", ")", "[", "]", '"', "'", "/", "\\"]:
            text = text.replace(ch, " ")
        while "  " in text:
            text = text.replace("  ", " ")
        return text.strip()

    categories = [
        {"key": "neutral", "uz": "Xotirjam", "ru": "Спокойный", "aliases": ["xotirjam", "neutral", "calm", "spokoynyy", "спокойный"]},
        {"key": "happy", "uz": "Quvnoq", "ru": "Радостный", "aliases": ["quvnoq", "happy", "joyful", "xursand", "радостный"]},
        {"key": "sad", "uz": "Xafa", "ru": "Грустный", "aliases": ["xafa", "sad", "mahzun", "грустный"]},
        {"key": "anxious", "uz": "Xavotirli", "ru": "Тревожный", "aliases": ["xavotirli", "anxious", "worry", "тревожный"]},
        {"key": "angry", "uz": "Jahli chiqqan", "ru": "Раздражённый", "aliases": ["jahli chiqqan", "angry", "mad", "gazablangan", "g'azablangan", "раздражённый"]},
        {"key": "surprised", "uz": "Hayron", "ru": "Удивлённый", "aliases": ["hayron", "surprised", "удивлённый"]},
        {"key": "indifferent", "uz": "Befarq", "ru": "Безразличный", "aliases": ["befarq", "indifferent", "безразличный"]},
        {"key": "unknown", "uz": "Aniqlanmadi", "ru": "Не определено", "aliases": ["aniqlanmadi", "unknown", "noma'lum", "nomalum", "не определено"]},
    ]
    alias_map: dict[str, str] = {}
    for c in categories:
        for a in c["aliases"]:
            alias_map[_norm(a)] = c["key"]

    def _apply_date(query):
        q = query
        if selected_year != "all":
            q = q.filter(func.substr(EmployeePsychologicalState.state_date, 1, 4) == selected_year)
        if selected_month != "all":
            q = q.filter(func.substr(EmployeePsychologicalState.state_date, 6, 2) == selected_month)
        if selected_day != "all":
            q = q.filter(func.substr(EmployeePsychologicalState.state_date, 9, 2) == selected_day)
        return q

    def _period_label() -> str:
        if selected_year == selected_month == selected_day == "all":
            return "Barcha yozuvlar" if lang == "uz" else "Все записи"
        if selected_year != "all" and selected_month == selected_day == "all":
            return f"{selected_year} yil" if lang == "uz" else f"{selected_year} год"
        if selected_year != "all" and selected_month != "all" and selected_day == "all":
            return f"{selected_year}-{selected_month}" if lang == "uz" else f"{selected_year}-{selected_month}"
        return f"{selected_year if selected_year != 'all' else '--'}-{selected_month if selected_month != 'all' else '--'}-{selected_day if selected_day != 'all' else '--'}"

    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    employee_q = db.query(Employee)
    if allowed_org_ids:
        employee_q = employee_q.filter(Employee.organization_id.in_(allowed_org_ids))
    else:
        employee_q = employee_q.filter(Employee.id == -1)
    scoped_employee_ids = [int(r.id) for r in employee_q.with_entities(Employee.id).all()]
    total_employees = len(scoped_employee_ids)

    states_base = db.query(EmployeePsychologicalState)
    if scoped_employee_ids:
        states_base = states_base.filter(EmployeePsychologicalState.employee_id.in_(scoped_employee_ids))
    else:
        states_base = states_base.filter(EmployeePsychologicalState.id == -1)

    filtered_states = _apply_date(states_base)

    years = [str(r.y or "").strip() for r in states_base.with_entities(func.substr(EmployeePsychologicalState.state_date, 1, 4).label("y")).distinct().order_by(func.substr(EmployeePsychologicalState.state_date, 1, 4).desc()).all() if str(r.y or "").strip()]
    month_base = states_base
    if selected_year != "all":
        month_base = month_base.filter(func.substr(EmployeePsychologicalState.state_date, 1, 4) == selected_year)
    months = [str(r.m or "").strip() for r in month_base.with_entities(func.substr(EmployeePsychologicalState.state_date, 6, 2).label("m")).distinct().order_by(func.substr(EmployeePsychologicalState.state_date, 6, 2).asc()).all() if str(r.m or "").strip()]
    day_base = month_base
    if selected_month != "all":
        day_base = day_base.filter(func.substr(EmployeePsychologicalState.state_date, 6, 2) == selected_month)
    days = [str(r.d or "").strip() for r in day_base.with_entities(func.substr(EmployeePsychologicalState.state_date, 9, 2).label("d")).distinct().order_by(func.substr(EmployeePsychologicalState.state_date, 9, 2).asc()).all() if str(r.d or "").strip()]

    selected_total = int(filtered_states.with_entities(func.count(EmployeePsychologicalState.id)).scalar() or 0)
    selected_employees = int(filtered_states.with_entities(func.count(func.distinct(EmployeePsychologicalState.employee_id))).scalar() or 0)
    selected_coverage = round((selected_employees / total_employees) * 100) if total_employees else 0

    latest_state = filtered_states.order_by(EmployeePsychologicalState.assessed_at.desc(), EmployeePsychologicalState.id.desc()).first()
    latest_activity = latest_state.assessed_at.isoformat() if latest_state and latest_state.assessed_at else None

    source_rows = filtered_states.with_entities(EmployeePsychologicalState.source, func.count(EmployeePsychologicalState.id)).group_by(EmployeePsychologicalState.source).all()
    source_breakdown = []
    for source_key, count_value in source_rows:
        safe_source = str(source_key or "manual")
        c = int(count_value or 0)
        source_breakdown.append({"label": safe_source, "count": c, "percent": round((c / max(1, selected_total)) * 100)})
    source_breakdown.sort(key=lambda item: item["count"], reverse=True)

    state_rows = filtered_states.with_entities(EmployeePsychologicalState.state_uz, EmployeePsychologicalState.state_ru, func.count(EmployeePsychologicalState.id)).group_by(EmployeePsychologicalState.state_uz, EmployeePsychologicalState.state_ru).all()
    category_counts: dict[str, int] = {}
    for item in categories:
        key = str(item.get("key") or "unknown")
        category_counts[key] = 0
    for state_uz, state_ru, count_value in state_rows:
        key = alias_map.get(_norm(state_uz or state_ru), "unknown")
        category_counts[key] = category_counts.get(key, 0) + int(count_value or 0)

    state_breakdown = []
    for item in categories:
        key = str(item.get("key") or "unknown")
        cnt = int(category_counts.get(key, 0))
        state_breakdown.append({
            "key": key,
            "label": item["uz"] if lang == "uz" else item["ru"],
            "count": cnt,
            "percent": round((cnt / max(1, selected_total)) * 100),
        })

    recent_rows_query = (
        db.query(EmployeePsychologicalState, Employee)
        .join(Employee, Employee.id == EmployeePsychologicalState.employee_id)
    )
    if scoped_employee_ids:
        recent_rows_query = recent_rows_query.filter(EmployeePsychologicalState.employee_id.in_(scoped_employee_ids))
    else:
        recent_rows_query = recent_rows_query.filter(EmployeePsychologicalState.id == -1)

    recent_rows = (
        _apply_date(recent_rows_query)
        .order_by(EmployeePsychologicalState.assessed_at.desc(), EmployeePsychologicalState.id.desc())
        .limit(20)
        .all()
    )
    recent_states = [
        {
            "employee_id": int(emp.id),
            "employee_name": " ".join(part for part in [emp.first_name, emp.last_name, emp.middle_name] if part and str(part).strip()).strip() or "-",
            "state": str(state.state_ru or "-") if lang == "ru" else str(state.state_uz or "-"),
            "state_date": str(state.state_date or ""),
            "source": str(state.source or "manual"),
            "assessed_at": state.assessed_at.isoformat() if state.assessed_at else None,
            "note": str(state.note or ""),
        }
        for state, emp in recent_rows
    ]

    portrait_score = selected_coverage if total_employees else 0
    if portrait_score >= 75:
        portrait_level = "barqaror" if lang == "uz" else "стабильный"
    elif portrait_score >= 45:
        portrait_level = "o'rtacha" if lang == "uz" else "умеренный"
    else:
        portrait_level = "kuzatuv kerak" if lang == "uz" else "требует внимания"

    page_title = menus.get("psychological_portrait", "Psixologik Portret")
    portrait_stats = [
        {"label": "Jami xodimlar" if lang == "uz" else "Всего сотрудников", "value": total_employees, "hint": "Tizimdagi xodimlar" if lang == "uz" else "Сотрудники в системе", "tone": "slate"},
        {"label": "Tanlangan davr yozuvlari" if lang == "uz" else "Записи за период", "value": selected_total, "hint": _period_label(), "tone": "blue"},
        {"label": "Qayd qilingan xodimlar" if lang == "uz" else "Отмеченные сотрудники", "value": selected_employees, "hint": f"Qamrov: {selected_coverage}%" if lang == "uz" else f"Покрытие: {selected_coverage}%", "tone": "emerald"},
        {"label": "Asosiy holatlar" if lang == "uz" else "Ключевые состояния", "value": len(state_breakdown), "hint": "Angry/Neutral va boshqalar" if lang == "uz" else "Angry/Neutral и другие", "tone": "violet"},
        {"label": "So'nggi yozuv vaqti" if lang == "uz" else "Время последней записи", "value": latest_activity or "-", "hint": "Tanlangan davr bo'yicha" if lang == "uz" else "За выбранный период", "tone": "amber"},
        {"label": "Holat darajasi" if lang == "uz" else "Уровень", "value": portrait_level.title(), "hint": "Oddiy ko'rsatkich" if lang == "uz" else "Простой показатель", "tone": "red"},
    ]
    portrait_signals = [
        {"title": "Qamrov" if lang == "uz" else "Покрытие", "value": portrait_score, "description": "Tanlangan davr bo'yicha qamrov foizi" if lang == "uz" else "Процент покрытия за выбранный период"},
        {"title": "Monitoring holati" if lang == "uz" else "Состояние мониторинга", "value": portrait_level.title(), "description": "Yozuvlar to'liqligi" if lang == "uz" else "Полнота записей"},
        {"title": "So'nggi yozuv" if lang == "uz" else "Последняя запись", "value": latest_activity or "-", "description": "Oxirgi qayd vaqti" if lang == "uz" else "Время последней записи"},
    ]
    portrait_notes = [
        "Bu sahifa AI asosida xodim holatini ko'rsatadi." if lang == "uz" else "Эта страница показывает состояние сотрудников на основе AI.",
        "Bu tibbiy tashxis emas, faqat kuzatuv uchun." if lang == "uz" else "Это не медицинский диагноз, только для наблюдения.",
        "Filtr orqali yil/oy/kun bo'yicha ko'ring." if lang == "uz" else "Используйте фильтр год/месяц/день.",
    ]
    portrait_state_categories = [{"uz": c["uz"], "ru": c["ru"]} for c in categories]

    return templates.TemplateResponse(request=request, name="psixologik_portret.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "portrait_stats": portrait_stats,
        "portrait_signals": portrait_signals,
        "portrait_notes": portrait_notes,
        "portrait_state_categories": portrait_state_categories,
        "state_breakdown": state_breakdown,
        "source_breakdown": source_breakdown,
        "recent_states": recent_states,
        "selected_year": selected_year,
        "selected_month": selected_month,
        "selected_day": selected_day,
        "selected_period_label": _period_label(),
        "available_years": sorted(set(years), reverse=True),
        "available_months": sorted(set(months)),
        "available_days": sorted(set(days)),
        "summary": {
            "selected_total": selected_total,
            "selected_employees": selected_employees,
            "selected_coverage": selected_coverage,
            "portrait_score": portrait_score,
            "portrait_level": portrait_level,
            "latest_activity": latest_activity,
            "selected_period_label": _period_label(),
        },
        "notifs": get_notifications(request, db),
    })


@router.get("/settings")
def settings_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse(request=request, name="settings.html", context={
        "request": request,
        "page_title": menus.get("settings"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(request, db),
    })


@router.get("/organizations")
def organizations_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Организации" if lang == "ru" else "Tashkilotlar"

    org_rows = db.query(Organization).order_by(Organization.id.desc()).all()
    organizations = [
        {
            "id": int(o.id),
            "name": str(o.name),
            "organization_type": str(o.organization_type or "boshqa"),
            "organization_type_label": get_organization_type_label(o.organization_type, lang=lang),
            "subscription_status": (o.subscription_status.value if hasattr(o.subscription_status, "value") else str(o.subscription_status or "pending")),
            "default_start_time": str(o.default_start_time or "09:00"),
            "employees_count": len(o.employees),
            "devices_count": len(o.devices),
        }
        for o in org_rows
    ]

    return templates.TemplateResponse(request=request, name="organizations.html", context={
        "request": request,
        "page_title": menus.get("organizations", page_title),
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": organizations,
        "notifs": get_notifications(request, db),
    })


@router.get("/organizations/add")
def add_organization_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Добавить организацию" if lang == "ru" else "Yangi Tashkilot"
    return templates.TemplateResponse(request=request, name="add_organization.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "organization_types": get_organization_type_choices(lang=lang),
        "notifs": get_notifications(request, db),
    })


@router.get("/organizations/{org_id}/edit")
def edit_organization_page(request: Request, org_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException

    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Tashkilot topilmadi")

    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Редактировать организацию" if lang == "ru" else "Tashkilotni Tahrirlash"
    return templates.TemplateResponse(request=request, name="edit_organization.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "org": org,
        "organization_types": get_organization_type_choices(lang=lang),
        "notifs": get_notifications(request, db),
    })

@router.get("/isup-server")
def isup_dashboard_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse(request=request, name="isup_dashboard.html", context={
        "request": request,
        "page_title": menus.get("isup_server"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(request, db),
    })


@router.get("/redis")
def redis_dashboard_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse(request=request, name="redis_dashboard.html", context={
        "request": request,
        "page_title": menus.get("redis_monitor", "REDIS"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(request, db),
    })
