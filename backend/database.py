import os
import re
from pathlib import Path

from sqlalchemy import create_engine, event, text, inspect
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool
import bcrypt

# Database URL configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# Load env variables from .env file manually
env_path = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_path):
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                if not key or key in os.environ:
                    continue
                value = value.strip()
                if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]
                os.environ.setdefault(key, value)
    except Exception:
        pass

is_debug = os.getenv("BIOFACE_DEBUG", "true").strip().lower() in {"1", "true", "yes", "on"}

if is_debug:
    SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(DATA_DIR, 'bioface.db')}"
else:
    _db_url = os.getenv("DATABASE_URL", "").strip()
    if not _db_url:
        _db_url = "postgresql://biofaceuser:bioface1231@127.0.0.1:5432/biofacedb"
    SQLALCHEMY_DATABASE_URL = _db_url

# Engine setup
is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")
connect_args = {}
if is_sqlite:
    connect_args = {
        "check_same_thread": False,
        "timeout": 30,          # lock kutish vaqti
    }

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=connect_args,
    poolclass=QueuePool,
    pool_size=10,               # doimiy ulanishlar soni
    max_overflow=20,            # qo'shimcha ulanishlar (yuklanish paytida)
    pool_pre_ping=True,         # o'lik ulanishlarni avtomatik tiklash
    pool_recycle=1800,          # 30 minutdan so'ng ulanishni yangilash
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _connection_record):
    """SQLite'ni yuqori unumdorlik rejimida sozlash."""
    if not is_sqlite:
        return
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")       # parallel o'qish imkoni
    cursor.execute("PRAGMA synchronous=NORMAL")     # xavfsiz, lekin tezroq
    cursor.execute("PRAGMA cache_size=-32000")      # 32MB kesh
    cursor.execute("PRAGMA temp_store=MEMORY")      # temp jadvallar RAMda
    cursor.execute("PRAGMA mmap_size=268435456")    # 256MB memory-mapped I/O
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# SessionLocal class for creating new DB sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for SQLAlchemy Models
Base = declarative_base()

# DB Dependency generator
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_SCHEMA_READY = False


def _maybe_ensure_schema():
    global _SCHEMA_READY
    if _SCHEMA_READY:
        return
    _SCHEMA_READY = ensure_schema()


def ensure_schema() -> bool:
    """
    Lightweight migrations for SQLite and PostgreSQL when Alembic is not used.
    Safely adds new columns/indexes if missing.
    """
    global _SCHEMA_READY
    if _SCHEMA_READY:
        return True
    try:
        with engine.begin() as conn:
            if conn.dialect.name == "postgresql":
                try:
                    conn.execute(text("SELECT pg_advisory_xact_lock(74839201);"))
                except Exception:
                    pass
            inspector = inspect(conn)
            if "devices" in inspector.get_table_names():
                cols = {c["name"] for c in inspector.get_columns("devices")}
                if "isup_device_id" not in cols:
                    conn.execute(text("ALTER TABLE devices ADD COLUMN isup_device_id VARCHAR"))
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_devices_isup_device_id ON devices (isup_device_id)"))
                device_alters = {
                    "serial_number": "ALTER TABLE devices ADD COLUMN serial_number VARCHAR",
                    "firmware_version": "ALTER TABLE devices ADD COLUMN firmware_version VARCHAR",
                    "external_ip": "ALTER TABLE devices ADD COLUMN external_ip VARCHAR",
                    "protocol_version": "ALTER TABLE devices ADD COLUMN protocol_version VARCHAR",
                    "webhook_enabled": "ALTER TABLE devices ADD COLUMN webhook_enabled BOOLEAN DEFAULT 0",
                    "webhook_target_url": "ALTER TABLE devices ADD COLUMN webhook_target_url VARCHAR",
                    "webhook_picture_sending": "ALTER TABLE devices ADD COLUMN webhook_picture_sending BOOLEAN DEFAULT 0",
                    "min_face_confidence": "ALTER TABLE devices ADD COLUMN min_face_confidence FLOAT DEFAULT 0.40",
                    "direction": "ALTER TABLE devices ADD COLUMN direction VARCHAR",
                    "branch_id": "ALTER TABLE devices ADD COLUMN branch_id INTEGER",
                }
                added_device_col = False
                for col_name, sql in device_alters.items():
                    if col_name not in cols:
                        conn.execute(text(sql))
                        added_device_col = True
                if added_device_col:
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_devices_serial_number ON devices (serial_number)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_devices_organization_id ON devices (organization_id)"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_devices_branch_id ON devices (branch_id)"))
                    default_bool = "false" if conn.dialect.name == "postgresql" else "0"
                    conn.execute(
                        text(
                            f"UPDATE devices SET "
                            f"webhook_enabled = COALESCE(webhook_enabled, {default_bool}), "
                            f"webhook_picture_sending = COALESCE(webhook_picture_sending, {default_bool}) "
                            f"WHERE webhook_enabled IS NULL OR webhook_picture_sending IS NULL"
                        )
                    )

                non_mac_pattern = re.compile(r"^(?:[0-9A-F]{12}|[0-9A-F]{2}(?:[-:][0-9A-F]{2}){5})$", re.IGNORECASE)
                legacy_rows = conn.execute(
                    text("SELECT id, mac_address, serial_number FROM devices")
                ).mappings().all()
                for row in legacy_rows:
                    mac_value = str(row.get("mac_address") or "").strip()
                    serial_value = str(row.get("serial_number") or "").strip()
                    if (
                        mac_value
                        and not serial_value
                        and not non_mac_pattern.fullmatch(mac_value)
                        and not mac_value.upper().startswith(("AUTO-", "TEMP-"))
                    ):
                        conn.execute(
                            text("UPDATE devices SET serial_number = :serial WHERE id = :id"),
                            {"serial": mac_value, "id": int(row["id"])},
                        )

            if "organizations" in inspector.get_table_names():
                org_cols = {c["name"] for c in inspector.get_columns("organizations")}
                if "organization_type" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN organization_type VARCHAR"))
                if "telegram_enabled" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN telegram_enabled BOOLEAN DEFAULT 0"))
                if "telegram_admin_chat_id" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN telegram_admin_chat_id VARCHAR"))
                if "telegram_bot_token" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN telegram_bot_token VARCHAR"))
                if "google_oauth_enabled" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN google_oauth_enabled BOOLEAN DEFAULT 0"))
                if "google_client_id" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN google_client_id VARCHAR"))
                if "google_client_secret" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN google_client_secret VARCHAR"))
                if "google_redirect_uri" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN google_redirect_uri VARCHAR"))
                if "address" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN address VARCHAR"))
                if "phone" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN phone VARCHAR"))
                if "region" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN region VARCHAR"))
                if "district" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN district VARCHAR"))
                if "village" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN village VARCHAR"))
                if "latitude" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN latitude FLOAT"))
                if "longitude" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN longitude FLOAT"))
                if "radius" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN radius FLOAT DEFAULT 100.0"))
                if "uuid" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN uuid VARCHAR(36)"))
                    try:
                        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_uuid ON organizations(uuid)"))
                    except Exception:
                        pass
                conn.execute(
                    text(
                        "UPDATE organizations "
                        "SET organization_type = 'boshqa' "
                        "WHERE organization_type IS NULL OR trim(organization_type) = ''"
                    )
                )
                # Seed Telegram settings into DB once so bot runtime can read from DB only.
                try:
                    from utils.menu_utils import get_menu_data

                    menu_data = get_menu_data()
                except Exception:
                    menu_data = {}

                token_seed = str(menu_data.get("telegram_bot_token") or "").strip()
                admin_chat_seed = str(menu_data.get("telegram_admin_chat_id") or "").strip()
                enabled_seed = bool(menu_data.get("telegram_enabled", False))

                if token_seed or admin_chat_seed or enabled_seed:
                    conn.execute(
                        text(
                            "UPDATE organizations SET "
                            "telegram_enabled = COALESCE(telegram_enabled, :enabled), "
                            "telegram_admin_chat_id = COALESCE(NULLIF(trim(telegram_admin_chat_id), ''), :admin_chat_id), "
                            "telegram_bot_token = COALESCE(NULLIF(trim(telegram_bot_token), ''), :token)"
                        ),
                        {"enabled": enabled_seed, "admin_chat_id": admin_chat_seed or None, "token": token_seed or None},
                    )
                org_count = conn.execute(text("SELECT COUNT(*) FROM organizations")).scalar() or 0
                if int(org_count) == 0 and (token_seed or admin_chat_seed or enabled_seed):
                    conn.execute(
                        text(
                            "INSERT INTO organizations "
                            "(name, organization_type, default_start_time, default_end_time, telegram_enabled, telegram_admin_chat_id, telegram_bot_token) "
                            "VALUES (:name, :organization_type, :start_time, :end_time, :enabled, :admin_chat_id, :token)"
                        ),
                        {
                            "name": "Asosiy Tashkilot",
                            "organization_type": "boshqa",
                            "start_time": "09:00",
                            "end_time": "18:00",
                            "enabled": enabled_seed,
                            "admin_chat_id": admin_chat_seed or None,
                            "token": token_seed or None,
                        },
                    )

            if "branches" in inspector.get_table_names():
                br_cols = {c["name"] for c in inspector.get_columns("branches")}
                if "uuid" not in br_cols:
                    conn.execute(text("ALTER TABLE branches ADD COLUMN uuid VARCHAR(36)"))
                    try:
                        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_uuid ON branches(uuid)"))
                    except Exception:
                        pass

            if "users" in inspector.get_table_names():
                user_cols = {c["name"] for c in inspector.get_columns("users")}
                user_alters = {
                    "first_name": "ALTER TABLE users ADD COLUMN first_name VARCHAR",
                    "last_name": "ALTER TABLE users ADD COLUMN last_name VARCHAR",
                    "middle_name": "ALTER TABLE users ADD COLUMN middle_name VARCHAR",
                    "phone": "ALTER TABLE users ADD COLUMN phone VARCHAR",
                    "image_url": "ALTER TABLE users ADD COLUMN image_url VARCHAR",
                    "status": "ALTER TABLE users ADD COLUMN status VARCHAR DEFAULT 'active'",
                    "menu_permissions": "ALTER TABLE users ADD COLUMN menu_permissions VARCHAR",
                    "google_oauth_enabled": "ALTER TABLE users ADD COLUMN google_oauth_enabled BOOLEAN DEFAULT 0",
                    "google_sub": "ALTER TABLE users ADD COLUMN google_sub VARCHAR",
                    "last_login_provider": "ALTER TABLE users ADD COLUMN last_login_provider VARCHAR",
                    "branch_id": "ALTER TABLE users ADD COLUMN branch_id INTEGER",
                    "is_staff": "ALTER TABLE users ADD COLUMN is_staff BOOLEAN DEFAULT 1",
                }
                for col_name, sql in user_alters.items():
                    if col_name not in user_cols:
                        conn.execute(text(sql))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_branch_id ON users (branch_id)"))
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub "
                        "ON users (google_sub) "
                        "WHERE google_sub IS NOT NULL AND trim(google_sub) <> ''"
                    )
                )
                default_bool = "false" if conn.dialect.name == "postgresql" else "0"
                conn.execute(
                    text(
                        f"UPDATE users "
                        f"SET google_oauth_enabled = COALESCE(google_oauth_enabled, {default_bool}), "
                        f"last_login_provider = COALESCE(NULLIF(trim(last_login_provider), ''), 'password')"
                    )
                )

                # Backfill first_name from legacy name if needed.
                conn.execute(
                    text(
                        "UPDATE users "
                        "SET first_name = COALESCE(NULLIF(first_name, ''), name) "
                        "WHERE first_name IS NULL OR first_name = ''"
                    )
                )

                # Normalize role values for SQLAlchemy Enum(name) storage.
                role_map = {
                    "SuperAdmin": "super_admin",
                    "MahallaAdmin": "mahalla_admin",
                    "MaktabAdmin": "maktab_admin",
                    "KollejAdmin": "kollej_admin",
                    "TashkilotAdmin": "tashkilot_admin",
                    "KorxonaAdmin": "korxona_admin",
                }
                for old_role, new_role in role_map.items():
                    conn.execute(
                        text("UPDATE users SET role = :new_role WHERE CAST(role AS VARCHAR) = :old_role"),
                        {"new_role": new_role, "old_role": old_role},
                    )

                # Ensure default admin account exists only for first bootstrap.
                # This prevents deleted users from being recreated on every restart.
                auto_create_default = os.getenv("AUTO_CREATE_DEFAULT_ADMIN", "true").strip().lower() in {"1", "true", "yes", "on"}
                users_total = conn.execute(text("SELECT COUNT(*) FROM users")).scalar() or 0
                if auto_create_default and int(users_total) == 0:
                    default_name = os.getenv("DEFAULT_ADMIN_NAME", "Admin User").strip() or "Admin User"
                    default_email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@bioface.local").strip().lower() or "admin@bioface.local"

                    # XAVFSIZLIK FIX: Agar DEFAULT_ADMIN_PASSWORD berilmagan bo'lsa,
                    # xavfsiz tasodifiy parol yaratamiz va uni konsol'ga chiqaramiz.
                    _env_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "").strip()
                    if not _env_password or _env_password in {"admin123", "admin", "password", "123456"}:
                        import secrets as _secrets
                        import string as _string
                        _alphabet = _string.ascii_letters + _string.digits + "!@#$%"
                        _env_password = "".join(_secrets.choice(_alphabet) for _ in range(16))
                        print(
                            f"\n{'=' * 60}\n"
                            f"[BIOFACE] Birinchi marta ishga tushirilmoqda.\n"
                            f"Admin hisobi yaratildi:\n"
                            f"  Email   : {default_email}\n"
                            f"  Parol   : {_env_password}\n"
                            f"  ESLATMA : Ushbu parolni darhol o'zgartiring!\n"
                            f"{'=' * 60}\n"
                        )
                    default_password = _env_password

                    hashed_password = bcrypt.hashpw(
                        default_password.encode("utf-8")[:71],
                        bcrypt.gensalt(),
                    ).decode("utf-8")

                    name_parts = default_name.split(maxsplit=1)
                    first_name = name_parts[0] if name_parts else "Admin"
                    last_name = name_parts[1] if len(name_parts) > 1 else "User"
                    conn.execute(
                        text(
                            "INSERT INTO users "
                            "(name, first_name, last_name, middle_name, email, phone, image_url, hashed_password, role, google_oauth_enabled, last_login_provider, organization_id) "
                            "VALUES (:name, :first_name, :last_name, :middle_name, :email, :phone, :image_url, :hashed_password, :role, 0, 'password', NULL)"
                        ),
                        {
                            "name": default_name,
                            "first_name": first_name,
                            "last_name": last_name,
                            "middle_name": "",
                            "email": default_email,
                            "phone": "",
                            "image_url": "",
                            "hashed_password": hashed_password,
                            "role": "super_admin",
                        },
                    )

            if "employees" in inspector.get_table_names():
                emp_cols = {c["name"] for c in inspector.get_columns("employees")}
                if "uuid" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN uuid VARCHAR(36)"))
                    res = conn.execute(text("SELECT id FROM employees WHERE uuid IS NULL"))
                    import uuid as uuid_lib
                    for row in res.fetchall():
                        emp_id = row[0]
                        new_uuid = str(uuid_lib.uuid4())
                        conn.execute(
                            text("UPDATE employees SET uuid = :uuid WHERE id = :id"),
                            {"uuid": new_uuid, "id": emp_id}
                        )
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_employees_uuid ON employees (uuid)"))
                if "personal_id" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN personal_id VARCHAR"))
                if "employee_type" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN employee_type VARCHAR"))
                if "middle_name" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN middle_name VARCHAR"))
                if "salary" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN salary INTEGER"))
                if "salary_status" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN salary_status VARCHAR DEFAULT 'unpaid'"))
                if "department_id" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN department_id INTEGER"))
                if "position_id" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN position_id INTEGER"))
                if "schedule_id" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN schedule_id INTEGER"))
                if "phone" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN phone VARCHAR"))
                if "parent_phone" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN parent_phone VARCHAR"))
                if "region" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN region VARCHAR"))
                if "district" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN district VARCHAR"))
                if "address" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN address VARCHAR"))
                if "birth_date" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN birth_date VARCHAR"))
                if "gender" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN gender VARCHAR"))
                if "last_latitude" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN last_latitude FLOAT"))
                if "last_longitude" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN last_longitude FLOAT"))
                if "last_location_time" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN last_location_time TIMESTAMP"))
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ux_employees_personal_id "
                        "ON employees (personal_id) "
                        "WHERE personal_id IS NOT NULL AND trim(personal_id) <> ''"
                    )
                )
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_employees_department_id ON employees (department_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_employees_position_id ON employees (position_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_employees_schedule_id ON employees (schedule_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_employees_organization_id ON employees (organization_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_employees_org_access ON employees (organization_id, has_access)"))
                if "branch_id" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN branch_id INTEGER"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_employees_branch_id ON employees (branch_id)"))
                if "schedule_type" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN schedule_type VARCHAR DEFAULT 'organization'"))
                    conn.execute(text("UPDATE employees SET schedule_type = 'shift' WHERE schedule_id IS NOT NULL"))
                    conn.execute(text("UPDATE employees SET schedule_type = 'individual' WHERE (start_time IS NOT NULL AND start_time != '')"))

            if "departments" not in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS departments (
                            id INTEGER PRIMARY KEY,
                            name VARCHAR NOT NULL,
                            organization_id INTEGER NOT NULL,
                            created_at DATETIME,
                            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
                        )
                        """
                    )
                )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_departments_organization_id "
                    "ON departments (organization_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_departments_org_name_ci "
                    "ON departments (organization_id, lower(trim(name)))"
                )
            )

            if "positions" not in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS positions (
                            id INTEGER PRIMARY KEY,
                            name VARCHAR NOT NULL,
                            organization_id INTEGER NOT NULL,
                            department_id INTEGER,
                            created_at DATETIME,
                            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
                            FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE CASCADE
                        )
                        """
                    )
                )
            else:
                position_cols = {c["name"] for c in inspector.get_columns("positions")}
                if "department_id" not in position_cols:
                    conn.execute(text("ALTER TABLE positions ADD COLUMN department_id INTEGER"))
                if "salary_options" not in position_cols:
                    conn.execute(text("ALTER TABLE positions ADD COLUMN salary_options VARCHAR"))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_positions_organization_id "
                    "ON positions (organization_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_positions_department_id "
                    "ON positions (department_id)"
                )
            )
            conn.execute(text("DROP INDEX IF EXISTS ux_positions_org_name_ci"))
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_positions_org_dept_name_ci "
                    "ON positions (organization_id, COALESCE(department_id, 0), lower(trim(name)))"
                )
            )

            if "employees" in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        INSERT INTO departments (name, organization_id, created_at)
                        SELECT MIN(trim(e.department)) AS name, e.organization_id, CURRENT_TIMESTAMP
                        FROM employees e
                        WHERE e.organization_id IS NOT NULL
                          AND e.department IS NOT NULL
                          AND trim(e.department) <> ''
                          AND NOT EXISTS (
                              SELECT 1 FROM departments d
                              WHERE d.organization_id = e.organization_id
                                AND lower(trim(d.name)) = lower(trim(e.department))
                          )
                        GROUP BY e.organization_id, lower(trim(e.department))
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        INSERT INTO positions (name, organization_id, department_id, created_at)
                        SELECT
                            MIN(trim(e.position)) AS name,
                            e.organization_id,
                            e.department_id,
                            CURRENT_TIMESTAMP
                        FROM employees e
                        WHERE e.organization_id IS NOT NULL
                          AND e.position IS NOT NULL
                          AND trim(e.position) <> ''
                          AND NOT EXISTS (
                              SELECT 1 FROM positions p
                              WHERE p.organization_id = e.organization_id
                                AND COALESCE(p.department_id, 0) = COALESCE(e.department_id, 0)
                                AND lower(trim(p.name)) = lower(trim(e.position))
                          )
                        GROUP BY e.organization_id, e.department_id, lower(trim(e.position))
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        UPDATE employees
                        SET department_id = (
                            SELECT departments.id
                            FROM departments
                            WHERE departments.organization_id = employees.organization_id
                              AND lower(trim(departments.name)) = lower(trim(employees.department))
                            LIMIT 1
                        )
                        WHERE organization_id IS NOT NULL
                          AND department IS NOT NULL
                          AND trim(department) <> ''
                          AND department_id IS NULL
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        UPDATE employees
                        SET position_id = (
                            SELECT positions.id
                            FROM positions
                            WHERE positions.organization_id = employees.organization_id
                              AND COALESCE(positions.department_id, 0) = COALESCE(employees.department_id, 0)
                              AND lower(trim(positions.name)) = lower(trim(employees.position))
                            LIMIT 1
                        )
                        WHERE organization_id IS NOT NULL
                          AND position IS NOT NULL
                          AND trim(position) <> ''
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        UPDATE employees
                        SET department = (
                            SELECT departments.name
                            FROM departments
                            WHERE departments.id = employees.department_id
                            LIMIT 1
                        )
                        WHERE department_id IS NOT NULL
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        UPDATE employees
                        SET position = (
                            SELECT positions.name
                            FROM positions
                            WHERE positions.id = employees.position_id
                            LIMIT 1
                        )
                        WHERE position_id IS NOT NULL
                        """
                    )
                )

            if "schedules" not in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS schedules (
                            id INTEGER PRIMARY KEY,
                            name VARCHAR NOT NULL,
                            start_time VARCHAR NOT NULL DEFAULT '09:00',
                            end_time VARCHAR NOT NULL DEFAULT '18:00',
                            is_flexible BOOLEAN DEFAULT 0,
                            organization_id INTEGER NOT NULL,
                            created_at DATETIME,
                            updated_at DATETIME,
                            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
                        )
                        """
                    )
                )
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_schedules_organization_id ON schedules (organization_id)"))
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_schedules_org_name_ci "
                    "ON schedules (organization_id, lower(trim(name)))"
                )
            )
            conn.execute(
                text(
                    """
                    INSERT INTO schedules (name, start_time, end_time, is_flexible, organization_id, created_at, updated_at)
                    SELECT
                        'Asosiy smena',
                        COALESCE(NULLIF(trim(o.default_start_time), ''), '09:00'),
                        COALESCE(NULLIF(trim(o.default_end_time), ''), '18:00'),
                        false,
                        o.id,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    FROM organizations o
                    WHERE o.id IS NOT NULL
                      AND NOT EXISTS (
                          SELECT 1 FROM schedules s
                          WHERE s.organization_id = o.id
                            AND lower(trim(s.name)) = 'asosiy smena'
                      )
                    """
                )
            )
            if "employees" in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        UPDATE employees
                        SET schedule_id = (
                            SELECT schedules.id
                            FROM schedules
                            WHERE schedules.organization_id = employees.organization_id
                            ORDER BY CASE WHEN lower(trim(schedules.name)) = 'asosiy smena' THEN 0 ELSE 1 END, schedules.id
                            LIMIT 1
                        )
                        WHERE employees.organization_id IS NOT NULL
                          AND employees.schedule_id IS NULL
                          AND COALESCE(trim(employees.start_time), '') = ''
                          AND COALESCE(trim(employees.end_time), '') = ''
                        """
                    )
                )

            if "holidays" not in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS holidays (
                            id INTEGER PRIMARY KEY,
                            title VARCHAR NOT NULL,
                            date DATE NOT NULL,
                            organization_id INTEGER,
                            is_weekend BOOLEAN DEFAULT 0,
                            created_at DATETIME,
                            updated_at DATETIME,
                            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
                        )
                        """
                    )
                )
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_holidays_date ON holidays (date)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_holidays_organization_id ON holidays (organization_id)"))
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_holidays_scope_date_title "
                    "ON holidays (COALESCE(organization_id, 0), date, lower(trim(title)))"
                )
            )

            if "attendance_logs" in inspector.get_table_names():
                attendance_cols = {c["name"] for c in inspector.get_columns("attendance_logs")}
                if "wellbeing_note_uz" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN wellbeing_note_uz VARCHAR"))
                if "wellbeing_note_ru" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN wellbeing_note_ru VARCHAR"))
                if "wellbeing_note_source" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN wellbeing_note_source VARCHAR"))
                if "psychological_state_key" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN psychological_state_key VARCHAR"))
                if "psychological_state_confidence" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN psychological_state_confidence FLOAT"))
                if "emotion_scores_json" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN emotion_scores_json VARCHAR"))
                if "liveness_score" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN liveness_score FLOAT"))
                if "liveness_status" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN liveness_status VARCHAR"))
                if "face_confidence" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN face_confidence FLOAT"))
                if "attendance_source" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN attendance_source VARCHAR"))
                if "mobile_device_id" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN mobile_device_id VARCHAR"))
                if "mobile_distance_m" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN mobile_distance_m FLOAT"))
                if "mobile_similarity" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN mobile_similarity FLOAT"))
                if "direction" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN direction VARCHAR"))
                if "latitude" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN latitude FLOAT"))
                if "longitude" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN longitude FLOAT"))
                if "review_status" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN review_status VARCHAR DEFAULT 'auto'"))
                    conn.execute(text("UPDATE attendance_logs SET review_status = 'auto' WHERE review_status IS NULL"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attendance_logs_review_status ON attendance_logs (review_status)"))
                if "review_reason" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN review_reason VARCHAR"))
                if "reviewed_by_id" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN reviewed_by_id INTEGER"))
                if "reviewed_at" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN reviewed_at TIMESTAMP"))
                if "review_note" not in attendance_cols:
                    conn.execute(text("ALTER TABLE attendance_logs ADD COLUMN review_note VARCHAR"))

            if "attendance_review_audits" not in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS attendance_review_audits (
                            id INTEGER PRIMARY KEY,
                            attendance_log_id INTEGER NOT NULL,
                            action VARCHAR NOT NULL,
                            old_employee_id INTEGER,
                            new_employee_id INTEGER,
                            old_status VARCHAR,
                            new_status VARCHAR,
                            old_review_status VARCHAR,
                            new_review_status VARCHAR,
                            note VARCHAR,
                            created_by_id INTEGER,
                            created_at TIMESTAMP,
                            FOREIGN KEY(attendance_log_id) REFERENCES attendance_logs(id) ON DELETE CASCADE,
                            FOREIGN KEY(created_by_id) REFERENCES users(id)
                        )
                        """
                    )
                )
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attendance_review_audits_log_id ON attendance_review_audits (attendance_log_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_attendance_review_audits_created_at ON attendance_review_audits (created_at)"))

            if "employee_camera_links" not in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS employee_camera_links (
                            id INTEGER PRIMARY KEY,
                            employee_id INTEGER NOT NULL,
                            camera_id INTEGER NOT NULL,
                            created_at DATETIME,
                            FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                            FOREIGN KEY(camera_id) REFERENCES devices(id) ON DELETE CASCADE
                        )
                        """
                    )
                )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_employee_camera_links_emp_cam "
                    "ON employee_camera_links (employee_id, camera_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_employee_camera_links_employee_id "
                    "ON employee_camera_links (employee_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_employee_camera_links_camera_id "
                    "ON employee_camera_links (camera_id)"
                )
            )

            if "user_organization_links" not in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS user_organization_links (
                            id INTEGER PRIMARY KEY,
                            user_id INTEGER NOT NULL,
                            organization_id INTEGER NOT NULL,
                            created_at DATETIME,
                            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                            FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
                        )
                        """
                    )
                )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_user_organization_links_user_org "
                    "ON user_organization_links (user_id, organization_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_user_organization_links_user_id "
                    "ON user_organization_links (user_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_user_organization_links_org_id "
                    "ON user_organization_links (organization_id)"
                )
            )

            if "telegram_user_bindings" not in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS telegram_user_bindings (
                            id INTEGER PRIMARY KEY,
                            telegram_user_id VARCHAR NOT NULL,
                            telegram_chat_id VARCHAR,
                            language VARCHAR NOT NULL DEFAULT 'uz',
                            employee_id INTEGER,
                            created_at DATETIME,
                            updated_at DATETIME,
                            FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE SET NULL
                        )
                        """
                    )
                )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_telegram_user_bindings_user_id "
                    "ON telegram_user_bindings (telegram_user_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_telegram_user_bindings_chat_id "
                    "ON telegram_user_bindings (telegram_chat_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_telegram_user_bindings_employee_id "
                    "ON telegram_user_bindings (employee_id)"
                )
            )

            if "telegram_contacts" not in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS telegram_contacts (
                            id INTEGER PRIMARY KEY,
                            employee_id INTEGER NOT NULL,
                            telegram_chat_id VARCHAR NOT NULL,
                            label VARCHAR,
                            language VARCHAR NOT NULL DEFAULT 'uz',
                            is_active BOOLEAN DEFAULT 1,
                            created_at DATETIME,
                            updated_at DATETIME,
                            FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
                        )
                        """
                    )
                )
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_telegram_contacts_employee_id ON telegram_contacts (employee_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_telegram_contacts_chat_id ON telegram_contacts (telegram_chat_id)"))
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_telegram_contacts_emp_chat "
                    "ON telegram_contacts (employee_id, telegram_chat_id)"
                )
            )

            if "attendance_notification_logs" not in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS attendance_notification_logs (
                            id INTEGER PRIMARY KEY,
                            employee_id INTEGER NOT NULL,
                            target_date DATE NOT NULL,
                            notification_type VARCHAR NOT NULL DEFAULT 'missed_shift',
                            schedule_id INTEGER,
                            sent_at DATETIME,
                            FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                            FOREIGN KEY(schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
                        )
                        """
                    )
                )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_attendance_notification_logs_employee_id "
                    "ON attendance_notification_logs (employee_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_attendance_notification_logs_target_date "
                    "ON attendance_notification_logs (target_date)"
                )
            )
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ux_attendance_notification_logs_unique "
                    "ON attendance_notification_logs (employee_id, target_date, notification_type)"
                )
            )

            if "employee_wellbeing_notes" not in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS employee_wellbeing_notes (
                            id INTEGER PRIMARY KEY,
                            employee_id INTEGER NOT NULL,
                            note_uz VARCHAR NOT NULL,
                            note_ru VARCHAR NOT NULL,
                            source VARCHAR NOT NULL DEFAULT 'manual',
                            created_at DATETIME,
                            updated_at DATETIME,
                            FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
                        )
                        """
                    )
                )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_employee_wellbeing_notes_employee_id "
                    "ON employee_wellbeing_notes (employee_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_employee_wellbeing_notes_created_at "
                    "ON employee_wellbeing_notes (created_at)"
                )
            )

            if "employee_psychological_states" not in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        CREATE TABLE IF NOT EXISTS employee_psychological_states (
                            id INTEGER PRIMARY KEY,
                            employee_id INTEGER NOT NULL,
                            state_key VARCHAR,
                            state_uz VARCHAR NOT NULL,
                            state_ru VARCHAR NOT NULL,
                            confidence FLOAT,
                            emotion_scores_json VARCHAR,
                            state_date VARCHAR NOT NULL,
                            source VARCHAR NOT NULL DEFAULT 'manual',
                            note VARCHAR,
                            assessed_at DATETIME,
                            created_at DATETIME,
                            updated_at DATETIME,
                            FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE,
                            CHECK (source IN ('manual', 'psychologist_assessment', 'questionnaire', 'external_system'))
                        )
                        """
                    )
                )
            else:
                psych_cols = {c["name"] for c in inspector.get_columns("employee_psychological_states")}
                if "state_date" not in psych_cols:
                    conn.execute(text("ALTER TABLE employee_psychological_states ADD COLUMN state_date VARCHAR"))
                    if conn.dialect.name == "postgresql":
                        conn.execute(
                            text(
                                "UPDATE employee_psychological_states "
                                "SET state_date = COALESCE(to_char(assessed_at, 'YYYY-MM-DD'), to_char(created_at, 'YYYY-MM-DD'), to_char(CURRENT_DATE, 'YYYY-MM-DD')) "
                                "WHERE state_date IS NULL OR trim(state_date) = ''"
                            )
                        )
                    else:
                        conn.execute(
                            text(
                                "UPDATE employee_psychological_states "
                                "SET state_date = COALESCE(substr(assessed_at, 1, 10), substr(created_at, 1, 10), date('now')) "
                                "WHERE state_date IS NULL OR trim(state_date) = ''"
                            )
                        )
                if "state_key" not in psych_cols:
                    conn.execute(text("ALTER TABLE employee_psychological_states ADD COLUMN state_key VARCHAR"))
                if "confidence" not in psych_cols:
                    conn.execute(text("ALTER TABLE employee_psychological_states ADD COLUMN confidence FLOAT"))
                if "emotion_scores_json" not in psych_cols:
                    conn.execute(text("ALTER TABLE employee_psychological_states ADD COLUMN emotion_scores_json VARCHAR"))
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_employee_psychological_states_employee_id "
                    "ON employee_psychological_states (employee_id)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_employee_psychological_states_assessed_at "
                    "ON employee_psychological_states (assessed_at)"
                )
            )
            conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_employee_psychological_states_employee_date "
                    "ON employee_psychological_states (employee_id, state_date)"
                )
            )

            # Migrate contact_messages if needed
            if "contact_messages" in inspector.get_table_names():
                msg_cols = {c["name"] for c in inspector.get_columns("contact_messages")}
                if "is_read" not in msg_cols:
                    conn.execute(text("ALTER TABLE contact_messages ADD COLUMN is_read BOOLEAN DEFAULT 0"))

            # Backfill legacy users.organization_id into link table.
            if is_sqlite:
                conn.execute(
                    text(
                        """
                        INSERT OR IGNORE INTO user_organization_links (user_id, organization_id, created_at)
                        SELECT id, organization_id, CURRENT_TIMESTAMP
                        FROM users
                        WHERE organization_id IS NOT NULL
                        """
                    )
                )
            else:
                conn.execute(
                    text(
                        """
                        INSERT INTO user_organization_links (user_id, organization_id, created_at)
                        SELECT id, organization_id, CURRENT_TIMESTAMP
                        FROM users
                        WHERE organization_id IS NOT NULL
                        ON CONFLICT DO NOTHING
                        """
                    )
                )
            # Migrate cashflow_transactions to add account_id if missing
            if "cashflow_transactions" in inspector.get_table_names():
                cf_cols = {c["name"] for c in inspector.get_columns("cashflow_transactions")}
                if "account_id" not in cf_cols:
                    conn.execute(text("ALTER TABLE cashflow_transactions ADD COLUMN account_id INTEGER"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_cashflow_transactions_account_id ON cashflow_transactions (account_id)"))

            # Migrate finance_accounts to add account_number if missing
            if "finance_accounts" in inspector.get_table_names():
                fa_cols = {c["name"] for c in inspector.get_columns("finance_accounts")}
                if "account_number" not in fa_cols:
                    conn.execute(text("ALTER TABLE finance_accounts ADD COLUMN account_number VARCHAR"))

            try:
                conn.commit()
            except Exception:
                pass
        _SCHEMA_READY = True
        return True
    except Exception as e:
        import traceback
        traceback.print_exc()
        # Avoid blocking app start on migration errors; logs can be added later.
        return False

def get_bot_token():
    """Fetch the bot token from the database."""
    with engine.connect() as conn:
        result = conn.execute(text("SELECT telegram_bot_token FROM organizations WHERE telegram_bot_token IS NOT NULL LIMIT 1"))
        token = result.scalar()
        if not token:
            raise ValueError("Telegram bot token is not configured in the database.")
        return token
