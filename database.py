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
                conn.execute(
                    text(
                        "UPDATE organizations "
                        "SET organization_type = 'boshqa' "
                        "WHERE organization_type IS NULL OR trim(organization_type) = ''"
                    )
                )
                # Seed Telegram settings into DB once so bot runtime can read from DB only.
                try:
                    from menu_utils import get_menu_data

                    menu_data = get_menu_data()
                except Exception:
                    menu_data = {}

                token_seed = str(menu_data.get("telegram_bot_token") or "").strip()
                admin_chat_seed = str(menu_data.get("telegram_admin_chat_id") or "").strip()
                enabled_seed = 1 if bool(menu_data.get("telegram_enabled", False)) else 0

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
                }
                for col_name, sql in user_alters.items():
                    if col_name not in user_cols:
                        conn.execute(text(sql))
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub "
                        "ON users (google_sub) "
                        "WHERE google_sub IS NOT NULL AND trim(google_sub) <> ''"
                    )
                )
                conn.execute(
                    text(
                        "UPDATE users "
                        "SET google_oauth_enabled = COALESCE(google_oauth_enabled, 0), "
                        "last_login_provider = COALESCE(NULLIF(trim(last_login_provider), ''), 'password')"
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
                if "personal_id" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN personal_id VARCHAR"))
                if "employee_type" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN employee_type VARCHAR"))
                if "middle_name" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN middle_name VARCHAR"))
                if "department_id" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN department_id INTEGER"))
                if "position_id" not in emp_cols:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN position_id INTEGER"))
                conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS ux_employees_personal_id "
                        "ON employees (personal_id) "
                        "WHERE personal_id IS NOT NULL AND trim(personal_id) <> ''"
                    )
                )
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_employees_department_id ON employees (department_id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_employees_position_id ON employees (position_id)"))

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
                    "ON positions (organization_id, ifnull(department_id, 0), lower(trim(name)))"
                )
            )

            if "employees" in inspector.get_table_names():
                conn.execute(
                    text(
                        """
                        INSERT OR IGNORE INTO departments (name, organization_id, created_at)
                        SELECT MIN(trim(department)) AS name, organization_id, CURRENT_TIMESTAMP
                        FROM employees
                        WHERE organization_id IS NOT NULL
                          AND department IS NOT NULL
                          AND trim(department) <> ''
                        GROUP BY organization_id, lower(trim(department))
                        """
                    )
                )
                conn.execute(
                    text(
                        """
                        INSERT OR IGNORE INTO positions (name, organization_id, department_id, created_at)
                        SELECT
                            MIN(trim(position)) AS name,
                            organization_id,
                            department_id,
                            CURRENT_TIMESTAMP
                        FROM employees
                        WHERE organization_id IS NOT NULL
                          AND position IS NOT NULL
                          AND trim(position) <> ''
                        GROUP BY organization_id, ifnull(department_id, 0), lower(trim(position))
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
                              AND ifnull(positions.department_id, 0) = ifnull(employees.department_id, 0)
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

            # Backfill legacy users.organization_id into link table.
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
        return True
    except Exception:
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
