from collections import defaultdict
from datetime import datetime, timedelta
from urllib.parse import urlsplit
from fastapi import APIRouter, Request, Depends
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session, selectinload
from access_control import (
    build_permission_groups,
    filter_menu_structure_by_permissions,
    get_role_default_menu_permissions,
    normalize_role_value,
    resolve_user_menu_permissions,
)
from database import get_db
from models import (
    AttendanceLog,
    Department,
    Device,
    Employee,
    EmployeeCameraLink,
    EmployeePsychologicalState,
    Organization,
    Position,
    User,
    UserOrganizationLink,
    UserRole,
)
from organization_types import get_organization_type_choices, get_organization_type_label
from routers.cameras_parts.psychology_utils import (
    PROFILELESS_STATES,
    aggregate_emotion_scores,
    build_psychological_profile,
    deserialize_emotion_scores,
    resolve_snapshot_path,
    state_labels,
)
from time_utils import now_tashkent, today_tashkent_range
from schedule_utils import get_attendance_deadline, get_late_minutes, is_holiday_for_org, resolve_employee_schedule
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
        "staff": "Hodimlar",
        "students": "O'quvchi Talabalar",
        "shifts": "Smenalar",
        "employees": "Xodimlar Ro'yxati",
        "attendance": "Davomat",
        "psychological_portrait": "Psixologik Portret",
        "reports": "Kechikish Hisoboti",
        "settings": "Sozlamalar",
        "about": "Tizim Haqida",
        "group_cameras": "Kameralar",
        "group_employees": "Asosiy bo'lim",
        "group_management": "Tashkilotlar",
        "users": "Tizim Foydalanuvchilari",
        "user_approvals": "Tasdiqlash Navbati",
        "organizations": "Tashkilotlar",
        "isup_server": "ISUP Server",
        "api_helper": "API Helper",
        "redis_monitor": "REDIS",
        "middleware_logs": "Tizim Loglari",
    },
    "ru": {
        "dashboard": "Управление",
        "devices": "Список камер",
        "commands": "Команды",
        "staff": "Сотрудники",
        "students": "Ученики и студенты",
        "shifts": "Смены",
        "employees": "Сотрудники",
        "reports": "Опоздания",
        "psychological_portrait": "Психологический портрет",
        "settings": "Настройки",
        "about": "О системе",
        "group_cameras": "Камеры",
        "group_employees": "Основной раздел",
        "group_management": "Организации",
        "users": "Системные пользователи",
        "user_approvals": "Очередь подтверждения",
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
    {"type": "link", "key": "dashboard", "href": "/", "icon": "fa-solid fa-chart-pie"},
    {"type": "group", "key": "group_cameras"},
    {"type": "link", "key": "devices", "href": "/devices", "icon": "fa-solid fa-camera-cctv"},
    {"type": "link", "key": "commands", "href": "/commands", "icon": "fa-solid fa-terminal"},
    {"type": "group", "key": "group_employees"},
    {"type": "link", "key": "staff", "href": "/staff", "icon": "fa-solid fa-user-tie"},
    {"type": "link", "key": "students", "href": "/students", "icon": "fa-solid fa-user-graduate"},
    {"type": "link", "key": "shifts", "href": "/shifts", "icon": "fa-solid fa-calendar-clock"},
    {"type": "link", "key": "attendance", "href": "/attendance", "icon": "fa-solid fa-list-check"},
    {"type": "link", "key": "psychological_portrait", "href": "/psixologik-portret", "icon": "fa-solid fa-brain"},
    {"type": "link", "key": "reports", "href": "/reports", "icon": "fa-solid fa-file-chart-column"},
    {"type": "group", "key": "group_management"},
    {"type": "link", "key": "organizations", "href": "/organizations", "icon": "fa-solid fa-building"},
    {"type": "link", "key": "users", "href": "/users", "icon": "fa-solid fa-users-gear"},
    {"type": "link", "key": "user_approvals", "href": "/user-approvals", "icon": "fa-solid fa-user-clock"},
    {"type": "link", "key": "settings", "href": "/settings", "icon": "fa-solid fa-gear"},
    {"type": "link", "key": "isup_server", "href": "/isup-server", "icon": "fa-solid fa-server"},
    {"type": "link", "key": "redis_monitor", "href": "/redis", "icon": "fa-solid fa-database"},
    {"type": "link", "key": "middleware_logs", "href": "/middleware-logs", "icon": "fa-solid fa-rectangle-history"},
    {"type": "link", "key": "api_helper", "href": "/api-helper", "icon": "fa-solid fa-code-merge"},
    {"type": "link", "key": "about", "href": "/about", "icon": "fa-solid fa-circle-question"}
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


def _get_organization_user_counts(db: Session, org_ids: list[int]) -> dict[int, int]:
    if not org_ids:
        return {}

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

    for user_id, org_id in (
        db.query(User.id, User.organization_id)
        .filter(User.organization_id.in_(org_ids))
        .all()
    ):
        if user_id is None or org_id is None:
            continue
        safe_user_id = int(user_id)
        if safe_user_id in linked_user_ids:
            continue
        user_ids_by_org[int(org_id)].add(safe_user_id)

    return {org_id: len(user_ids) for org_id, user_ids in user_ids_by_org.items()}


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
        .options(selectinload(Employee.organization), selectinload(Employee.schedule))
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
        if is_holiday_for_org(db, target_day_start.date(), emp.organization_id):
            continue

        schedule_payload = resolve_employee_schedule(emp)
        start_h, start_m = _parse_hhmm_or_default(schedule_payload.get("start_time"), 9, 0)
        expected_start = target_day_start.replace(hour=start_h, minute=start_m, second=0, microsecond=0)

        status_key = "absent"
        arrival_time = None
        delay_minutes = 0
        if first_log and first_log.timestamp:
            arrival_time = first_log.timestamp
            delay_minutes = get_late_minutes(emp, target_day_start, first_log.timestamp)
            if delay_minutes > 0:
                status_key = "late"
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
        if is_holiday_for_org(db, target_day_start.date(), emp.organization_id):
            continue
        schedule_payload = resolve_employee_schedule(emp)
        start_h, start_m = _parse_hhmm_or_default(schedule_payload.get("start_time"), 9, 0)
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
        "staff": "Hodimlar" if lang == "uz" else "Сотрудники",
        "students": "O'quvchi Talabalar" if lang == "uz" else "Ученики и студенты",
        "shifts": "Smenalar" if lang == "uz" else "Смены",
        "employees": "Xodimlar Ro'yxati" if lang == "uz" else "Сотрудники",
        "reports": "Kechikish Hisoboti" if lang == "uz" else "Опоздания",
        "settings": "Sozlamalar" if lang == "uz" else "Настройки",
        "about": "Tizim Haqida" if lang == "uz" else "О системе",
        "group_cameras": "Kameralar" if lang == "uz" else "Камеры",
        "group_employees": "Asosiy bo'lim" if lang == "uz" else "Основной раздел",
        "group_management": "Tashkilotlar" if lang == "uz" else "Организации",
        "users": "Tizim Foydalanuvchilari" if lang == "uz" else "Системные пользователи",
        "isup_server": "ISUP Server" if lang == "uz" else "ISUP Сервер",
        "middleware_logs": "Tizim Loglari" if lang == "uz" else "Системные Логи"
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
        fallback_uz_map = {
            "dashboard": "Boshqaruv Paneli",
            "devices": "Kameralar Ro'yxati",
            "events": "Kamera Hodisalari",
            "commands": "Kameraga Buyruqlar",
            "staff": "Hodimlar",
            "students": "O'quvchi Talabalar",
            "shifts": "Smenalar",
            "employees": "Xodimlar Ro'yxati",
            "reports": "Kechikish Hisoboti",
            "user_approvals": "Tasdiqlash Navbati",
            "settings": "Sozlamalar",
            "about": "Tizim Haqida",
            "isup_server": "ISUP Server",
            "middleware_logs": "Tizim Loglari",
            "group_cameras": "Kameralar",
            "group_employees": "Asosiy bo'lim",
            "users": "Tizim Foydalanuvchilari",
        }
        fallback_ru_map = {
            "dashboard": "Управление",
            "devices": "Список камер",
            "events": "События",
            "commands": "Команды",
            "staff": "Сотрудники",
            "students": "Ученики и студенты",
            "shifts": "Смены",
            "employees": "Сотрудники",
            "reports": "Опоздания",
            "user_approvals": "Очередь подтверждения",
            "settings": "Настройки",
            "about": "О системе",
            "isup_server": "ISUP Сервер",
            "middleware_logs": "Системные Логи",
            "group_cameras": "Камеры",
            "group_employees": "Основной раздел",
            "users": "Системные пользователи",
        }
        fallback_uz = fallback_uz_map.get(key, "Tashkilotlar")
        fallback_ru = fallback_ru_map.get(key, "Организации")

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
    auth_user = request.session.get("auth_user") or {}
    if auth_user:
        menu_permissions = resolve_user_menu_permissions(
            role=auth_user.get("role"),
            stored_permissions=auth_user.get("menu_permissions"),
        )
        menu_list = filter_menu_structure_by_permissions(menu_list, menu_permissions)
        res["__permissions__"] = menu_permissions
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


def _request_is_super_admin(request: Request) -> bool:
    auth_user = request.session.get("auth_user") or {}
    return normalize_role_value(auth_user.get("role")) == UserRole.super_admin.value


def _resolve_camera_page_scope(request: Request, db: Session) -> dict[str, object]:
    is_super_admin = _request_is_super_admin(request)
    organizations_query = db.query(Organization).order_by(Organization.name)
    if is_super_admin:
        organizations = organizations_query.all()
        allowed_org_ids = [
            int(org.id)
            for org in organizations
            if getattr(org, "id", None) is not None
        ]
        return {
            "is_super_admin": True,
            "allowed_org_ids": allowed_org_ids,
            "organizations": organizations,
        }

    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    organizations = (
        organizations_query.filter(Organization.id.in_(allowed_org_ids)).all()
        if allowed_org_ids
        else []
    )
    return {
        "is_super_admin": False,
        "allowed_org_ids": allowed_org_ids,
        "organizations": organizations,
    }


def _build_employee_page_config(view_mode: str, menus: dict, lang: str) -> dict[str, str]:
    safe_mode = str(view_mode or "all").strip().lower() or "all"
    is_ru = lang == "ru"
    if safe_mode == "staff":
        return {
            "employee_view_mode": "staff",
            "page_title": menus.get("staff", "Сотрудники" if is_ru else "Hodimlar"),
            "employee_heading_title": "Сотрудники" if is_ru else "Hodimlar",
            "employee_heading_description": "Список сотрудников и преподавателей." if is_ru else "Hodim va o'qituvchilar ro'yxati.",
            "employee_add_url": "/employees/add?kind=staff",
            "employee_add_label": "Добавить сотрудника" if is_ru else "Yangi hodim",
            "employee_default_type_filter": "staff",
            "employee_import_default_type": "hodim",
        }
    if safe_mode == "students":
        return {
            "employee_view_mode": "students",
            "page_title": menus.get("students", "Ученики и студенты" if is_ru else "O'quvchi Talabalar"),
            "employee_heading_title": "Ученики и студенты" if is_ru else "O'quvchi talabalar",
            "employee_heading_description": "Список учеников и студентов." if is_ru else "O'quvchi va talabalar ro'yxati.",
            "employee_add_url": "/employees/add?kind=student",
            "employee_add_label": "Добавить ученика" if is_ru else "Yangi o'quvchi",
            "employee_default_type_filter": "oquvchi",
            "employee_import_default_type": "oquvchi",
        }
    return {
        "employee_view_mode": "all",
        "page_title": menus.get("employees", "Сотрудники" if is_ru else "Xodimlar Ro'yxati"),
        "employee_heading_title": "Пользователи" if is_ru else "Foydalanuvchilar",
        "employee_heading_description": "Все сотрудники, преподаватели и учащиеся." if is_ru else "Barcha hodim, o'qituvchi va o'quvchilar ro'yxati.",
        "employee_add_url": "/employees/add",
        "employee_add_label": "Добавить пользователя" if is_ru else "Yangi foydalanuvchi",
        "employee_default_type_filter": "all",
        "employee_import_default_type": "hodim",
    }


def _build_shifts_page_payload(request: Request, db: Session, lang: str) -> tuple[list[Organization], list[dict], dict[str, int]]:
    is_super_admin = _request_is_super_admin(request)
    organizations_query = db.query(Organization).order_by(Organization.name.asc(), Organization.id.asc())
    if not is_super_admin:
        allowed_org_ids = _resolve_allowed_org_ids(request, db)
        if not allowed_org_ids:
            return [], [], {
                "total_employees": 0,
                "custom_shift_count": 0,
                "default_shift_count": 0,
                "organization_count": 0,
            }
        organizations_query = organizations_query.filter(Organization.id.in_(allowed_org_ids))

    organizations = []
    for org in organizations_query.all():
        status = str(org.subscription_status.value if hasattr(org.subscription_status, "value") else org.subscription_status or "").strip().lower()
        if status == "expired":
            continue
        organizations.append(org)

    active_org_ids = [int(org.id) for org in organizations if getattr(org, "id", None) is not None]
    if not active_org_ids:
        return organizations, [], {
            "total_employees": 0,
            "custom_shift_count": 0,
            "default_shift_count": 0,
            "organization_count": len(organizations),
        }

    employees = (
        db.query(Employee)
        .options(selectinload(Employee.organization), selectinload(Employee.schedule))
        .filter(Employee.organization_id.in_(active_org_ids))
        .order_by(
            func.lower(func.coalesce(Employee.first_name, "")).asc(),
            func.lower(func.coalesce(Employee.last_name, "")).asc(),
            Employee.id.asc(),
        )
        .all()
    )

    type_labels = {
        "oquvchi": "Ученик" if lang == "ru" else "O'quvchi",
        "oqituvchi": "Преподаватель" if lang == "ru" else "O'qituvchi",
        "hodim": "Сотрудник" if lang == "ru" else "Hodim",
    }
    rows: list[dict] = []
    custom_shift_count = 0
    schedule_shift_count = 0
    default_shift_count = 0
    for emp in employees:
        org = emp.organization
        schedule_payload = resolve_employee_schedule(emp)
        org_start = str(schedule_payload.get("default_start_time") or "09:00")
        org_end = str(schedule_payload.get("default_end_time") or "18:00")
        start_time = str(schedule_payload.get("start_time") or org_start or "09:00")
        end_time = str(schedule_payload.get("end_time") or org_end or "18:00")
        source = str(schedule_payload.get("source") or "organization_default")
        if source == "employee_override":
            custom_shift_count += 1
        elif source == "schedule":
            schedule_shift_count += 1
        else:
            default_shift_count += 1

        full_name = " ".join(
            part for part in [emp.first_name or "", emp.middle_name or "", emp.last_name or ""] if str(part).strip()
        ).strip()
        employee_type_key = str(emp.employee_type or "").strip().lower()
        rows.append({
            "id": int(emp.id),
            "full_name": full_name,
            "personal_id": str(emp.personal_id or ""),
            "employee_type": employee_type_key,
            "employee_type_label": type_labels.get(employee_type_key, "Не указан" if lang == "ru" else "Tanlanmagan"),
            "organization_id": int(org.id) if org and org.id is not None else None,
            "organization_name": str(org.name or "") if org else "",
            "department": str(emp.department or ""),
            "position": str(emp.position or ""),
            "start_time": start_time,
            "end_time": end_time,
            "default_start_time": org_start,
            "default_end_time": org_end,
            "schedule_id": schedule_payload.get("schedule_id"),
            "schedule_name": schedule_payload.get("schedule_name"),
            "schedule_is_flexible": bool(schedule_payload.get("is_flexible")),
            "shift_source": "custom" if source == "employee_override" else ("schedule" if source == "schedule" else "organization"),
            "shift_source_label": (
                "Персональная"
                if source == "employee_override" and lang == "ru"
                else "Shaxsiy"
                if source == "employee_override"
                else "Смена"
                if source == "schedule" and lang == "ru"
                else "Smena"
                if source == "schedule"
                else "Организация"
                if lang == "ru"
                else "Tashkilot"
            ),
        })

    return organizations, rows, {
        "total_employees": len(rows),
        "custom_shift_count": custom_shift_count,
        "schedule_shift_count": schedule_shift_count,
        "default_shift_count": default_shift_count,
        "organization_count": len(organizations),
    }


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
        if is_holiday_for_org(db, today_start.date(), org_id):
            continue
        delay = get_late_minutes(emp, today_start, log.timestamp)
        if delay > 0:
            late_count += 1

    all_emps = (
        db.query(Employee)
        .options(selectinload(Employee.organization), selectinload(Employee.schedule))
        .filter(
            Employee.has_access.is_(True),
            Employee.organization_id.in_(allowed_org_ids),
        )
        .all()
    )
    absent_count = 0
    local_now = now_tashkent()
    for emp in all_emps:
        if emp.id in seen_emps:
            continue
        if is_holiday_for_org(db, today_start.date(), emp.organization_id):
            continue
        deadline = get_attendance_deadline(emp, today_start.date())
        if local_now >= deadline:
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
    employees = (
        db.query(Employee)
        .options(selectinload(Employee.organization), selectinload(Employee.schedule))
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
    now_local = now_tashkent()
    for emp in employees:
        if not bool(emp.has_access) or emp.organization_id is None:
            continue
        org_id = int(emp.organization_id)
        if is_holiday_for_org(db, today_start.date(), org_id):
            continue

        first_log = first_logs_by_employee.get(int(emp.id))
        if first_log and first_log.timestamp:
            attendance_by_org[org_id]["present"] += 1
            if get_late_minutes(emp, today_start, first_log.timestamp) > 0:
                attendance_by_org[org_id]["late"] += 1
            continue

        if now_local >= get_attendance_deadline(emp, today_start.date()):
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
    scope = _resolve_camera_page_scope(request, db)
    return templates.TemplateResponse(request=request, name="devices.html", context={
        "request": request,
        "page_title": menus.get("devices"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(request, db),
        "organizations": scope.get("organizations") or [],
        "camera_manage_allowed": bool(scope.get("is_super_admin")),
        "camera_scope_limited": not bool(scope.get("is_super_admin")),
    })

@router.get("/devices/add")
def add_device_page(request: Request, db: Session = Depends(get_db)):
    scope = _resolve_camera_page_scope(request, db)
    if not bool(scope.get("is_super_admin")):
        return RedirectResponse(url="/devices", status_code=303)
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
        "organizations": scope.get("organizations") or [],
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

@router.get("/user-approvals")
def user_approvals_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Очередь подтверждения" if lang == "ru" else "Tasdiqlash navbati"
    return templates.TemplateResponse(request=request, name="user_approvals.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "menu_permission_groups": build_permission_groups(lang),
        "role_permission_defaults": {
            "SuperAdmin": get_role_default_menu_permissions("SuperAdmin"),
            "MahallaAdmin": get_role_default_menu_permissions("MahallaAdmin"),
            "MaktabAdmin": get_role_default_menu_permissions("MaktabAdmin"),
            "KollejAdmin": get_role_default_menu_permissions("KollejAdmin"),
            "TashkilotAdmin": get_role_default_menu_permissions("TashkilotAdmin"),
            "KorxonaAdmin": get_role_default_menu_permissions("KorxonaAdmin"),
        },
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
        "menu_permission_groups": build_permission_groups(lang),
        "role_permission_defaults": {
            "SuperAdmin": get_role_default_menu_permissions("SuperAdmin"),
            "MahallaAdmin": get_role_default_menu_permissions("MahallaAdmin"),
            "MaktabAdmin": get_role_default_menu_permissions("MaktabAdmin"),
            "KollejAdmin": get_role_default_menu_permissions("KollejAdmin"),
            "TashkilotAdmin": get_role_default_menu_permissions("TashkilotAdmin"),
            "KorxonaAdmin": get_role_default_menu_permissions("KorxonaAdmin"),
        },
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
        "user_menu_permissions": resolve_user_menu_permissions(role=user.role, stored_permissions=user.menu_permissions),
        "menu_permission_groups": build_permission_groups(lang),
        "role_permission_defaults": {
            "SuperAdmin": get_role_default_menu_permissions("SuperAdmin"),
            "MahallaAdmin": get_role_default_menu_permissions("MahallaAdmin"),
            "MaktabAdmin": get_role_default_menu_permissions("MaktabAdmin"),
            "KollejAdmin": get_role_default_menu_permissions("KollejAdmin"),
            "TashkilotAdmin": get_role_default_menu_permissions("TashkilotAdmin"),
            "KorxonaAdmin": get_role_default_menu_permissions("KorxonaAdmin"),
        },
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
    scope = _resolve_camera_page_scope(request, db)
    if not bool(scope.get("is_super_admin")):
        return RedirectResponse(url="/devices", status_code=303)
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
        "organizations": scope.get("organizations") or [],
        "notifs": get_notifications(request, db),
    })

@router.get("/devices/guide")
def camera_guide_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    base_url = _resolve_public_web_base(request)
    bind_host = get_isup_public_host()
    webhook_base_url = base_url.rstrip("/")
    webhook_parts = urlsplit(webhook_base_url)
    webhook_host = str(webhook_parts.hostname or bind_host).strip()
    webhook_port = str(
        webhook_parts.port
        or (443 if webhook_parts.scheme == "https" else 80)
    )
    isup_guide = {
        "bind_host": bind_host,
        "server_host": bind_host,
        "register_port": ISUP_REGISTER_PORT,
        "alarm_port": ISUP_ALARM_PORT,
        "picture_port": ISUP_PICTURE_PORT,
        "api_port": ISUP_API_PORT,
        "isup_key": ISUP_KEY,
        "webhook_base_url": webhook_base_url,
        "webhook_host": webhook_host,
        "webhook_port": webhook_port,
        "webhook_path": "/api/v1/httppost/",
        "webhook_url": f"{webhook_base_url}/api/v1/httppost/",
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
    scope = _resolve_camera_page_scope(request, db)
    cam_id_raw = str(request.query_params.get("id") or "").strip()
    try:
        cam_id = int(cam_id_raw)
    except ValueError:
        return RedirectResponse(url="/devices", status_code=303)

    camera_query = db.query(Device).filter(Device.id == cam_id)
    if not bool(scope.get("is_super_admin")):
        allowed_org_ids = list(scope.get("allowed_org_ids") or [])
        if not allowed_org_ids:
            return RedirectResponse(url="/devices", status_code=303)
        camera_query = camera_query.filter(Device.organization_id.in_(allowed_org_ids))

    cam = camera_query.first()
    if cam is None:
        return RedirectResponse(url="/devices", status_code=303)

    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse(request=request, name="camera_info.html", context={
        "request": request,
        "page_title": "Kamera Ma'lumoti" if lang == "uz" else "Информация о камере",
        "menus": menus,
        "t": t,
        "lang": lang,
        "camera": cam or {},
        "cameras": [],
        "camera_manage_allowed": bool(scope.get("is_super_admin")),
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

def _render_employee_page(request: Request, db: Session, *, view_mode: str):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_cfg = _build_employee_page_config(view_mode, menus, lang)
    return templates.TemplateResponse(request=request, name="employees.html", context={
        "request": request,
        "page_title": page_cfg["page_title"],
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(request, db),
        **page_cfg,
    })


@router.get("/staff")
def staff_page(request: Request, db: Session = Depends(get_db)):
    return _render_employee_page(request, db, view_mode="staff")


@router.get("/students")
def students_page(request: Request, db: Session = Depends(get_db)):
    return _render_employee_page(request, db, view_mode="students")


@router.get("/employees")
def employees_page(request: Request, db: Session = Depends(get_db)):
    return _render_employee_page(request, db, view_mode="all")


@router.get("/shifts")
def shifts_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    organizations, shift_rows, shift_stats = _build_shifts_page_payload(request, db, lang)
    return templates.TemplateResponse(request=request, name="shifts.html", context={
        "request": request,
        "page_title": menus.get("shifts", "Смены" if lang == "ru" else "Smenalar"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": organizations,
        "shift_rows": shift_rows,
        "shift_stats": shift_stats,
        "notifs": get_notifications(request, db),
    })


@router.get("/employees/catalogs")
def employee_catalogs_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse(request=request, name="employee_catalogs.html", context={
        "request": request,
        "page_title": "Bo'lim va lavozimlar" if lang == "uz" else "Отделы и должности",
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(request, db),
    })


@router.get("/employees/add")
def add_employee_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    form_kind = str(request.query_params.get("kind") or "").strip().lower()
    if form_kind == "student":
        page_title = "Добавить ученика" if lang == "ru" else "O'quvchi qo'shish"
        employee_form_title = "Добавить ученика или студента" if lang == "ru" else "Yangi o'quvchi yoki talaba qo'shish"
        employee_form_description = "Заполните данные для нового ученика или студента." if lang == "ru" else "Yangi o'quvchi yoki talaba uchun ma'lumotlarni to'ldiring."
        default_employee_type = "oquvchi"
        return_to_list_url = "/students"
    else:
        page_title = "Добавить сотрудника" if lang == "ru" else "Xodim qo'shish"
        employee_form_title = "Добавить сотрудника" if lang == "ru" else "Yangi hodim qo'shish"
        employee_form_description = "Заполните данные для нового сотрудника." if lang == "ru" else "Yangi hodim uchun ma'lumotlarni to'ldiring."
        default_employee_type = "hodim" if form_kind == "staff" else ""
        return_to_list_url = "/staff" if form_kind == "staff" else "/employees"
    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    organizations = (
        db.query(Organization).filter(Organization.id.in_(allowed_org_ids)).order_by(Organization.name).all()
        if allowed_org_ids
        else []
    )
    default_organization_id = int(organizations[0].id) if len(organizations) == 1 else None
    return templates.TemplateResponse(request=request, name="add_employee.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": organizations,
        "default_organization_id": default_organization_id,
        "single_organization_mode": len(organizations) == 1,
        "schedule_selected_id": "",
        "schedule_help": "Avval tashkilotni tanlang.",
        "cameras": db.query(Device).order_by(Device.name).all(),
        "employee_form_title": employee_form_title,
        "employee_form_description": employee_form_description,
        "default_employee_type": default_employee_type,
        "return_to_list_url": return_to_list_url,
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
    schedule_payload = resolve_employee_schedule(emp)
    return templates.TemplateResponse(request=request, name="employee_profile.html", context={
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "emp": emp,
        "schedule_payload": schedule_payload,
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
    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    organizations = (
        db.query(Organization).filter(Organization.id.in_(allowed_org_ids)).order_by(Organization.name).all()
        if allowed_org_ids
        else []
    )
    default_organization_id = int(organizations[0].id) if len(organizations) == 1 else None
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
        "organizations": organizations,
        "default_organization_id": default_organization_id,
        "single_organization_mode": len(organizations) == 1,
        "schedule_selected_id": int(emp.schedule_id) if emp.schedule_id is not None else "",
        "schedule_help": "Tashkilot uchun smenalar yuklanadi.",
        "cameras": db.query(Device).order_by(Device.name).all(),
        "notifs": get_notifications(request, db),
    })

@router.get("/commands")
def commands_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    scope = _resolve_camera_page_scope(request, db)
    organizations = scope.get("organizations") or []
    allowed_org_ids = list(scope.get("allowed_org_ids") or [])
    cameras_query = db.query(Device)
    if not bool(scope.get("is_super_admin")):
        cameras_query = cameras_query.filter(Device.organization_id.in_(allowed_org_ids)) if allowed_org_ids else cameras_query.filter(Device.id == -1)
    return templates.TemplateResponse(request=request, name="commands.html", context={
        "request": request,
        "page_title": menus.get("commands"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "cameras": [
            {"id": c.id, "name": c.name, "organization_id": c.organization_id}
            for c in cameras_query.order_by(Device.name).all()
        ],
        "organizations": organizations,
        "camera_command_allowed": bool(scope.get("is_super_admin")),
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
    table_search = str(request.query_params.get("q") or "").strip()
    selected_department_id = str(request.query_params.get("department_id") or "all").strip() or "all"
    selected_position_id = str(request.query_params.get("position_id") or "all").strip() or "all"
    try:
        current_page = max(1, int(request.query_params.get("page") or 1))
    except Exception:
        current_page = 1
    page_size = 50

    def _norm(value: str | None) -> str:
        text = str(value or "").strip().casefold().replace("yo'q", "yoq")
        for ch in ["_", "-", ".", ",", ";", ":", "!", "?", "(", ")", "[", "]", '"', "'", "/", "\\"]:
            text = text.replace(ch, " ")
        while "  " in text:
            text = text.replace("  ", " ")
        return text.strip()

    category_keys = ("happy", "neutral", "sad", "fear", "angry", "surprise", "disgust", "contempt", "undetermined")
    categories = []
    for key in category_keys:
        label_uz, label_ru = state_labels(key)
        categories.append({"key": key, "uz": label_uz.title(), "ru": label_ru.title()})

    def _infer_state_key(row: EmployeePsychologicalState) -> str:
        if str(row.state_key or "").strip():
            return str(row.state_key).strip()
        norm_uz = _norm(row.state_uz)
        norm_ru = _norm(row.state_ru)
        for key in category_keys:
            label_uz, label_ru = state_labels(key)
            if norm_uz and norm_uz == _norm(label_uz):
                return key
            if norm_ru and norm_ru == _norm(label_ru):
                return key
        return "undetermined"

    invalid_state_keys = tuple(sorted(PROFILELESS_STATES))

    def _apply_valid_portrait_filters(query):
        return query.filter(
            EmployeePsychologicalState.state_key.isnot(None),
            EmployeePsychologicalState.state_key != "",
            EmployeePsychologicalState.state_key.notin_(invalid_state_keys),
            EmployeePsychologicalState.emotion_scores_json.isnot(None),
            EmployeePsychologicalState.emotion_scores_json != "",
            EmployeePsychologicalState.confidence.isnot(None),
        )

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
    department_choices = (
        db.query(Department.id, Department.name)
        .filter(Department.organization_id.in_(allowed_org_ids or [-1]))
        .order_by(Department.name.asc())
        .all()
    )
    position_q = (
        db.query(Position.id, Position.name, Position.department_id)
        .filter(Position.organization_id.in_(allowed_org_ids or [-1]))
    )
    if selected_department_id != "all" and selected_department_id.isdigit():
        position_q = position_q.filter(Position.department_id == int(selected_department_id))
    position_choices = position_q.order_by(Position.name.asc()).all()

    valid_snapshot_dates = db.query(
        AttendanceLog.employee_id.label("employee_id"),
        func.date(AttendanceLog.timestamp).label("state_date"),
        func.max(AttendanceLog.id).label("latest_log_id"),
    )
    if scoped_employee_ids:
        valid_snapshot_dates = valid_snapshot_dates.filter(AttendanceLog.employee_id.in_(scoped_employee_ids))
    else:
        valid_snapshot_dates = valid_snapshot_dates.filter(AttendanceLog.id == -1)
    valid_snapshot_dates = (
        valid_snapshot_dates
        .filter(
            AttendanceLog.employee_id.isnot(None),
            AttendanceLog.snapshot_url.isnot(None),
            AttendanceLog.snapshot_url != "",
            AttendanceLog.psychological_state_key.isnot(None),
            AttendanceLog.psychological_state_key != "",
            AttendanceLog.psychological_state_key.notin_(invalid_state_keys),
            AttendanceLog.emotion_scores_json.isnot(None),
            AttendanceLog.emotion_scores_json != "",
        )
        .group_by(AttendanceLog.employee_id, func.date(AttendanceLog.timestamp))
        .subquery()
    )
    valid_snapshots = (
        db.query(
            AttendanceLog.id.label("attendance_log_id"),
            AttendanceLog.employee_id.label("employee_id"),
            func.date(AttendanceLog.timestamp).label("state_date"),
            AttendanceLog.snapshot_url.label("snapshot_url"),
        )
        .join(valid_snapshot_dates, AttendanceLog.id == valid_snapshot_dates.c.latest_log_id)
        .subquery()
    )

    states_base = (
        db.query(EmployeePsychologicalState)
        .join(
            valid_snapshots,
            and_(
                valid_snapshots.c.employee_id == EmployeePsychologicalState.employee_id,
                valid_snapshots.c.state_date == EmployeePsychologicalState.state_date,
            ),
        )
    )
    if scoped_employee_ids:
        states_base = states_base.filter(EmployeePsychologicalState.employee_id.in_(scoped_employee_ids))
    else:
        states_base = states_base.filter(EmployeePsychologicalState.id == -1)
    states_base = _apply_valid_portrait_filters(states_base)

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

    public_base_url = normalize_public_web_base_url(get_public_web_base_url())

    def _absolute_asset_url(value: str | None) -> str | None:
        text = str(value or "").strip()
        if not text:
            return None
        if text.startswith("http://") or text.startswith("https://"):
            if resolve_snapshot_path(text) is None:
                return None
            return text
        if text.startswith("/"):
            if resolve_snapshot_path(text) is None:
                return None
            return f"{public_base_url}{text}"
        if resolve_snapshot_path(text) is None:
            return None
        return text

    filtered_state_pairs = (
        filtered_states
        .with_entities(EmployeePsychologicalState, valid_snapshots.c.snapshot_url)
        .order_by(EmployeePsychologicalState.assessed_at.desc(), EmployeePsychologicalState.id.desc())
        .all()
    )
    filtered_state_rows = [row for row, snapshot_url in filtered_state_pairs if _absolute_asset_url(snapshot_url)]
    selected_total = len(filtered_state_rows)
    selected_employees = len({int(row.employee_id) for row in filtered_state_rows if row.employee_id is not None})
    selected_coverage = round((selected_employees / total_employees) * 100) if total_employees else 0

    latest_state = filtered_state_rows[0] if filtered_state_rows else None
    latest_activity = latest_state.assessed_at.isoformat() if latest_state and latest_state.assessed_at else None

    source_counter: dict[str, int] = {}
    for row in filtered_state_rows:
        source_key = str(row.source or "manual").strip() or "manual"
        source_counter[source_key] = source_counter.get(source_key, 0) + 1
    source_breakdown = []
    for source_key, count_value in source_counter.items():
        safe_source = str(source_key or "manual")
        c = int(count_value or 0)
        source_breakdown.append({"label": safe_source, "count": c, "percent": round((c / max(1, selected_total)) * 100)})
    source_breakdown.sort(key=lambda item: item["count"], reverse=True)

    aggregate_items: list[dict[str, float]] = []
    dominant_counts: dict[str, int] = {item["key"]: 0 for item in categories}
    for row in filtered_state_rows:
        state_key = _infer_state_key(row)
        emotion_scores = deserialize_emotion_scores(row.emotion_scores_json)
        if not emotion_scores and state_key != "undetermined":
            emotion_scores = {state_key: 1.0}
        aggregate_items.append(emotion_scores)
        dominant_counts[state_key] = dominant_counts.get(state_key, 0) + 1

    average_emotions = aggregate_emotion_scores(aggregate_items)
    average_profile = build_psychological_profile(
        max(average_emotions, key=average_emotions.get) if average_emotions else "undetermined",
        emotion_scores=average_emotions,
    )

    state_breakdown = []
    for item in categories:
        key = str(item.get("key") or "undetermined")
        avg_value = float(average_emotions.get(key, 0.0))
        state_breakdown.append(
            {
                "key": key,
                "label": item["uz"] if lang == "uz" else item["ru"],
                "count": int(dominant_counts.get(key, 0)),
                "percent": round(avg_value * 100, 1),
            }
        )

    recent_rows_query = (
        db.query(EmployeePsychologicalState, Employee, valid_snapshots.c.snapshot_url)
        .join(Employee, Employee.id == EmployeePsychologicalState.employee_id)
        .join(
            valid_snapshots,
            and_(
                valid_snapshots.c.employee_id == EmployeePsychologicalState.employee_id,
                valid_snapshots.c.state_date == EmployeePsychologicalState.state_date,
            ),
        )
    )
    if scoped_employee_ids:
        recent_rows_query = recent_rows_query.filter(EmployeePsychologicalState.employee_id.in_(scoped_employee_ids))
    else:
        recent_rows_query = recent_rows_query.filter(EmployeePsychologicalState.id == -1)
    recent_rows_query = _apply_valid_portrait_filters(recent_rows_query)

    recent_rows_query = _apply_date(recent_rows_query)
    if table_search:
        like = f"%{table_search.casefold()}%"
        recent_rows_query = recent_rows_query.filter(
            or_(
                func.lower(Employee.first_name).like(like),
                func.lower(Employee.last_name).like(like),
                func.lower(Employee.middle_name).like(like),
                func.lower(Employee.personal_id).like(like),
            )
        )
    if selected_department_id != "all" and selected_department_id.isdigit():
        recent_rows_query = recent_rows_query.filter(Employee.department_id == int(selected_department_id))
    if selected_position_id != "all" and selected_position_id.isdigit():
        recent_rows_query = recent_rows_query.filter(Employee.position_id == int(selected_position_id))

    recent_rows = (
        recent_rows_query
        .order_by(EmployeePsychologicalState.assessed_at.desc(), EmployeePsychologicalState.id.desc())
        .all()
    )
    recent_states_all = []
    for state, emp, snapshot_url in recent_rows:
        inferred_state_key = _infer_state_key(state)
        emotion_scores = deserialize_emotion_scores(state.emotion_scores_json)
        if not emotion_scores and inferred_state_key != "undetermined":
            emotion_scores = {inferred_state_key: 1.0}
        profile = build_psychological_profile(
            inferred_state_key,
            confidence=state.confidence,
            emotion_scores=emotion_scores,
        )
        source_image_url = _absolute_asset_url(snapshot_url)
        if not source_image_url:
            continue
        recent_states_all.append(
            {
                "employee_id": int(emp.id),
                "employee_name": " ".join(part for part in [emp.first_name, emp.last_name, emp.middle_name] if part and str(part).strip()).strip() or "-",
                "personal_id": str(emp.personal_id or ""),
                "department": str((emp.department_ref.name if emp.department_ref else emp.department) or "-"),
                "position": str((emp.position_ref.name if emp.position_ref else emp.position) or "-"),
                "source_image_url": source_image_url,
                "state": str(state.state_ru or profile.get("state_ru") or "-") if lang == "ru" else str(state.state_uz or profile.get("state_uz") or "-"),
                "state_date": str(state.state_date or ""),
                "state_key": inferred_state_key,
                "source": str(state.source or "manual"),
                "assessed_at": state.assessed_at.isoformat() if state.assessed_at else None,
                "note": str(state.note or ""),
                "confidence_percent": round(float(profile.get("confidence") or 0.0) * 100, 1),
                "profile_text": str(profile.get("profile_text_ru") if lang == "ru" else profile.get("profile_text_uz") or ""),
                "top_emotions": profile.get("top_emotions_ru") if lang == "ru" else profile.get("top_emotions_uz"),
            }
        )

    table_total = len(recent_states_all)
    total_pages = max(1, (table_total + page_size - 1) // page_size)
    current_page = min(current_page, total_pages)
    start_idx = (current_page - 1) * page_size
    page_rows = recent_states_all[start_idx:start_idx + page_size]
    recent_states = []
    for idx, row in enumerate(page_rows, start=1):
        row["row_no"] = start_idx + idx
        recent_states.append(row)

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
        {"label": "Asosiy profil" if lang == "uz" else "Ключевой профиль", "value": average_profile.get("profile_text_uz") if lang == "uz" else average_profile.get("profile_text_ru"), "hint": "O'rtacha emotsiya profili" if lang == "uz" else "Средний профиль эмоций", "tone": "violet"},
        {"label": "So'nggi yozuv vaqti" if lang == "uz" else "Время последней записи", "value": latest_activity or "-", "hint": "Tanlangan davr bo'yicha" if lang == "uz" else "За выбранный период", "tone": "amber"},
        {"label": "Holat darajasi" if lang == "uz" else "Уровень", "value": portrait_level.title(), "hint": "Oddiy ko'rsatkich" if lang == "uz" else "Простой показатель", "tone": "red"},
    ]
    portrait_signals = [
        {"title": "Qamrov" if lang == "uz" else "Покрытие", "value": portrait_score, "description": "Tanlangan davr bo'yicha qamrov foizi" if lang == "uz" else "Процент покрытия за выбранный период"},
        {"title": "Monitoring holati" if lang == "uz" else "Состояние мониторинга", "value": portrait_level.title(), "description": "Yozuvlar to'liqligi" if lang == "uz" else "Полнота записей"},
        {"title": "O'rtacha profil" if lang == "uz" else "Средний профиль", "value": average_profile.get("profile_text_uz") if lang == "uz" else average_profile.get("profile_text_ru"), "description": "Tanlangan davr bo'yicha top-3 emotsiya" if lang == "uz" else "Топ-3 эмоции за выбранный период"},
    ]
    portrait_notes = [
        "Har bir rasm uchun emotsiyalar foizlarda saqlanadi." if lang == "uz" else "Для каждого снимка эмоции сохраняются в процентах.",
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
        "table_search": table_search,
        "selected_department_id": selected_department_id,
        "selected_position_id": selected_position_id,
        "department_choices": [{"id": int(row.id), "name": str(row.name or "-")} for row in department_choices],
        "position_choices": [{"id": int(row.id), "name": str(row.name or "-"), "department_id": int(row.department_id or 0)} for row in position_choices],
        "pagination": {
            "page": current_page,
            "page_size": page_size,
            "total": table_total,
            "total_pages": total_pages,
            "has_prev": current_page > 1,
            "has_next": current_page < total_pages,
            "prev_page": max(1, current_page - 1),
            "next_page": min(total_pages, current_page + 1),
        },
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
            "average_profile_text": average_profile.get("profile_text_ru") if lang == "ru" else average_profile.get("profile_text_uz"),
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
    org_ids = [int(o.id) for o in org_rows]
    users_count_by_org = _get_organization_user_counts(db, org_ids)
    organizations = [
        {
            "id": int(o.id),
            "name": str(o.name),
            "organization_type": str(o.organization_type or "boshqa"),
            "organization_type_label": get_organization_type_label(o.organization_type, lang=lang),
            "subscription_status": (o.subscription_status.value if hasattr(o.subscription_status, "value") else str(o.subscription_status or "pending")),
            "default_start_time": str(o.default_start_time or "09:00"),
            "users_count": int(users_count_by_org.get(int(o.id), 0)),
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

@router.get('/middleware-logs')
async def middleware_logs(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse(request=request, name="middleware_logs.html", context={
        "request": request,
        "page_title": menus.get("middleware_logs", "Tizim Loglari"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(request, db),
    })
