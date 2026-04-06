import os
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker, declarative_base
import bcrypt

# Database URL configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'bioface.db')}"  # PostgreSQL: "postgresql://user:password@postgresserver/db"

# Engine setup
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False} # Needed for SQLite only
)

# SessionLocal class for creating new DB sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for SQLAlchemy Models
Base = declarative_base()

# DB Dependency generator
def get_db():
    _maybe_ensure_schema()
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
    Lightweight migrations for SQLite when Alembic is not used.
    Safely adds new columns/indexes if missing.
    """
    try:
        with engine.begin() as conn:
            inspector = inspect(conn)
            if "devices" in inspector.get_table_names():
                cols = {c["name"] for c in inspector.get_columns("devices")}
                if "isup_device_id" not in cols:
                    conn.execute(text("ALTER TABLE devices ADD COLUMN isup_device_id VARCHAR"))
                    conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_devices_isup_device_id ON devices (isup_device_id)"))

            if "organizations" in inspector.get_table_names():
                org_cols = {c["name"] for c in inspector.get_columns("organizations")}
                if "organization_type" not in org_cols:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN organization_type VARCHAR"))
                conn.execute(
                    text(
                        "UPDATE organizations "
                        "SET organization_type = 'boshqa' "
                        "WHERE organization_type IS NULL OR trim(organization_type) = ''"
                    )
                )

            if "users" in inspector.get_table_names():
                user_cols = {c["name"] for c in inspector.get_columns("users")}
                user_alters = {
                    "first_name": "ALTER TABLE users ADD COLUMN first_name VARCHAR",
                    "last_name": "ALTER TABLE users ADD COLUMN last_name VARCHAR",
                    "middle_name": "ALTER TABLE users ADD COLUMN middle_name VARCHAR",
                    "phone": "ALTER TABLE users ADD COLUMN phone VARCHAR",
                    "image_url": "ALTER TABLE users ADD COLUMN image_url VARCHAR",
                }
                for col_name, sql in user_alters.items():
                    if col_name not in user_cols:
                        conn.execute(text(sql))

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
                        text("UPDATE users SET role = :new_role WHERE role = :old_role"),
                        {"new_role": new_role, "old_role": old_role},
                    )

                # Ensure default admin account exists only for first bootstrap.
                # This prevents deleted users from being recreated on every restart.
                auto_create_default = os.getenv("AUTO_CREATE_DEFAULT_ADMIN", "true").strip().lower() in {"1", "true", "yes", "on"}
                users_total = conn.execute(text("SELECT COUNT(*) FROM users")).scalar() or 0
                if auto_create_default and int(users_total) == 0:
                    default_name = os.getenv("DEFAULT_ADMIN_NAME", "Admin User").strip() or "Admin User"
                    default_email = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@bioface.local").strip().lower() or "admin@bioface.local"
                    default_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123").strip() or "admin123"
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
                            "(name, first_name, last_name, middle_name, email, phone, image_url, hashed_password, role, organization_id) "
                            "VALUES (:name, :first_name, :last_name, :middle_name, :email, :phone, :image_url, :hashed_password, :role, NULL)"
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
                if "personal_id" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN personal_id VARCHAR"))
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ux_employees_personal_id "
                        "ON employees (personal_id) "
                        "WHERE personal_id IS NOT NULL AND trim(personal_id) <> ''"
                    )
                )

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
        return True
    except Exception:
        # Avoid blocking app start on migration errors; logs can be added later.
        return False
