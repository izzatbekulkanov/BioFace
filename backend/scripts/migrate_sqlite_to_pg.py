#!/usr/bin/env python3
import sqlite3
import psycopg2
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

# SQLite connection
sqlite_path = BASE_DIR / "data" / "bioface.db"
if not sqlite_path.exists():
    print(f"Error: SQLite database not found at {sqlite_path}")
    sys.exit(1)

print(f"Connecting to SQLite: {sqlite_path}")
lite_conn = sqlite3.connect(sqlite_path)
lite_conn.row_factory = sqlite3.Row
lite_cur = lite_conn.cursor()

# PostgreSQL connection
pg_dsn = "postgresql://biofaceuser:bioface1231@127.0.0.1:5432/biofacedb"
print(f"Connecting to PostgreSQL: {pg_dsn}")
try:
    pg_conn = psycopg2.connect(pg_dsn)
    pg_cur = pg_conn.cursor()
except Exception as e:
    print(f"Failed to connect to PostgreSQL: {e}")
    sys.exit(1)

# List of tables in topological order
tables = [
    "organizations",
    "departments",
    "positions",
    "schedules",
    "users",
    "devices",
    "employees",
    "user_organization_links",
    "employee_camera_links",
    "attendance_logs",
    "employee_wellbeing_notes",
    "employee_psychological_states",
    "telegram_contacts",
    "attendance_notification_logs",
    "telegram_user_bindings",
    "request_logs",
    "contact_messages"
]

try:
    # Clear PostgreSQL tables (in reverse order of foreign keys)
    print("Clearing existing tables in PostgreSQL...")
    for table in reversed(tables):
        pg_cur.execute(f"TRUNCATE TABLE {table} CASCADE;")
    pg_conn.commit()

    # Copy data from SQLite to PostgreSQL
    for table in tables:
        print(f"Migrating table: {table}")
        
        # Read from SQLite
        lite_cur.execute(f"SELECT * FROM {table}")
        rows = lite_cur.fetchall()
        if not rows:
            print(f"  No rows in SQLite {table}")
            continue

        columns = rows[0].keys()
        
        # Get column types from PostgreSQL to cast booleans correctly
        pg_cur.execute(f"""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = '{table}';
        """)
        col_types = {col_info[0]: col_info[1] for col_info in pg_cur.fetchall()}

        # Build PostgreSQL INSERT statement
        col_list = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))
        insert_query = f"INSERT INTO {table} ({col_list}) VALUES ({placeholders})"

        # Convert rows to tuple format for execution, casting booleans where needed
        val_list = []
        for row in rows:
            row_vals = []
            for col in columns:
                val = row[col]
                if col_types.get(col) == "boolean" and val is not None:
                    val = bool(val)
                row_vals.append(val)
            val_list.append(tuple(row_vals))

        # Execute executemany
        pg_cur.executemany(insert_query, val_list)
        pg_conn.commit()
        print(f"  Successfully migrated {len(rows)} rows to {table}")

    # Fix auto-increment sequences in PostgreSQL for all tables
    print("Resetting PostgreSQL primary key sequences...")
    for table in tables:
        # Check if id column exists
        pg_cur.execute(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '{table}' AND column_name = 'id';
        """)
        if pg_cur.fetchone():
            pg_cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE((SELECT MAX(id) FROM {table}), 1), false);")
    pg_conn.commit()
    print("Migration completed successfully!")

except Exception as e:
    pg_conn.rollback()
    print(f"Migration failed: {e}")
    sys.exit(1)
finally:
    lite_conn.close()
    pg_conn.close()
