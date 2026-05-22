import os
import sqlite3
from datetime import datetime, timedelta, timezone

def archive_old_logs(days: int = 180) -> dict:
    """
    Safely migrates attendance logs older than `days` to `bioface_archive.db`,
    deletes them from the active `bioface.db`, and vacuums the active DB to reclaim space.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(base_dir, 'data')
    
    db_path = os.path.join(data_dir, 'bioface.db')
    archive_db_path = os.path.join(data_dir, 'bioface_archive.db')
    
    if not os.path.exists(db_path):
        return {"success": False, "error": "Active database not found", "archived_count": 0, "freed_bytes": 0}
        
    initial_size = os.path.getsize(db_path)
    
    # Calculate cutoff time in Tashkent / Local time
    # SQLite datetime comparison is usually done using ISO string or standard format
    cutoff_dt = datetime.now() - timedelta(days=days)
    cutoff_str = cutoff_dt.strftime("%Y-%m-%d %H:%M:%S")
    
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check how many records match
        cursor.execute("SELECT COUNT(*) FROM attendance_logs WHERE timestamp < ?", (cutoff_str,))
        to_archive_count = cursor.fetchone()[0]
        
        if to_archive_count == 0:
            return {
                "success": True,
                "message": "Arxivlash uchun mos keluvchi eski yozuvlar topilmadi",
                "archived_count": 0,
                "freed_bytes": 0
            }
            
        # Attach the archive database
        cursor.execute(f"ATTACH DATABASE ? AS archive", (archive_db_path,))
        
        # Ensure target table exists in the archive database by copying structure
        # sqlite3 lets us create table as select with limit 0
        cursor.execute("CREATE TABLE IF NOT EXISTS archive.attendance_logs AS SELECT * FROM main.attendance_logs LIMIT 0")
        
        # Execute migration and deletion in a transaction
        conn.execute("BEGIN TRANSACTION")
        
        # Copy to archive
        cursor.execute(
            "INSERT INTO archive.attendance_logs SELECT * FROM main.attendance_logs WHERE timestamp < ?",
            (cutoff_str,)
        )
        
        # Delete from main
        cursor.execute(
            "DELETE FROM main.attendance_logs WHERE timestamp < ?",
            (cutoff_str,)
        )
        
        conn.commit()
        
        # Detach archive database
        cursor.execute("DETACH DATABASE archive")
        
        # Run vacuum to optimize and reclaim space (cannot run inside active transaction)
        cursor.close()
        conn.close()
        
        # Re-open without transaction to vacuum
        conn = sqlite3.connect(db_path)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("VACUUM")
        conn.close()
        
        final_size = os.path.getsize(db_path)
        freed_bytes = max(0, initial_size - final_size)
        
        return {
            "success": True,
            "message": f"Muvaffaqiyatli arxivlandi! {to_archive_count} ta yozuv arxiv bazasiga ko'chirildi.",
            "archived_count": to_archive_count,
            "freed_bytes": freed_bytes,
            "initial_size_mb": round(initial_size / (1024 * 1024), 2),
            "final_size_mb": round(final_size / (1024 * 1024), 2),
            "reclaimed_space_kb": round(freed_bytes / 1024, 2)
        }
        
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
            try:
                conn.close()
            except Exception:
                pass
        return {
            "success": False,
            "error": str(e),
            "archived_count": 0,
            "freed_bytes": 0
        }

if __name__ == "__main__":
    result = archive_old_logs(180)
    print(result)
