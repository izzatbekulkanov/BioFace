import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship

from database import Base


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
    users = relationship("User", back_populates="organization", cascade="all, delete")
    devices = relationship("Device", back_populates="organization", cascade="all, delete")
    employees = relationship("Employee", back_populates="organization", cascade="all, delete")


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
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    organization = relationship("Organization", back_populates="users")


class Device(Base):
    """Kamera qurilmasi"""
    __tablename__ = "devices"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)                        # "Rakat mahallasi 1-kirish"
    mac_address = Column(String, unique=True, index=True, nullable=False)  # "AA:BB:CC:11:22:33"
    isup_device_id = Column(String, unique=True, index=True, nullable=True)  # ISUP Device ID (CAM1111)
    location = Column(String, nullable=True)
    model = Column(String, nullable=True)                        # "DS-K1T343"
    username = Column(String, nullable=True, default="admin")
    password = Column(String, nullable=True)
    isup_password = Column(String, nullable=True, default="bioface2024")
    max_memory = Column(Integer, default=1500)                   # modeliga qarab limit
    used_faces = Column(Integer, default=0)
    is_online = Column(Boolean, default=False)
    last_seen_at = Column(DateTime, nullable=True)               # So'nggi webhook vaqti
    created_at = Column(DateTime, default=datetime.utcnow)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    organization = relationship("Organization", back_populates="devices")
    attendance_logs = relationship("AttendanceLog", back_populates="device", cascade="all, delete")
    employee_links = relationship("EmployeeCameraLink", back_populates="camera", cascade="all, delete")


class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    personal_id = Column(String, unique=True, index=True, nullable=True)  # 7 xonali kamera ID
    department = Column(String, nullable=True)
    position = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    has_access = Column(Boolean, default=True)
    start_time = Column(String, nullable=True)  # HH:MM format, override default
    end_time = Column(String, nullable=True)    # HH:MM format, override default
    created_at = Column(DateTime, default=datetime.utcnow)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    organization = relationship("Organization", back_populates="employees")
    attendance_logs = relationship("AttendanceLog", back_populates="employee", cascade="all, delete")
    camera_links = relationship("EmployeeCameraLink", back_populates="employee", cascade="all, delete")


class AttendanceLog(Base):
    __tablename__ = "attendance_logs"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)  # None = noma'lum shaxs
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=True)      # None bolishi mumkin emas endi (xavfsizlik o'tkazmaydi), lekin SQL levelda ruxsat turadi
    camera_mac = Column(String, nullable=True)        # "AA:BB:CC:11:22:33"
    person_id = Column(String, nullable=True)         # kamera ichidagi ID
    person_name = Column(String, nullable=True)       # kamera tanigan ism
    snapshot_url = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, nullable=False, default="aniqlandi")  # "aniqlandi", "noma'lum"
    employee = relationship("Employee", back_populates="attendance_logs")
    device = relationship("Device", back_populates="attendance_logs")


class EmployeeCameraLink(Base):
    __tablename__ = "employee_camera_links"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    camera_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="camera_links")
    camera = relationship("Device", back_populates="employee_links")
