import enum
from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Date, Enum as SQLEnum
from sqlalchemy.orm import relationship

from database import Base
from time_utils import now_tashkent


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    pending = "pending"
    expired = "expired"


class UserRole(str, enum.Enum):
    super_admin = "SuperAdmin"
    mahalla_admin = "MahallaAdmin"
    maktab_admin = "MaktabAdmin"
    kollej_admin = "KollejAdmin"
    tashkilot_admin = "TashkilotAdmin"
    korxona_admin = "KorxonaAdmin"

class Organization(Base):
    __tablename__ = "organizations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    organization_type = Column(String, nullable=True, default="boshqa")
    subscription_status = Column(SQLEnum(SubscriptionStatus), default=SubscriptionStatus.pending)
    subscription_end_date = Column(DateTime, nullable=True)
    default_start_time = Column(String, default="09:00")  # HH:MM format
    default_end_time = Column(String, default="18:00")    # HH:MM format
    telegram_enabled = Column(Boolean, default=False)
    telegram_admin_chat_id = Column(String, nullable=True)
    telegram_bot_token = Column(String, nullable=True)
    google_oauth_enabled = Column(Boolean, default=False)
    google_client_id = Column(String, nullable=True)
    google_client_secret = Column(String, nullable=True)
    google_redirect_uri = Column(String, nullable=True)
    users = relationship("User", back_populates="organization", cascade="all, delete")
    user_links = relationship("UserOrganizationLink", back_populates="organization", cascade="all, delete")
    devices = relationship("Device", back_populates="organization", cascade="all, delete")
    employees = relationship("Employee", back_populates="organization", cascade="all, delete")
    departments = relationship("Department", back_populates="organization", cascade="all, delete")
    positions = relationship("Position", back_populates="organization", cascade="all, delete")
    schedules = relationship("Schedule", back_populates="organization", cascade="all, delete")
    holidays = relationship("Holiday", back_populates="organization", cascade="all, delete")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    middle_name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.tashkilot_admin)
    status = Column(String, default="active")
    menu_permissions = Column(String, nullable=True)
    google_oauth_enabled = Column(Boolean, default=False)
    google_sub = Column(String, unique=True, index=True, nullable=True)
    last_login_provider = Column(String, nullable=True, default="password")
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    organization = relationship("Organization", back_populates="users")
    organization_links = relationship("UserOrganizationLink", back_populates="user", cascade="all, delete")


class UserOrganizationLink(Base):
    __tablename__ = "user_organization_links"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="organization_links")
    organization = relationship("Organization", back_populates="user_links")


class Device(Base):
    """Kamera qurilmasi"""
    __tablename__ = "devices"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)                        # "Rakat mahallasi 1-kirish"
    mac_address = Column(String, unique=True, index=True, nullable=False)  # "AA:BB:CC:11:22:33"
    serial_number = Column(String, index=True, nullable=True)
    isup_device_id = Column(String, unique=True, index=True, nullable=True)  # ISUP Device ID (CAM1111)
    location = Column(String, nullable=True)
    model = Column(String, nullable=True)                        # "DS-K1T343"
    firmware_version = Column(String, nullable=True)
    external_ip = Column(String, nullable=True)
    protocol_version = Column(String, nullable=True)
    webhook_enabled = Column(Boolean, default=False)
    webhook_target_url = Column(String, nullable=True)
    webhook_picture_sending = Column(Boolean, default=False)
    username = Column(String, nullable=True, default="admin")
    password = Column(String, nullable=True)
    isup_password = Column(String, nullable=True, default="facex2024")
    max_memory = Column(Integer, default=1500)                   # modeliga qarab limit
    used_faces = Column(Integer, default=0)
    is_online = Column(Boolean, default=False)
    last_seen_at = Column(DateTime, nullable=True)               # So'nggi webhook vaqti
    created_at = Column(DateTime, default=utc_now)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    organization = relationship("Organization", back_populates="devices")
    attendance_logs = relationship("AttendanceLog", back_populates="device", cascade="all, delete")
    employee_links = relationship("EmployeeCameraLink", back_populates="camera", cascade="all, delete")


class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    middle_name = Column(String, nullable=True)
    personal_id = Column(String, unique=True, index=True, nullable=True)  # 7 xonali kamera ID
    department = Column(String, nullable=True)
    position = Column(String, nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True, index=True)
    position_id = Column(Integer, ForeignKey("positions.id"), nullable=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=True, index=True)
    employee_type = Column(String, nullable=True)  # oquvchi, oqituvchi, hodim
    image_url = Column(String, nullable=True)
    has_access = Column(Boolean, default=True)
    start_time = Column(String, nullable=True)  # HH:MM format, override default
    end_time = Column(String, nullable=True)    # HH:MM format, override default
    created_at = Column(DateTime, default=utc_now)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    organization = relationship("Organization", back_populates="employees")
    department_ref = relationship("Department", back_populates="employees")
    position_ref = relationship("Position", back_populates="employees")
    schedule = relationship("Schedule", back_populates="employees")
    attendance_logs = relationship("AttendanceLog", back_populates="employee", cascade="all, delete")
    camera_links = relationship("EmployeeCameraLink", back_populates="employee", cascade="all, delete")
    wellbeing_notes = relationship("EmployeeWellbeingNote", back_populates="employee", cascade="all, delete")
    psychological_states = relationship("EmployeePsychologicalState", back_populates="employee", cascade="all, delete")
    telegram_contacts = relationship("TelegramContact", back_populates="employee", cascade="all, delete")


class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now)

    organization = relationship("Organization", back_populates="departments")
    employees = relationship("Employee", back_populates="department_ref")
    positions = relationship("Position", back_populates="department")


class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now)

    organization = relationship("Organization", back_populates="positions")
    department = relationship("Department", back_populates="positions")
    employees = relationship("Employee", back_populates="position_ref")


class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    start_time = Column(String, nullable=False, default="09:00")
    end_time = Column(String, nullable=False, default="18:00")
    is_flexible = Column(Boolean, default=False)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, nullable=False)

    organization = relationship("Organization", back_populates="schedules")
    employees = relationship("Employee", back_populates="schedule")


class TelegramUserBinding(Base):
    __tablename__ = "telegram_user_bindings"
    id = Column(Integer, primary_key=True, index=True)
    telegram_user_id = Column(String, unique=True, index=True, nullable=False)
    telegram_chat_id = Column(String, nullable=True, index=True)
    language = Column(String, nullable=False, default="uz")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now)

    employee = relationship("Employee")


class AttendanceLog(Base):
    __tablename__ = "attendance_logs"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)  # None = noma'lum shaxs
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)      # None bolishi mumkin emas endi (xavfsizlik o'tkazmaydi), lekin SQL levelda ruxsat turadi
    camera_mac = Column(String, nullable=True)        # "AA:BB:CC:11:22:33"
    person_id = Column(String, nullable=True)         # kamera ichidagi ID
    person_name = Column(String, nullable=True)       # kamera tanigan ism
    snapshot_url = Column(String, nullable=True)
    psychological_state_key = Column(String, nullable=True)
    psychological_state_confidence = Column(Float, nullable=True)
    emotion_scores_json = Column(String, nullable=True)
    wellbeing_note_uz = Column(String, nullable=True)
    wellbeing_note_ru = Column(String, nullable=True)
    wellbeing_note_source = Column(String, nullable=True)
    timestamp = Column(DateTime, default=utc_now)
    status = Column(String, nullable=False, default="aniqlandi")  # "aniqlandi", "noma'lum"
    employee = relationship("Employee", back_populates="attendance_logs")
    device = relationship("Device", back_populates="attendance_logs")


class EmployeeCameraLink(Base):
    __tablename__ = "employee_camera_links"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    camera_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=utc_now)

    employee = relationship("Employee", back_populates="camera_links")
    camera = relationship("Device", back_populates="employee_links")


class EmployeeWellbeingNote(Base):
    __tablename__ = "employee_wellbeing_notes"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    note_uz = Column(String, nullable=False)
    note_ru = Column(String, nullable=False)
    source = Column(String, nullable=False, default="manual")
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, nullable=False)

    employee = relationship("Employee", back_populates="wellbeing_notes")


class EmployeePsychologicalState(Base):
    __tablename__ = "employee_psychological_states"
    __table_args__ = (
        CheckConstraint(
            "source IN ('manual', 'psychologist_assessment', 'questionnaire', 'external_system')",
            name="ck_employee_psychological_states_source",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    state_key = Column(String, nullable=True)
    state_uz = Column(String, nullable=False)
    state_ru = Column(String, nullable=False)
    confidence = Column(Float, nullable=True)
    emotion_scores_json = Column(String, nullable=True)
    state_date = Column(String, nullable=False, index=True)
    source = Column(String, nullable=False, default="manual")
    note = Column(String, nullable=True)
    assessed_at = Column(DateTime, default=utc_now, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, nullable=False)

    employee = relationship("Employee", back_populates="psychological_states")


class Holiday(Base):
    __tablename__ = "holidays"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    date = Column(Date, nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    is_weekend = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, nullable=False)

    organization = relationship("Organization", back_populates="holidays")


class TelegramContact(Base):
    __tablename__ = "telegram_contacts"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    telegram_chat_id = Column(String, nullable=False, index=True)
    label = Column(String, nullable=True)
    language = Column(String, nullable=False, default="uz")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, nullable=False)

    employee = relationship("Employee", back_populates="telegram_contacts")


class AttendanceNotificationLog(Base):
    __tablename__ = "attendance_notification_logs"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    target_date = Column(Date, nullable=False, index=True)
    notification_type = Column(String, nullable=False, index=True, default="missed_shift")
    schedule_id = Column(Integer, ForeignKey("schedules.id"), nullable=True, index=True)
    sent_at = Column(DateTime, default=utc_now, nullable=False)




class RequestLog(Base):
    __tablename__ = 'request_logs'
    id = Column(Integer, primary_key=True, index=True)
    method = Column(String, index=True)
    url = Column(String, index=True)
    client_ip = Column(String, index=True)
    content_type = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    status_code = Column(Integer, index=True)
    response_time_ms = Column(Integer)
    created_at = Column(DateTime, default=now_tashkent, index=True)
    details = Column(String, nullable=True)
