from datetime import datetime, timedelta
from fastapi import APIRouter, Request, Depends
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from database import get_db
from models import Device, Employee, AttendanceLog, Organization, EmployeeCameraLink
from organization_types import get_organization_type_choices, get_organization_type_label
from system_config import (
    ISUP_ALARM_PORT,
    ISUP_API_PORT,
    ISUP_KEY,
    ISUP_PICTURE_PORT,
    ISUP_REGISTER_PORT,
    REDIS_HOST,
    REDIS_PORT,
    get_isup_public_host,
)
from translations import get_translations

router = APIRouter()
templates = Jinja2Templates(directory="templates")

MENU_TITLES = {
    "uz": {
        "dashboard": "Boshqaruv Paneli",
        "devices": "Kameralar Ro'yxati",
        "events": "Kamera Hodisalari",
        "commands": "Kameraga Buyruqlar",
        "employees": "Xodimlar Ro'yxati",
        "attendance": "Davomat",
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
        "events": "События",
        "commands": "Команды",
        "employees": "Сотрудники",
        "reports": "Опоздания",
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
    {"type": "link", "key": "events", "href": "/events", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>'},
    {"type": "link", "key": "commands", "href": "/commands", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>'},
    {"type": "group", "key": "group_employees"},
    {"type": "link", "key": "employees", "href": "/employees", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>'},
    {"type": "link", "key": "attendance", "href": "/attendance", "icon": '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10m-11 8h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z"/>'},
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
        fallback_uz = "Boshqaruv Paneli" if key == "dashboard" else ("Kameralar Ro'yxati" if key == "devices" else ("Kamera Hodisalari" if key == "events" else ("Kameraga Buyruqlar" if key == "commands" else ("Xodimlar Ro'yxati" if key == "employees" else ("Kechikish Hisoboti" if key == "reports" else ("Sozlamalar" if key == "settings" else ("Tizim Haqida" if key == "about" else ("ISUP Server" if key == "isup_server" else ("Kameralar" if key == "group_cameras" else ("Xodimlar" if key == "group_employees" else ("Tizim Foydalanuvchilari" if key == "users" else "Tashkilotlar")))))))))))
        fallback_ru = "Управление" if key == "dashboard" else ("Список камер" if key == "devices" else ("События" if key == "events" else ("Команды" if key == "commands" else ("Сотрудники" if key == "employees" else ("Опоздания" if key == "reports" else ("Настройки" if key == "settings" else ("О системе" if key == "about" else ("ISUP Сервер" if key == "isup_server" else ("Камеры" if key == "group_cameras" else ("Персонал" if key == "group_employees" else ("Системные пользователи" if key == "users" else "Организации")))))))))))

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

def get_notifications(db: Session) -> dict:
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    org = db.query(Organization).first()
    default_start = org.default_start_time if org and org.default_start_time else "09:00"
    def_h, def_m = map(int, default_start.split(":"))

    todays_first_logs = db.query(AttendanceLog).filter(
        AttendanceLog.status == "aniqlandi",
        AttendanceLog.timestamp >= today_start
    ).order_by(AttendanceLog.timestamp.asc()).all()

    seen_emps = set()
    late_count = 0
    for log in todays_first_logs:
        emp = log.employee
        if not emp or emp.id in seen_emps:
            continue
        seen_emps.add(emp.id)

        expected_h, expected_m = def_h, def_m
        if emp.start_time:
            time_parts = str(emp.start_time).split(":")
            if len(time_parts) >= 2:
                try:
                    expected_h, expected_m = int(time_parts[0]), int(time_parts[1])
                except ValueError:
                    pass

        expected_time = log.timestamp.replace(hour=expected_h, minute=expected_m, second=0, microsecond=0)
        # Avoid timezone mismatch by making sure 'now' and 'timestamp' align. We rely on the log timestamp to see if it exceeded expected time for that day.
        if log.timestamp > expected_time:
            # Check if delay is positive
            delay = int((log.timestamp - expected_time).total_seconds() // 60)
            if delay > 0:
                late_count += 1
                
    # Yana "vaqtigacha kelmaganlar" ni hisoblaymiz (absent_count)
    now = datetime.utcnow()
    all_emps = db.query(Employee).filter(Employee.has_access == True).all()
    absent_count = 0
    for emp in all_emps:
        if emp.id in seen_emps:
            continue
        
        expected_h, expected_m = def_h, def_m
        if emp.start_time:
            time_parts = str(emp.start_time).split(":")
            if len(time_parts) >= 2:
                try:
                    expected_h, expected_m = int(time_parts[0]), int(time_parts[1])
                except ValueError:
                    pass
                    
        expected_time = today_start.replace(hour=expected_h, minute=expected_m, second=0, microsecond=0)
        
        # We only count absent if local current time is past expectation. 
        # But 'now' is UTC by default in original code, which could be 5h off local! 
        # Using a simplistic local time shift, assume UTC+5 for Tashkent.
        local_now = datetime.utcnow() + timedelta(hours=5)
        # Since 'today_start' is UTC midnight, local midday is around 07:00 UTC. 
        # To avoid false absent counts across timezones, let's map correctly:
        if local_now.time() > datetime(2000, 1, 1, expected_h, expected_m).time():
            absent_count += 1

    return {
        "late": late_count,
        "absent": absent_count,
        # Displaying total absent + late on the menu badge confused users. The report is "Kechikish". We should return late_count as total for the badge.
        "total": late_count
    }


@router.get("/")
def dashboard(request: Request, db: Session = Depends(get_db)):
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)

    active_cams = db.query(Device).filter(Device.is_online == True).count()
    total_cameras = db.query(Device).count()
    total_emp = db.query(Employee).count()
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 1. Bugungi ruxsat etilganlar (attendance_logs)
    today_attendance = db.query(AttendanceLog).filter(
        AttendanceLog.status == "aniqlandi",
        AttendanceLog.timestamp >= today_start
    ).count()

    # 2. So'nggi 5 ta hodisa
    recent_logs = (
        db.query(AttendanceLog)
        .filter(AttendanceLog.timestamp.isnot(None))
        .order_by(AttendanceLog.timestamp.desc())
        .limit(5)
        .all()
    )
    recent_events = []
    
    for log in recent_logs:
        avatar = "https://i.pravatar.cc/150?u=noma'lum"
        if log.employee:
            avatar = log.employee.image_url or f"https://i.pravatar.cc/150?u=emp{log.employee.id}"
            name = f"{log.employee.first_name} {log.employee.last_name}"
            emp_id_str = f"EMP{log.employee.id:03d}"
        else:
            name = log.person_name or "Noma'lum Shaxs"
            emp_id_str = ""

        recent_events.append({
            "id": log.id,
            "employee_id": emp_id_str,
            "full_name": name,
            "camera": log.device.name if log.device else log.camera_mac,
            "timestamp": log.timestamp,
            "status": "Ruxsat berildi" if log.status == "aniqlandi" else "Rad etildi",
            "avatar": avatar
        })

    # 3. Kech qolganlarni hisoblash
    org = db.query(Organization).first()
    default_start = org.default_start_time if org and org.default_start_time else "09:00"
    def_h, def_m = map(int, default_start.split(":"))
    
    late_arrivals = []
    
    # Bugungi kelganlar
    todays_first_logs = db.query(AttendanceLog).filter(
        AttendanceLog.status == "aniqlandi",
        AttendanceLog.timestamp >= today_start
    ).order_by(AttendanceLog.timestamp.asc()).all()
    
    # Har bir employee uchun bugun birinchi ko'rinishi
    seen_emps = set()
    for log in todays_first_logs:
        emp = log.employee
        if not emp or emp.id in seen_emps:
            continue
        seen_emps.add(emp.id)
        
        expected_h, expected_m = def_h, def_m
        if emp.start_time:
            # Safely parse employee start time which might come in 'HH:MM' or 'HH:MM:SS'
            time_parts = str(emp.start_time).split(":")
            if len(time_parts) >= 2:
                try:
                    expected_h, expected_m = int(time_parts[0]), int(time_parts[1])
                except ValueError:
                    pass
                
        expected_time = log.timestamp.replace(hour=expected_h, minute=expected_m, second=0, microsecond=0)
        
        # Agar haqiqatda kechikkan bo'lsa
        if log.timestamp > expected_time:
            delay_seconds = (log.timestamp - expected_time).total_seconds()
            delay = int(delay_seconds // 60)
            if delay > 0:
                late_arrivals.append({
                    "employee_id": f"EMP{emp.id:03d}",
                    "employee_db_id": int(emp.id),
                    "full_name": f"{emp.first_name} {emp.last_name}",
                    "department": emp.department or "Noma'lum",
                    "organization_id": int(emp.organization_id) if emp.organization_id is not None else None,
                    "organization_name": emp.organization.name if emp.organization else "-",
                    "camera": log.device.name if log.device else "Noma'lum Kamera",
                    "arrival_time": log.timestamp,
                    "expected_time": expected_time,
                    "delay_minutes": delay,
                    "delay_human": _format_delay_human(delay, lang),
                    "avatar": emp.image_url or f"https://i.pravatar.cc/150?u=emp{emp.id}",
                    "status": "Kech Keldi"
                })

    late_arrivals = sorted(late_arrivals, key=lambda x: x["delay_minutes"], reverse=True)

    context = {
        "request": request,
        "page_title": get_menus_dict(request).get("dashboard", t["dashboard_title"]),
        "menus": get_menus_dict(request),
        "t": t,
        "lang": lang,
        "total_employees": total_emp,
        "active_cameras": active_cams,
        "total_cameras": total_cameras,
        "today_attendance": today_attendance,
        "late_count": len(late_arrivals),
        "recent_events": recent_events,
        "late_arrivals": late_arrivals[:3],
    }
    return templates.TemplateResponse("dashboard.html", context)


@router.get("/devices")
def devices_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse("devices.html", {
        "request": request,
        "page_title": menus.get("devices"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(db),
        "organizations": db.query(Organization).order_by(Organization.name).all(),
    })

@router.get("/devices/add")
def add_device_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Добавить камеру" if lang == "ru" else "Kamera qo'shish"
    return templates.TemplateResponse("add_device.html", {
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "notifs": get_notifications(db),
    })

@router.get("/users")
def users_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Системные пользователи" if lang == "ru" else "Tizim Foydalanuvchilari"
    return templates.TemplateResponse("users.html", {
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "notifs": get_notifications(db),
    })

@router.get("/users/add")
def add_user_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Добавить пользователя" if lang == "ru" else "Foydalanuvchi qo'shish"
    return templates.TemplateResponse("add_user.html", {
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "notifs": get_notifications(db),
    })

@router.get("/users/{user_id}/edit")
def edit_user_page(request: Request, user_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    from models import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Foydalanuvchi topilmadi")
        
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Редактировать пользователя" if lang == "ru" else "Foydalanuvchini Tahrirlash"
    return templates.TemplateResponse("edit_user.html", {
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "user": user,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "notifs": get_notifications(db),
    })


@router.get("/organization-info")
def organization_info_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Tashkilot Ma'lumoti" if lang == "uz" else "Информация об организации"
    return templates.TemplateResponse("organization_info.html", {
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(db),
    })

@router.get("/devices/edit")
def edit_camera_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Kamerani Tahrirlash" if lang == "uz" else "Редактировать камеру"
    return templates.TemplateResponse("edit_camera.html", {
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "notifs": get_notifications(db),
    })

@router.get("/devices/guide")
def camera_guide_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    base_url = str(request.base_url).rstrip("/")
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
    return templates.TemplateResponse("camera_guide.html", {
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "isup_guide": isup_guide,
        "notifs": get_notifications(db),
    })

@router.get("/api-helper")
def api_helper_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    base_url = str(request.base_url).rstrip("/")
    bind_host = get_isup_public_host()
    now = datetime.utcnow()
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
    return templates.TemplateResponse("api_helper.html", {
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "base_url": base_url,
        "cameras": cameras,
        "isup_config": isup_config,
        "notifs": get_notifications(db),
    })


@router.get("/camera-info")
def camera_info_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    cam = db.query(Device).first()
    return templates.TemplateResponse("camera_info.html", {
        "request": request,
        "page_title": "Kamera Ma'lumoti" if lang == "uz" else "Информация о камере",
        "menus": menus,
        "t": t,
        "lang": lang,
        "camera": cam or {},
        "cameras": [],
        "notifs": get_notifications(db),
    })


@router.get("/events")
def events_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse("events.html", {
        "request": request,
        "page_title": menus.get("events"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "cameras": [c.name for c in db.query(Device).all()],
        "notifs": get_notifications(db),
    })


@router.get("/attendance")
def attendance_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse("attendance.html", {
        "request": request,
        "page_title": menus.get("attendance", "Davomat"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(db),
    })

@router.get("/employees")
def employees_page(request: Request, db: Session = Depends(get_db)):
    emps = db.query(Employee).all()
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse("employees.html", {
        "request": request,
        "page_title": menus.get("employees"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "employees": emps,
        "notifs": get_notifications(db),
    })

@router.get("/employees/add")
def add_employee_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Добавить сотрудника" if lang == "ru" else "Xodim qo'shish"
    return templates.TemplateResponse("add_employee.html", {
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "cameras": db.query(Device).order_by(Device.name).all(),
        "notifs": get_notifications(db),
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
    return templates.TemplateResponse("employee_profile.html", {
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
        "notifs": get_notifications(db),
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
    return templates.TemplateResponse("edit_employee.html", {
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "emp": emp,
        "linked_camera_ids": linked_camera_ids,
        "organizations": db.query(Organization).order_by(Organization.name).all(),
        "cameras": db.query(Device).order_by(Device.name).all(),
        "notifs": get_notifications(db),
    })

@router.get("/commands")
def commands_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    organizations = db.query(Organization).order_by(Organization.name).all()
    return templates.TemplateResponse("commands.html", {
        "request": request,
        "page_title": menus.get("commands"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "cameras": [{"id": c.id, "name": c.name, "organization_id": c.organization_id} for c in db.query(Device).all()],
        "organizations": organizations,
        "notifs": get_notifications(db),
    })


@router.get("/reports")
def reports_page(request: Request, db: Session = Depends(get_db)):
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)

    org = db.query(Organization).first()
    default_start = org.default_start_time if org and org.default_start_time else "09:00"
    def_h, def_m = map(int, default_start.split(":"))
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    todays_first_logs = db.query(AttendanceLog).filter(
        AttendanceLog.status == "aniqlandi",
        AttendanceLog.timestamp >= today_start
    ).order_by(AttendanceLog.timestamp.asc()).all()
    
    late_arrivals = []
    on_time_count = 0
    seen_emps = set()
    
    for log in todays_first_logs:
        emp = log.employee
        if not emp or emp.id in seen_emps:
            continue
        seen_emps.add(emp.id)
        
        expected_h, expected_m = def_h, def_m
        if emp.start_time:
            time_parts = str(emp.start_time).split(":")
            if len(time_parts) >= 2:
                try:
                    expected_h, expected_m = int(time_parts[0]), int(time_parts[1])
                except ValueError:
                    pass
                
        expected_time = log.timestamp.replace(hour=expected_h, minute=expected_m, second=0, microsecond=0)
        
        if log.timestamp > expected_time:
            delay = int((log.timestamp - expected_time).total_seconds() / 60)
            if delay > 0:
                late_arrivals.append({
                    "employee_id": f"EMP{emp.id:03d}",
                    "full_name": f"{emp.first_name} {emp.last_name}",
                    "department": emp.department or "Noma'lum",
                    "organization_id": int(emp.organization_id) if emp.organization_id is not None else None,
                    "organization_name": emp.organization.name if emp.organization else "-",
                    "camera": log.device.name if log.device else "Noma'lum Kamera",
                    "arrival_time": log.timestamp.isoformat() if log.timestamp else None,
                    "expected_time": expected_time.isoformat() if expected_time else None,
                    "delay_minutes": delay,
                    "delay_human": _format_delay_human(delay, lang),
                    "avatar": emp.image_url or f"https://i.pravatar.cc/150?u=emp{emp.id}",
                    "status": "Kech Keldi"
                })
        else:
            on_time_count += 1

    late_arrivals = sorted(late_arrivals, key=lambda x: x["delay_minutes"], reverse=True)
    
    menus = get_menus_dict(request)
    return templates.TemplateResponse("reports.html", {
        "request": request,
        "page_title": menus.get("reports"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "late_arrivals": late_arrivals,
        "late_count": len(late_arrivals),
        "total_employees": db.query(Employee).count(),
        "on_time_count": on_time_count,
        "cameras": [c.name for c in db.query(Device).all()],
        "organizations": [
            {"id": int(o.id), "name": str(o.name)}
            for o in db.query(Organization).order_by(Organization.name.asc()).all()
        ],
    })


@router.get("/employees")
def employees_page_alt(request: Request, db: Session = Depends(get_db)):
    # This duplicate is kept here for compatibility with older routes order
    emps = db.query(Employee).all()
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse("employees.html", {
        "request": request,
        "page_title": menus.get("employees"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "employees": emps,
        "notifs": get_notifications(db),
    })


@router.get("/about")
def about_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse("about.html", {
        "request": request,
        "page_title": menus.get("about"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(db),
    })


@router.get("/settings")
def settings_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse("settings.html", {
        "request": request,
        "page_title": menus.get("settings"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(db),
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
            "subscription_status": (
                o.subscription_status.value
                if hasattr(o.subscription_status, "value")
                else str(o.subscription_status or "pending")
            ),
            "default_start_time": str(o.default_start_time or "09:00"),
            "default_end_time": str(o.default_end_time or "18:00"),
            "users_count": len(o.users),
            "employees_count": len(o.employees),
            "devices_count": len(o.devices),
        }
        for o in org_rows
    ]
    return templates.TemplateResponse("organizations.html", {
        "request": request,
        "page_title": menus.get("organizations", page_title),
        "menus": menus,
        "t": t,
        "lang": lang,
        "organizations": organizations,
        "notifs": get_notifications(db),
    })


@router.get("/organizations/add")
def add_organization_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    page_title = "Добавить организацию" if lang == "ru" else "Yangi Tashkilot"
    return templates.TemplateResponse("add_organization.html", {
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "organization_types": get_organization_type_choices(lang=lang),
        "notifs": get_notifications(db),
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
    return templates.TemplateResponse("edit_organization.html", {
        "request": request,
        "page_title": page_title,
        "menus": menus,
        "t": t,
        "lang": lang,
        "org": org,
        "organization_types": get_organization_type_choices(lang=lang),
        "notifs": get_notifications(db),
    })

@router.get("/isup-server")
def isup_dashboard_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse("isup_dashboard.html", {
        "request": request,
        "page_title": menus.get("isup_server"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(db),
    })


@router.get("/redis")
def redis_dashboard_page(request: Request, db: Session = Depends(get_db)):
    menus = get_menus_dict(request)
    lang = request.cookies.get("lang", "uz")
    t = get_translations(lang)
    return templates.TemplateResponse("redis_dashboard.html", {
        "request": request,
        "page_title": menus.get("redis_monitor", "REDIS"),
        "menus": menus,
        "t": t,
        "lang": lang,
        "notifs": get_notifications(db),
    })
