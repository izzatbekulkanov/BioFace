from collections import defaultdict
from datetime import timedelta
from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from database import get_db
from models import (
    AttendanceLog,
    Device,
    Employee,
    EmployeeCameraLink,
    Organization,
    User,
    UserOrganizationLink,
)
from utils.time_utils import now_tashkent, today_tashkent_range
from utils.schedule_utils import get_attendance_deadline, get_late_minutes, load_holiday_dates

router = APIRouter()


def _resolve_allowed_org_ids(request: Request, db: Session) -> list[int]:
    auth_user = request.session.get("auth_user") or {}
    role = str(auth_user.get("role") or "").strip().lower()

    # SuperAdmin -> hamma aktiv (expired emas) tashkilotlar
    if role in {"superadmin", "super_admin"}:
        org_rows = db.query(Organization.id, Organization.subscription_status).all()
        allowed: list[int] = []
        for org_id, sub_status in org_rows:
            status = str(sub_status.value if hasattr(sub_status, "value") else sub_status or "").strip().lower()
            if status == "expired":
                continue
            allowed.append(int(org_id))
        return sorted(allowed)

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


def _build_holiday_checker(db: Session, target_day, organization_ids: list[int] | None):
    day_key = target_day.isoformat()
    holiday_dates = load_holiday_dates(
        db,
        start_date=target_day,
        end_date=target_day,
        organization_ids=organization_ids or None,
    )
    global_holidays = holiday_dates.get(None, set())
    org_holidays = {
        int(org_id): dates
        for org_id, dates in holiday_dates.items()
        if org_id is not None
    }

    def _is_holiday(organization_id) -> bool:
        if day_key in global_holidays:
            return True
        if organization_id is None:
            return False
        try:
            return day_key in org_holidays.get(int(organization_id), set())
        except Exception:
            return False

    return _is_holiday


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
    is_holiday = _build_holiday_checker(db, today_start.date(), org_ids)
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
        if is_holiday(org_id):
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


@router.get("/api/dashboard/metrics")
def dashboard_metrics_api(request: Request, db: Session = Depends(get_db)):
    import time as _time
    auth_user = request.session.get("auth_user") or {}
    user_id = auth_user.get("id") or "anon"
    cache_key = f"dash_metrics_{user_id}"
    cache = getattr(dashboard_metrics_api, "_cache", {})
    now_ts = _time.time()
    cached = cache.get(cache_key)
    if cached and now_ts - cached["ts"] < 300:  # 5 minutes
        return {"ok": True, "dashboard": cached["data"], "cached": True, "cache_age": int(now_ts - cached["ts"])}

    data = _build_dashboard_metrics(request, db)
    cache[cache_key] = {"ts": now_ts, "data": data}
    if len(cache) > 100:
        for k in [k for k, v in cache.items() if now_ts - v["ts"] > 1800]:
            cache.pop(k, None)
    dashboard_metrics_api._cache = cache
    return {"ok": True, "dashboard": data, "cache_age": 0}


@router.get("/api/dashboard/weekly-trend")
def dashboard_weekly_trend(request: Request, db: Session = Depends(get_db)):
    """Oxirgi 7 kunlik davomat trendi. 10 daqiqali cache."""
    import time as _time
    auth_user = request.session.get("auth_user") or {}
    user_id = auth_user.get("id") or "anon"
    cache_key = f"dash_trend_{user_id}"
    cache = getattr(dashboard_weekly_trend, "_cache", {})
    now_ts = _time.time()
    cached = cache.get(cache_key)
    if cached and now_ts - cached["ts"] < 600:  # 10 minutes
        return {"ok": True, "days": cached["data"], "cached": True}

    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    if not allowed_org_ids:
        return {"ok": True, "days": []}

    now_local = now_tashkent()
    days = []
    for i in range(6, -1, -1):
        day = now_local.date() - timedelta(days=i)
        day_start = day.strftime("%Y-%m-%d") + "T00:00:00"
        day_end = day.strftime("%Y-%m-%d") + "T23:59:59"

        present_count = (
            db.query(func.count(func.distinct(AttendanceLog.employee_id)))
            .join(Employee, Employee.id == AttendanceLog.employee_id)
            .filter(
                AttendanceLog.status == "aniqlandi",
                Employee.organization_id.in_(allowed_org_ids),
                AttendanceLog.timestamp >= day_start,
                AttendanceLog.timestamp <= day_end,
            )
            .scalar() or 0
        )
        total_employees = (
            db.query(func.count(Employee.id))
            .filter(Employee.organization_id.in_(allowed_org_ids), Employee.has_access.is_(True))
            .scalar() or 0
        )
        days.append({
            "date": day.strftime("%d.%m"),
            "weekday": day.strftime("%a"),
            "present": int(present_count),
            "total": int(total_employees),
            "absent": max(0, int(total_employees) - int(present_count)),
        })

    cache[cache_key] = {"ts": now_ts, "data": days}
    if len(cache) > 100:
        for k in [k for k, v in cache.items() if now_ts - v["ts"] > 1800]:
            cache.pop(k, None)
    dashboard_weekly_trend._cache = cache
    return {"ok": True, "days": days}


@router.get("/api/dashboard/recent-events")
def dashboard_recent_events(request: Request, db: Session = Depends(get_db)):
    """Oxirgi 20 ta davomat hodisasi."""
    allowed_org_ids = _resolve_allowed_org_ids(request, db)
    if not allowed_org_ids:
        return {"ok": True, "events": []}

    logs = (
        db.query(AttendanceLog)
        .join(Employee, Employee.id == AttendanceLog.employee_id, isouter=True)
        .filter(
            Employee.organization_id.in_(allowed_org_ids),
        )
        .order_by(AttendanceLog.timestamp.desc())
        .limit(20)
        .all()
    )
    events = []
    for log in logs:
        events.append({
            "id": log.id,
            "employee_name": log.person_name or (
                f"{log.employee.first_name} {log.employee.last_name}" if log.employee else "Noma'lum"
            ),
            "timestamp": log.timestamp.strftime("%H:%M:%S") if log.timestamp else "",
            "date": log.timestamp.strftime("%d.%m.%Y") if log.timestamp else "",
            "status": log.status or "aniqlandi",
            "snapshot_url": log.snapshot_url,
            "device_name": log.device.name if log.device else None,
        })
    return {"ok": True, "events": events}
