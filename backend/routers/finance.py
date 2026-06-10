from typing import Optional
from collections import defaultdict
from datetime import datetime, date, timedelta
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from database import get_db
from models import Employee, AttendanceLog, Holiday
from utils.time_utils import now_tashkent
from utils.schedule_utils import get_late_minutes, load_holiday_dates
from routers.dashboard import _resolve_allowed_org_ids

router = APIRouter()

@router.get("/api/finance/salaries")
def get_salaries(
    request: Request,
    organization_id: Optional[int] = Query(None),
    branch_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query("all"),
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    allowed_orgs = _resolve_allowed_org_ids(request, db)
    if not allowed_orgs:
        return {"salaries": [], "stats": {"totalBase": 0, "totalDeductions": 0, "totalFinal": 0, "paidSum": 0, "unpaidSum": 0}}

    query = db.query(Employee).filter(Employee.has_access == True)

    if organization_id is not None:
        if organization_id not in allowed_orgs:
            return {"salaries": [], "stats": {"totalBase": 0, "totalDeductions": 0, "totalFinal": 0, "paidSum": 0, "unpaidSum": 0}}
        query = query.filter(Employee.organization_id == organization_id)
    else:
        query = query.filter(Employee.organization_id.in_(allowed_orgs))

    if branch_id is not None:
        query = query.filter(Employee.branch_id == branch_id)

    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                Employee.first_name.ilike(search_term),
                Employee.last_name.ilike(search_term),
                Employee.middle_name.ilike(search_term),
                Employee.position.ilike(search_term)
            )
        )

    employees = query.all()
    if not employees:
        return {"salaries": [], "stats": {"totalBase": 0, "totalDeductions": 0, "totalFinal": 0, "paidSum": 0, "unpaidSum": 0}}

    # Date range for target month
    now = now_tashkent()
    target_year = year or now.year
    target_month = month or now.month
    
    days_in_month = monthrange(target_year, target_month)[1]
    month_start = datetime(target_year, target_month, 1, 0, 0, 0)
    # The end of the month
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1, 0, 0, 0)
    else:
        month_end = datetime(target_year, target_month + 1, 1, 0, 0, 0)

    emp_ids = [emp.id for emp in employees]

    # Fetch attendance logs
    logs = (
        db.query(AttendanceLog)
        .filter(
            AttendanceLog.employee_id.in_(emp_ids),
            AttendanceLog.timestamp >= month_start,
            AttendanceLog.timestamp < month_end,
        )
        .order_by(AttendanceLog.employee_id, AttendanceLog.timestamp.asc())
        .all()
    )

    # Group first log of each day by employee
    logs_by_emp_day = {}
    for log in logs:
        if not log.timestamp:
            continue
        day_str = log.timestamp.strftime("%Y-%m-%d")
        key = (log.employee_id, day_str)
        if key not in logs_by_emp_day:
            logs_by_emp_day[key] = log.timestamp

    # Load holidays
    holiday_dates = load_holiday_dates(
        db,
        start_date=month_start.date(),
        end_date=(month_start + timedelta(days=days_in_month-1)).date(),
        organization_ids=allowed_orgs,
    )
    global_holidays = holiday_dates.get(None, set())

    # Calculate late counts
    late_counts = defaultdict(int)
    for emp in employees:
        org_id = emp.organization_id
        org_holidays = holiday_dates.get(org_id, set()) if org_id is not None else set()

        for day_num in range(1, days_in_month + 1):
            day_dt = date(target_year, target_month, day_num)
            day_str = day_dt.isoformat()

            if day_str in global_holidays or day_str in org_holidays:
                continue

            first_seen = logs_by_emp_day.get((emp.id, day_str))
            if first_seen:
                late_mins = get_late_minutes(emp, day_dt, first_seen)
                if late_mins > 0:
                    late_counts[emp.id] += 1

    # Format salary items
    salary_list = []
    total_base = 0
    total_deductions = 0
    total_final = 0
    paid_sum = 0
    unpaid_sum = 0

    for emp in employees:
        base_salary = emp.salary or 0
        lates = late_counts[emp.id]
        deduction = lates * 50000
        final_amount = max(0, base_salary - deduction)

        emp_status = emp.salary_status or "unpaid"

        # Filter by status if specified
        if status != "all" and emp_status != status:
            continue

        role_name = emp.position or (emp.position_ref.name if emp.position_ref else (emp.employee_type or "Xodim"))
        full_name = f"{emp.first_name} {emp.last_name}"
        if emp.middle_name:
            full_name += f" {emp.middle_name}"

        item = {
            "id": emp.id,
            "name": full_name,
            "role": role_name,
            "base": base_salary,
            "lateCount": lates,
            "status": emp_status,
            "organization_id": emp.organization_id,
            "branch_id": emp.branch_id,
        }
        salary_list.append(item)

        total_base += base_salary
        total_deductions += deduction
        total_final += final_amount
        if emp_status == "paid":
            paid_sum += final_amount
        else:
            unpaid_sum += final_amount

    return {
        "salaries": salary_list,
        "stats": {
            "totalBase": total_base,
            "totalDeductions": total_deductions,
            "totalFinal": total_final,
            "paidSum": paid_sum,
            "unpaidSum": unpaid_sum,
        }
    }

@router.post("/api/finance/salaries/{emp_id}/pay")
def pay_salary(
    request: Request,
    emp_id: int,
    db: Session = Depends(get_db),
):
    allowed_orgs = _resolve_allowed_org_ids(request, db)
    emp = db.query(Employee).filter(Employee.id == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    if emp.organization_id not in allowed_orgs:
        raise HTTPException(status_code=403, detail="Ruxsat berilmagan")

    emp.salary_status = "paid"
    db.commit()
    return {"status": "success", "message": "Oylik muvaffaqiyatli to'landi"}

@router.post("/api/finance/salaries/reset")
def reset_salaries(
    request: Request,
    organization_id: Optional[int] = Query(None),
    branch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    allowed_orgs = _resolve_allowed_org_ids(request, db)
    if not allowed_orgs:
        raise HTTPException(status_code=403, detail="Ruxsat berilmagan")

    query = db.query(Employee)
    if organization_id is not None:
        if organization_id not in allowed_orgs:
            raise HTTPException(status_code=403, detail="Ruxsat berilmagan")
        query = query.filter(Employee.organization_id == organization_id)
    else:
        query = query.filter(Employee.organization_id.in_(allowed_orgs))

    if branch_id is not None:
        query = query.filter(Employee.branch_id == branch_id)

    employees = query.all()
    for emp in employees:
        emp.salary_status = "unpaid"

    db.commit()
    return {"status": "success", "message": "Barcha to'lov holatlari yangilandi"}
