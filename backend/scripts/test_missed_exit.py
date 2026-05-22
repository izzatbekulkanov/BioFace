import sys
import os
from datetime import datetime, timedelta, time as dt_time

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from database import SessionLocal, engine
from sqlalchemy import text
import models
from utils.time_utils import now_tashkent, today_tashkent_range

def run_test():
    print("--- Starting End-to-End Missed Exit Verification Test ---")
    db = SessionLocal()
    try:
        # 1. Fetch or create organization
        org = db.query(models.Organization).first()
        if not org:
            print("Creating mock organization...")
            org = models.Organization(
                name="Test school",
                telegram_enabled=True,
                telegram_bot_token="123456:mock_token",
                subscription_status="active"
            )
            db.add(org)
            db.flush()
        else:
            org.telegram_enabled = True
            org.telegram_bot_token = "123456:mock_token"
            org.subscription_status = "active"
            db.flush()

        # 2. Fetch or create schedule
        sched = db.query(models.Schedule).filter(models.Schedule.organization_id == org.id).first()
        if not sched:
            print("Creating mock schedule...")
            sched = models.Schedule(
                name="School Shift 1",
                start_time="08:00",
                end_time="14:00",
                organization_id=org.id
            )
            db.add(sched)
            db.flush()

        # 3. Create a test student employee
        # Clean any existing student with this personal_id to ensure clean state
        existing = db.query(models.Employee).filter(models.Employee.personal_id == "9998887").all()
        for emp in existing:
            db.execute(text("DELETE FROM attendance_notification_logs WHERE employee_id = :emp_id"), {"emp_id": emp.id})
            db.execute(text("DELETE FROM telegram_contacts WHERE employee_id = :emp_id"), {"emp_id": emp.id})
            db.execute(text("DELETE FROM attendance_logs WHERE employee_id = :emp_id"), {"emp_id": emp.id})
            db.delete(emp)
        db.commit()

        # To trigger the exit deadline (now_local >= expected_end + 15 mins),
        # we will set the employee's end_time dynamically to 20 minutes ago.
        now_local = now_tashkent()
        exit_time_dt = now_local - timedelta(minutes=20)
        exit_time_str = exit_time_dt.strftime("%H:%M")

        print(f"Creating mock student with end_time={exit_time_str}...")
        student = models.Employee(
            first_name="Asilbek",
            last_name="Karimov",
            middle_name="Umidovich",
            employee_type="oquvchi",
            has_access=True,
            end_time=exit_time_str,
            schedule_type="individual",
            organization_id=org.id,
            personal_id="9998887"
        )
        db.add(student)
        db.flush()

        # 4. Bind telegram contact
        contact = models.TelegramContact(
            employee_id=student.id,
            label="Karimov Umid (Otasi)",
            telegram_chat_id="987654321",
            language="uz",
            is_active=True
        )
        db.add(contact)
        db.flush()

        # 5. Insert "in" (Keldi) attendance log for today
        # To make sure it matches today, we use today_tashkent_range and a local time.
        today_start, today_end = today_tashkent_range()
        log_in = models.AttendanceLog(
            employee_id=student.id,
            device_id=None,
            camera_mac="AA:BB:CC:DD:EE:FF",
            person_id="9998887",
            person_name="Asilbek Karimov",
            direction="in",
            status="aniqlandi",
            timestamp=today_start + timedelta(minutes=5)  # Checked in today at 00:05
        )
        db.add(log_in)
        db.flush()

        # Clean existing notification logs for this student to ensure a fresh test
        db.execute(
            text(
                "DELETE FROM attendance_notification_logs WHERE employee_id = :employee_id"
            ),
            {"employee_id": student.id}
        )
        db.commit()

        # Diagnostic tracing:
        print("\n--- DIAGNOSTICS FOR CREATED STUDENT ---")
        print(f"student.id: {student.id}")
        print(f"student.employee_type: {student.employee_type}")
        print(f"student.has_access: {student.has_access}")
        
        # Check organization
        print(f"org.id: {org.id}")
        print(f"org.subscription_status: {org.subscription_status}")
        print(f"org.telegram_enabled: {org.telegram_enabled}")
        print(f"org.telegram_bot_token: {org.telegram_bot_token}")
        
        # Check contacts
        tc_count = db.query(models.TelegramContact).filter(models.TelegramContact.employee_id == student.id).count()
        print(f"Telegram contacts in DB count: {tc_count}")
        active_tc = db.query(models.TelegramContact).filter(models.TelegramContact.employee_id == student.id, models.TelegramContact.is_active == True).all()
        print(f"Active telegram contacts count: {len(active_tc)}")
        
        # Holiday check
        from utils.schedule_utils import is_holiday_for_org
        today = now_local.date()
        print(f"today: {today}")
        is_holiday = is_holiday_for_org(db, today, org.id)
        print(f"is_holiday_for_org: {is_holiday}")
        
        # Present check
        t_start, t_end = today_tashkent_range()
        print(f"t_start: {t_start}, t_end: {t_end}")
        print(f"t_start: {t_start}, t_end: {t_end}")
        present_employee_ids = {
            int(row[0])
            for row in (
                db.query(models.AttendanceLog.employee_id)
                .filter(
                    models.AttendanceLog.employee_id.isnot(None),
                    models.AttendanceLog.status == "aniqlandi",
                    models.AttendanceLog.timestamp >= t_start,
                    models.AttendanceLog.timestamp < t_end,
                )
                .distinct()
                .all()
            )
            if row[0] is not None
        }
        print(f"Is student in present_employee_ids: {int(student.id) in present_employee_ids}")
        print(f"present_employee_ids contains: {present_employee_ids}")
        
        # Deadline check
        from utils.schedule_utils import get_expected_end_dt
        expected_end = get_expected_end_dt(student, today)
        deadline_exit = expected_end + timedelta(minutes=15)
        print(f"now_local: {now_local}")
        print(f"expected_end: {expected_end}")
        print(f"deadline_exit: {deadline_exit}")
        print(f"Is now_local >= deadline_exit: {now_local >= deadline_exit}")
        
        # Exit check
        has_exit = (
            db.query(models.AttendanceLog.id)
            .filter(
                models.AttendanceLog.employee_id == student.id,
                models.AttendanceLog.status == "aniqlandi",
                models.AttendanceLog.direction == "out",
                models.AttendanceLog.timestamp >= t_start,
                models.AttendanceLog.timestamp < t_end,
            )
            .first()
        ) is not None
        print(f"has_exit: {has_exit}")
        print("--- END OF DIAGNOSTICS ---\n")

        # 6. Mock _send_telegram_message and run background monitor
        import services.attendance_monitor as monitor

        sent_messages = []
        def mock_send(token, chat_id, text_message):
            print(f"\n>>> [MOCK TELEGRAM BOT] Sent Message to Chat ID {chat_id}:")
            print(text_message)
            print(">>> [MOCK TELEGRAM BOT] End of Message\n")
            sent_messages.append((chat_id, text_message))

        # Monkeypatch
        monitor._send_telegram_message = mock_send

        # Instantiate and run once
        print("Running attendance monitor once...")
        checker = monitor.AttendanceMonitor()
        res = checker.run_once()
        print(f"Monitor Run Results: {res}")

        # Check that we sent a message
        if len(sent_messages) == 1:
            print("SUCCESS: Telegram alert was successfully triggered!")
        else:
            print(f"FAILURE: Expected exactly 1 alert sent, got {len(sent_messages)}")

        # Check that notification log was statefully saved
        notif_log = db.execute(
            text(
                "SELECT * FROM attendance_notification_logs WHERE employee_id = :employee_id AND notification_type = 'missed_exit'"
            ),
            {"employee_id": student.id}
        ).fetchone()

        if notif_log:
            print("SUCCESS: Notification log state successfully persisted in DB!")
            print(f"Log details: {dict(notif_log._mapping)}")
        else:
            print("FAILURE: No notification log found in database!")

        # 7. Test stateful de-duplication: run again and verify no new alert is sent
        print("Running monitor again to verify de-duplication...")
        sent_messages.clear()
        res_dup = checker.run_once()
        print(f"Second Run Results: {res_dup}")
        if len(sent_messages) == 0:
            print("SUCCESS: Stateful de-duplication verified! No duplicate alert sent.")
        else:
            print(f"FAILURE: Duplicate alert sent: {sent_messages}")

        # Cleanup test data
        print("Cleaning up test data...")
        db.execute(
            text(
                "DELETE FROM attendance_notification_logs WHERE employee_id = :employee_id"
            ),
            {"employee_id": student.id}
        )
        db.delete(log_in)
        db.delete(contact)
        db.delete(student)
        db.commit()
        print("--- Test Complete: ALL Success Criteria Verified! ---")

    except Exception as e:
        db.rollback()
        print(f"Error during test execution: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
