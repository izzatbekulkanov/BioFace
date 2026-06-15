from typing import Optional
from collections import defaultdict
from datetime import datetime, date, timedelta
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from database import get_db
from models import Employee, AttendanceLog, Holiday, CashflowTransaction, FinanceAccount, AccountTransfer
from utils.time_utils import now_tashkent
from utils.schedule_utils import get_late_minutes, load_holiday_dates, get_expected_start_dt, get_expected_end_dt
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

    now_t = now_tashkent()
    today_date = now_t.date()

    # Calculate late counts and absent counts
    late_counts = defaultdict(int)
    late_details = defaultdict(list)
    absent_counts_up_to_today = defaultdict(int)
    working_days_counts = defaultdict(int)

    for emp in employees:
        org_id = emp.organization_id
        org_holidays = holiday_dates.get(org_id, set()) if org_id is not None else set()

        total_working_days = 0
        absent_days_up_to_today = 0

        for day_num in range(1, days_in_month + 1):
            day_dt = date(target_year, target_month, day_num)
            day_str = day_dt.isoformat()

            # Sunday (weekday == 6 in python)
            is_weekend = day_dt.weekday() == 6
            is_holiday = day_str in global_holidays or day_str in org_holidays

            if not is_weekend and not is_holiday:
                total_working_days += 1
                if day_dt <= today_date:
                    first_seen = logs_by_emp_day.get((emp.id, day_str))
                    if not first_seen:
                        absent_days_up_to_today += 1

                first_seen = logs_by_emp_day.get((emp.id, day_str))
                if first_seen:
                    late_mins = get_late_minutes(emp, day_dt, first_seen)
                    if late_mins > 0:
                        late_counts[emp.id] += 1
                        expected_start = get_expected_start_dt(emp, day_dt)
                        expected_end = get_expected_end_dt(emp, day_dt)
                        expected_duration_mins = int((expected_end - expected_start).total_seconds() // 60)
                        if expected_duration_mins <= 0:
                            expected_duration_mins = 540  # fallback to 9 hours
                        late_details[emp.id].append((late_mins, expected_duration_mins))

        working_days_counts[emp.id] = total_working_days
        absent_counts_up_to_today[emp.id] = absent_days_up_to_today

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

        working_days = working_days_counts[emp.id]
        absents = absent_counts_up_to_today[emp.id]

        # Calculate proportional late deduction
        late_deduction = 0
        if working_days > 0:
            for mins, dur in late_details[emp.id]:
                if dur > 0:
                    daily_rate = base_salary / working_days
                    minutely_rate = daily_rate / dur
                    late_deduction += int(round(minutely_rate * mins))

        if working_days > 0:
            absent_deduction = int(round((base_salary / working_days) * absents))
        else:
            absent_deduction = 0

        deduction = late_deduction + absent_deduction
        final_amount = max(0, base_salary - deduction)

        emp_status = emp.salary_status or "unpaid"

        # Filter by status if specified
        if status != "all":
            if status == "unpaid":
                if emp_status not in ("unpaid", "advance"):
                    continue
            elif emp_status != status:
                continue

        role_name = emp.position or (emp.position_ref.name if emp.position_ref else (emp.employee_type or "Xodim"))
        full_name = f"{emp.first_name} {emp.last_name}"
        if emp.middle_name:
            full_name += f" {emp.middle_name}"

        item = {
            "id": emp.id,
            "uuid": emp.uuid,
            "name": full_name,
            "role": role_name,
            "base": base_salary,
            "lateCount": lates,
            "lateDeduction": late_deduction,
            "absentCount": absents,
            "absentDeduction": absent_deduction,
            "workingDays": working_days,
            "finalAmount": final_amount,
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
        elif emp_status == "advance":
            adv_paid = final_amount // 2
            paid_sum += adv_paid
            unpaid_sum += final_amount - adv_paid
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
    emp_id: str,
    pay_type: str = Query("full"),  # "full" or "advance"
    db: Session = Depends(get_db),
):
    allowed_orgs = _resolve_allowed_org_ids(request, db)
    if emp_id.isdigit():
        emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    else:
        emp = db.query(Employee).filter(Employee.uuid == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    if emp.organization_id not in allowed_orgs:
        raise HTTPException(status_code=403, detail="Ruxsat berilmagan")

    # Compute salary paid
    base_salary = emp.salary or 0
    now = now_tashkent()
    target_year = now.year
    target_month = now.month
    
    days_in_month = monthrange(target_year, target_month)[1]
    month_start = datetime(target_year, target_month, 1, 0, 0, 0)
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1, 0, 0, 0)
    else:
        month_end = datetime(target_year, target_month + 1, 1, 0, 0, 0)

    logs = (
        db.query(AttendanceLog)
        .filter(
            AttendanceLog.employee_id == emp.id,
            AttendanceLog.timestamp >= month_start,
            AttendanceLog.timestamp < month_end,
        )
        .order_by(AttendanceLog.timestamp.asc())
        .all()
    )

    logs_by_day = {}
    for log in logs:
        if not log.timestamp:
            continue
        day_str = log.timestamp.strftime("%Y-%m-%d")
        if day_str not in logs_by_day:
            logs_by_day[day_str] = log.timestamp

    holiday_dates = load_holiday_dates(
        db,
        start_date=month_start.date(),
        end_date=(month_start + timedelta(days=days_in_month-1)).date(),
        organization_ids=[emp.organization_id],
    )
    org_holidays = holiday_dates.get(emp.organization_id, set())
    global_holidays = holiday_dates.get(None, set())

    today_date = now.date()
    total_working_days = 0
    absent_days_up_to_today = 0
    late_details_list = []

    for day_num in range(1, days_in_month + 1):
        day_dt = date(target_year, target_month, day_num)
        day_str = day_dt.isoformat()

        is_weekend = day_dt.weekday() == 6
        is_holiday = day_str in global_holidays or day_str in org_holidays

        if not is_weekend and not is_holiday:
            total_working_days += 1
            if day_dt <= today_date:
                first_seen = logs_by_day.get(day_str)
                if not first_seen:
                    absent_days_up_to_today += 1
                else:
                    late_mins = get_late_minutes(emp, day_dt, first_seen)
                    if late_mins > 0:
                        expected_start = get_expected_start_dt(emp, day_dt)
                        expected_end = get_expected_end_dt(emp, day_dt)
                        expected_duration_mins = int((expected_end - expected_start).total_seconds() // 60)
                        if expected_duration_mins <= 0:
                            expected_duration_mins = 540
                        late_details_list.append((late_mins, expected_duration_mins))

    late_deduction = 0
    if total_working_days > 0:
        for mins, dur in late_details_list:
            if dur > 0:
                daily_rate = base_salary / total_working_days
                minutely_rate = daily_rate / dur
                late_deduction += int(round(minutely_rate * mins))

    if total_working_days > 0:
        absent_deduction = int(round((base_salary / total_working_days) * absent_days_up_to_today))
    else:
        absent_deduction = 0

    deduction = late_deduction + absent_deduction
    final_amount = max(0, base_salary - deduction)

    amount_to_pay = final_amount
    if pay_type == "advance":
        amount_to_pay = final_amount // 2

    if pay_type == "advance":
        emp.salary_status = "advance"
    else:
        emp.salary_status = "paid"

    # Save to cashflow transaction
    full_name = f"{emp.first_name} {emp.last_name}"
    if emp.middle_name:
        full_name += f" {emp.middle_name}"

    # Find a default account for salary deduction
    acc = db.query(FinanceAccount).filter(FinanceAccount.organization_id == emp.organization_id, FinanceAccount.type == "bank").first()
    if not acc:
        acc = db.query(FinanceAccount).filter(FinanceAccount.organization_id == emp.organization_id).first()
    
    acc_id = None
    if acc:
        acc.balance -= float(amount_to_pay)
        acc_id = acc.id
        
    tx = CashflowTransaction(
        description=f"Ish haqi to'lovi - {full_name}",
        type="expense",
        amount=float(amount_to_pay),
        comment=f"{target_month}-oy uchun ish haqi ({'Avans' if pay_type == 'advance' else 'To\'liq'})",
        date=now.strftime("%Y-%m-%d"),
        organization_id=emp.organization_id,
        branch_id=emp.branch_id,
        employee_id=emp.id,
        account_id=acc_id
    )
    db.add(tx)
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


@router.get("/api/finance/kpi")
def get_kpi_stats(
    request: Request,
    organization_id: Optional[int] = Query(None),
    branch_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    allowed_orgs = _resolve_allowed_org_ids(request, db)
    if not allowed_orgs:
        return {"kpis": []}

    query = db.query(Employee).filter(Employee.has_access == True)
    if organization_id is not None:
        if organization_id not in allowed_orgs:
            return {"kpis": []}
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
        return {"kpis": []}

    now = now_tashkent()
    target_year = now.year
    target_month = now.month
    
    days_in_month = monthrange(target_year, target_month)[1]
    month_start = datetime(target_year, target_month, 1, 0, 0, 0)
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1, 0, 0, 0)
    else:
        month_end = datetime(target_year, target_month + 1, 1, 0, 0, 0)

    emp_ids = [emp.id for emp in employees]

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

    # Group first and last log of each day by employee
    logs_by_emp_day = {}
    for log in logs:
        if not log.timestamp:
            continue
        day_str = log.timestamp.strftime("%Y-%m-%d")
        key = (log.employee_id, day_str)
        if key not in logs_by_emp_day:
            logs_by_emp_day[key] = {"first_seen": log.timestamp, "last_seen": log.timestamp}
        else:
            if log.timestamp < logs_by_emp_day[key]["first_seen"]:
                logs_by_emp_day[key]["first_seen"] = log.timestamp
            if log.timestamp > logs_by_emp_day[key]["last_seen"]:
                logs_by_emp_day[key]["last_seen"] = log.timestamp

    # Load holidays
    holiday_dates = load_holiday_dates(
        db,
        start_date=month_start.date(),
        end_date=(month_start + timedelta(days=days_in_month-1)).date(),
        organization_ids=allowed_orgs,
    )
    global_holidays = holiday_dates.get(None, set())

    today_date = now.date()

    kpi_list = []
    for emp in employees:
        org_id = emp.organization_id
        org_holidays = holiday_dates.get(org_id, set()) if org_id is not None else set()

        total_working_days = 0
        absent_days_up_to_today = 0
        late_days = 0
        ontime_days = 0
        overtime_bonus = 0

        for day_num in range(1, days_in_month + 1):
            day_dt = date(target_year, target_month, day_num)
            day_str = day_dt.isoformat()

            is_weekend = day_dt.weekday() == 6
            is_holiday = day_str in global_holidays or day_str in org_holidays

            if not is_weekend and not is_holiday:
                total_working_days += 1
                
                day_logs = logs_by_emp_day.get((emp.id, day_str))
                if day_dt <= today_date:
                    if not day_logs:
                        absent_days_up_to_today += 1
                    else:
                        first_seen = day_logs["first_seen"]
                        late_mins = get_late_minutes(emp, day_dt, first_seen)
                        if late_mins > 0:
                            late_days += 1
                        else:
                            ontime_days += 1
                
                if day_logs:
                    first_seen = day_logs["first_seen"]
                    last_seen = day_logs["last_seen"]
                    expected_start = get_expected_start_dt(emp, day_dt)
                    expected_end = get_expected_end_dt(emp, day_dt)
                    expected_duration = (expected_end - expected_start).total_seconds()
                    worked_duration = (last_seen - first_seen).total_seconds()
                    overtime_seconds = max(0.0, worked_duration - expected_duration)
                    if overtime_seconds > 0:
                        overtime_bonus += int(round((overtime_seconds / 3600.0) * 30000.0))

        base_salary = emp.salary or 0
        
        # Proportional late deduction
        late_deduction = 0
        for day_num in range(1, days_in_month + 1):
            day_dt = date(target_year, target_month, day_num)
            day_str = day_dt.isoformat()
            is_weekend = day_dt.weekday() == 6
            is_holiday = day_str in global_holidays or day_str in org_holidays

            if not is_weekend and not is_holiday:
                day_logs = logs_by_emp_day.get((emp.id, day_str))
                if day_logs and day_dt <= today_date:
                    first_seen = day_logs["first_seen"]
                    late_mins = get_late_minutes(emp, day_dt, first_seen)
                    if late_mins > 0:
                        expected_start = get_expected_start_dt(emp, day_dt)
                        expected_end = get_expected_end_dt(emp, day_dt)
                        expected_duration_mins = int((expected_end - expected_start).total_seconds() // 60)
                        if expected_duration_mins <= 0:
                            expected_duration_mins = 540
                        if total_working_days > 0:
                            daily_rate = base_salary / total_working_days
                            minutely_rate = daily_rate / expected_duration_mins
                            late_deduction += int(round(minutely_rate * late_mins))

        if total_working_days > 0:
            absent_deduction = int(round((base_salary / total_working_days) * absent_days_up_to_today))
        else:
            absent_deduction = 0

        total_deductions = late_deduction + absent_deduction

        working_days_so_far = sum(
            1 for day_num in range(1, today_date.day + 1)
            if not (date(target_year, target_month, day_num).weekday() == 6 or date(target_year, target_month, day_num).isoformat() in global_holidays or date(target_year, target_month, day_num).isoformat() in org_holidays)
        )
        present_days = max(0, working_days_so_far - absent_days_up_to_today)
        
        attendance_rate = int(round((present_days / working_days_so_far) * 100)) if working_days_so_far > 0 else 100
        ontime_rate = int(round((ontime_days / present_days) * 100)) if present_days > 0 else 100
        score = int(round((attendance_rate * 0.6) + (ontime_rate * 0.4)))

        dept_name = emp.department if emp.department else (emp.department_ref.name if emp.department_ref else (emp.employee_type or "Xodim"))

        kpi_list.append({
            "id": emp.id,
            "uuid": emp.uuid,
            "name": f"{emp.first_name} {emp.last_name}",
            "dept": dept_name,
            "attendance": attendance_rate,
            "ontime": ontime_rate,
            "score": score,
            "baseSalary": base_salary,
            "overtimeBonus": overtime_bonus,
            "totalDeductions": total_deductions,
            "ontimeCount": ontime_days,
            "lateCount": late_days,
            "absentCount": absent_days_up_to_today,
            "isAwarded": False,
        })

    return {"kpis": kpi_list}


@router.post("/api/finance/kpi/{emp_id}/reward")
def award_kpi(
    request: Request,
    emp_id: str,
    payload: dict,
    db: Session = Depends(get_db),
):
    allowed_orgs = _resolve_allowed_org_ids(request, db)
    if not allowed_orgs:
        raise HTTPException(status_code=403, detail="Ruxsat berilmagan")
        
    if emp_id.isdigit():
        emp = db.query(Employee).filter(Employee.id == int(emp_id)).first()
    else:
        emp = db.query(Employee).filter(Employee.uuid == emp_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")

    if emp.organization_id not in allowed_orgs:
        raise HTTPException(status_code=403, detail="Ruxsat berilmagan")

    amount = payload.get("amount", 0)
    comment = payload.get("comment", "")

    # Save to cashflow transaction
    full_name = f"{emp.first_name} {emp.last_name}"
    if emp.middle_name:
        full_name += f" {emp.middle_name}"

    # Find a default account for reward deduction
    acc = db.query(FinanceAccount).filter(FinanceAccount.organization_id == emp.organization_id, FinanceAccount.type == "bank").first()
    if not acc:
        acc = db.query(FinanceAccount).filter(FinanceAccount.organization_id == emp.organization_id).first()
    
    acc_id = None
    if acc:
        acc.balance -= float(amount)
        acc_id = acc.id
        
    tx = CashflowTransaction(
        description=f"Mukofot puli - {full_name}",
        type="expense",
        amount=float(amount),
        comment=comment,
        date=now_tashkent().strftime("%Y-%m-%d"),
        organization_id=emp.organization_id,
        branch_id=emp.branch_id,
        employee_id=emp.id,
        account_id=acc_id
    )
    db.add(tx)
    db.commit()

    return {"status": "success", "message": "Mukofot muvaffaqiyatli saqlandi"}


@router.get("/api/finance/cashflow")
def get_cashflow(
    request: Request,
    organization_id: Optional[int] = Query(None),
    branch_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    type: Optional[str] = Query("all"),  # "all", "income", "expense"
    db: Session = Depends(get_db),
):
    allowed_orgs = _resolve_allowed_org_ids(request, db)
    if not allowed_orgs:
        return {"transactions": [], "stats": {"income": 0, "expense": 0, "profit": 0}}

    query = db.query(CashflowTransaction)

    # Org filtering
    if organization_id is not None:
        if organization_id not in allowed_orgs:
            return {"transactions": [], "stats": {"income": 0, "expense": 0, "profit": 0}}
        query = query.filter(CashflowTransaction.organization_id == organization_id)
    else:
        query = query.filter(CashflowTransaction.organization_id.in_(allowed_orgs))

    # Branch filtering
    if branch_id is not None:
        query = query.filter(CashflowTransaction.branch_id == branch_id)

    # Type filtering
    if type != "all":
        query = query.filter(CashflowTransaction.type == type)

    # Search filtering
    if search:
        search_term = f"%{search.strip().lower()}%"
        query = query.outerjoin(Employee, CashflowTransaction.employee_id == Employee.id).filter(
            or_(
                CashflowTransaction.description.ilike(search_term),
                CashflowTransaction.comment.ilike(search_term),
                Employee.first_name.ilike(search_term),
                Employee.last_name.ilike(search_term)
            )
        )

    # Retrieve all ordered by date and id desc
    transactions_list = query.order_by(CashflowTransaction.date.desc(), CashflowTransaction.id.desc()).all()

    # Calculate stats
    income = 0.0
    expense = 0.0
    
    formatted_txs = []
    for tx in transactions_list:
        if tx.type == "income":
            income += tx.amount
        else:
            expense += tx.amount

        emp_name = None
        if tx.employee:
            full_name = f"{tx.employee.first_name} {tx.employee.last_name}"
            if tx.employee.middle_name:
                full_name += f" {tx.employee.middle_name}"
            emp_name = full_name

        acc_name = None
        if tx.account:
            acc_name = tx.account.name_uz

        formatted_txs.append({
            "id": tx.id,
            "uuid": tx.uuid,
            "desc": tx.description,
            "type": tx.type,
            "amount": tx.amount,
            "comment": tx.comment,
            "date": tx.date,
            "employee_id": tx.employee_id,
            "employee_name": emp_name,
            "organization_id": tx.organization_id,
            "branch_id": tx.branch_id,
            "account_id": tx.account_id,
            "account_name": acc_name,
        })

    return {
        "transactions": formatted_txs,
        "stats": {
            "income": income,
            "expense": expense,
            "profit": income - expense
        }
    }


@router.post("/api/finance/cashflow")
def add_cashflow_transaction(
    request: Request,
    payload: dict,
    db: Session = Depends(get_db),
):
    allowed_orgs = _resolve_allowed_org_ids(request, db)
    if not allowed_orgs:
        raise HTTPException(status_code=403, detail="Ruxsat berilmagan")

    description = payload.get("desc")
    tx_type = payload.get("type")  # 'income' or 'expense'
    amount = payload.get("amount")
    comment = payload.get("comment")
    org_id = payload.get("organization_id")
    branch_id = payload.get("branch_id")
    date_val = payload.get("date")
    account_id = payload.get("account_id")

    if not description or not tx_type or amount is None:
        raise HTTPException(status_code=400, detail="Tavsif, tur va miqdor kiritilishi shart")

    if not org_id:
        org_id = allowed_orgs[0]
    else:
        org_id = int(org_id)
        if org_id not in allowed_orgs:
            raise HTTPException(status_code=403, detail="Ruxsat berilmagan tashkilot")

    if not date_val:
        date_val = now_tashkent().strftime("%Y-%m-%d")

    acc = None
    if account_id:
        acc = db.query(FinanceAccount).filter(FinanceAccount.id == int(account_id)).first()
        if not acc or acc.organization_id not in allowed_orgs:
            raise HTTPException(status_code=400, detail="Yaroqsiz hisob")

    if not acc:
        acc = db.query(FinanceAccount).filter(FinanceAccount.organization_id == org_id, FinanceAccount.type == "bank").first()
        if not acc:
            acc = db.query(FinanceAccount).filter(FinanceAccount.organization_id == org_id).first()

    acc_id = None
    if acc:
        acc_id = acc.id
        if tx_type == "income":
            acc.balance += float(amount)
        else:
            acc.balance -= float(amount)

    tx = CashflowTransaction(
        description=description,
        type=tx_type,
        amount=float(amount),
        comment=comment,
        date=date_val,
        organization_id=org_id,
        branch_id=int(branch_id) if branch_id else None,
        account_id=acc_id,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    return {"status": "success", "transaction_id": tx.id}


@router.get("/api/finance/accounts")
def get_finance_accounts(
    request: Request,
    db: Session = Depends(get_db),
):
    allowed_orgs = _resolve_allowed_org_ids(request, db)
    if not allowed_orgs:
        return {"accounts": [], "transfers": [], "totalBalance": 0}

    # Seed defaults if org has 0 accounts
    for org_id in allowed_orgs:
        acc_count = db.query(FinanceAccount).filter(FinanceAccount.organization_id == org_id).count()
        if acc_count == 0:
            defaults = [
                {"name_uz": "Asosiy Kassa (Naqd)", "name_ru": "Основная касса (Наличные)", "balance": 45000000.0, "type": "cash"},
                {"name_uz": "Milliy Bank (Hisob raqam)", "name_ru": "Национальный Банк (Расч. счет)", "balance": 128500000.0, "type": "bank"},
                {"name_uz": "Korporativ Karta (Uzcard/Humo)", "name_ru": "Корпоративная карта (Uzcard/Humo)", "balance": 12000000.0, "type": "card"},
                {"name_uz": "Zaxira jamg'armasi (Kelajak)", "name_ru": "Резервный фонд (Будущее)", "balance": 50000000.0, "type": "reserve"},
            ]
            for d in defaults:
                new_acc = FinanceAccount(
                    name_uz=d["name_uz"],
                    name_ru=d["name_ru"],
                    balance=d["balance"],
                    type=d["type"],
                    organization_id=org_id
                )
                db.add(new_acc)
            db.commit()

    accounts = db.query(FinanceAccount).filter(FinanceAccount.organization_id.in_(allowed_orgs)).order_by(FinanceAccount.id.asc()).all()

    transfers_list = (
        db.query(AccountTransfer)
        .join(FinanceAccount, AccountTransfer.from_account_id == FinanceAccount.id)
        .filter(FinanceAccount.organization_id.in_(allowed_orgs))
        .order_by(AccountTransfer.date.desc(), AccountTransfer.id.desc())
        .all()
    )

    formatted_accs = [{
        "id": a.id,
        "uuid": a.uuid,
        "nameUz": a.name_uz,
        "nameRu": a.name_ru,
        "accountNumber": a.account_number,
        "balance": a.balance,
        "type": a.type,
        "organization_id": a.organization_id,
        "branch_id": a.branch_id,
    } for a in accounts]

    formatted_transfers = []
    for tx in transfers_list:
        from_name = tx.from_account.name_uz
        to_name = tx.to_account.name_uz
        formatted_transfers.append({
            "id": tx.id,
            "uuid": tx.uuid,
            "from": from_name,
            "to": to_name,
            "amount": tx.amount,
            "date": tx.date,
            "desc": tx.description or "",
        })

    total_bal = sum(a.balance for a in accounts)

    return {
        "accounts": formatted_accs,
        "transfers": formatted_transfers,
        "totalBalance": total_bal
    }


@router.post("/api/finance/accounts/transfer")
def transfer_funds(
    request: Request,
    payload: dict,
    db: Session = Depends(get_db),
):
    allowed_orgs = _resolve_allowed_org_ids(request, db)
    if not allowed_orgs:
        raise HTTPException(status_code=403, detail="Ruxsat berilmagan")

    from_id = payload.get("from_account_id")
    to_id = payload.get("to_account_id")
    amount = payload.get("amount", 0)
    desc = payload.get("description", "")
    date_val = payload.get("date")

    if not from_id or not to_id or amount <= 0:
        raise HTTPException(status_code=400, detail="Miqdor yoki hisob raqamlar noto'g'ri")

    from_acc = db.query(FinanceAccount).filter(FinanceAccount.id == int(from_id)).first()
    to_acc = db.query(FinanceAccount).filter(FinanceAccount.id == int(to_id)).first()

    if not from_acc or not to_acc:
        raise HTTPException(status_code=404, detail="Hisob topilmadi")

    if from_acc.organization_id not in allowed_orgs or to_acc.organization_id not in allowed_orgs:
        raise HTTPException(status_code=403, detail="Ruxsat berilmagan")

    if from_acc.balance < amount:
        raise HTTPException(status_code=400, detail="Hisobda mablag' yetarli emas")

    if not date_val:
        date_val = now_tashkent().strftime("%Y-%m-%d")

    from_acc.balance -= float(amount)
    to_acc.balance += float(amount)

    tx = AccountTransfer(
        from_account_id=from_acc.id,
        to_account_id=to_acc.id,
        amount=float(amount),
        description=desc,
        date=date_val
    )
    db.add(tx)
    db.commit()

    return {"status": "success", "message": "O'tkazma muvaffaqiyatli bajarildi"}


@router.post("/api/finance/accounts")
def create_finance_account(
    request: Request,
    payload: dict,
    db: Session = Depends(get_db),
):
    allowed_orgs = _resolve_allowed_org_ids(request, db)
    if not allowed_orgs:
        raise HTTPException(status_code=403, detail="Ruxsat berilmagan")

    name_uz = payload.get("nameUz")
    name_ru = payload.get("nameRu")
    account_number = payload.get("accountNumber")
    balance = payload.get("balance", 0.0)
    acc_type = payload.get("type", "cash")
    org_id = payload.get("organization_id")
    branch_id = payload.get("branch_id")

    if not name_uz or not name_ru:
        raise HTTPException(status_code=400, detail="Nomlar kiritilishi shart")

    if not org_id:
        org_id = allowed_orgs[0]
    else:
        org_id = int(org_id)
        if org_id not in allowed_orgs:
            raise HTTPException(status_code=403, detail="Ruxsat berilmagan tashkilot")

    acc = FinanceAccount(
        name_uz=name_uz,
        name_ru=name_ru,
        account_number=account_number,
        balance=float(balance),
        type=acc_type,
        organization_id=org_id,
        branch_id=int(branch_id) if branch_id else None
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)

    return {"status": "success", "account_id": acc.id}


@router.put("/api/finance/accounts/{acc_id}")
def update_finance_account(
    request: Request,
    acc_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    allowed_orgs = _resolve_allowed_org_ids(request, db)
    if not allowed_orgs:
        raise HTTPException(status_code=403, detail="Ruxsat berilmagan")

    acc = db.query(FinanceAccount).filter(FinanceAccount.id == acc_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Hisob topilmadi")

    if acc.organization_id not in allowed_orgs:
        raise HTTPException(status_code=403, detail="Ruxsat berilmagan")

    name_uz = payload.get("nameUz")
    name_ru = payload.get("nameRu")
    account_number = payload.get("accountNumber")
    balance = payload.get("balance")
    acc_type = payload.get("type")

    if name_uz:
        acc.name_uz = name_uz
    if name_ru:
        acc.name_ru = name_ru
    if account_number is not None:
        acc.account_number = account_number
    if balance is not None:
        acc.balance = float(balance)
    if acc_type:
        acc.type = acc_type

    db.commit()
    return {"status": "success", "message": "Hisob muvaffaqiyatli tahrirlandi"}


@router.delete("/api/finance/accounts/{acc_id}")
def delete_finance_account(
    request: Request,
    acc_id: int,
    db: Session = Depends(get_db),
):
    allowed_orgs = _resolve_allowed_org_ids(request, db)
    if not allowed_orgs:
        raise HTTPException(status_code=403, detail="Ruxsat berilmagan")

    acc = db.query(FinanceAccount).filter(FinanceAccount.id == acc_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Hisob topilmadi")

    if acc.organization_id not in allowed_orgs:
        raise HTTPException(status_code=403, detail="Ruxsat berilmagan")

    db.delete(acc)
    db.commit()
    return {"status": "success", "message": "Hisob o'chirildi"}
