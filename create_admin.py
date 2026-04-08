#!/usr/bin/env python3
"""Superadmin yaratish va ma'lumotlar bazasini sozlash"""

import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("  Superadmin yaratish")
print("=" * 60)
print()

try:
    from database import SessionLocal, engine
    import models
    import bcrypt
    
    # Create tables
    print("[1/2] Ma'lumotlar bazasi jadvallarini yaratish...")
    models.Base.metadata.create_all(bind=engine)
    print("      ✓ Jadvallar yaratildi\n")
    
    # Create session
    db = SessionLocal()
    
    print("[2/2] Superadmin yaratish...")
    
    # Check if admin@gmail.com exists
    existing = db.query(models.User).filter(models.User.email == "admin@gmail.com").first()
    
    if existing:
        print(f"      ℹ admin@gmail.com allaqachon mavjud")
        # Update password to admin123
        hashed = bcrypt.hashpw("admin123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        existing.hashed_password = hashed
        existing.role = models.UserRole.super_admin
        existing.name = "Super Admin"
        existing.first_name = "Super"
        existing.last_name = "Admin"
        db.commit()
        print(f"      ✓ Parol va ma'lumotlar yangilandi")
    else:
        # Create new admin
        hashed = bcrypt.hashpw("admin123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        admin = models.User(
            name="Super Admin",
            first_name="Super",
            last_name="Admin",
            email="admin@gmail.com",
            hashed_password=hashed,
            role=models.UserRole.super_admin,
            organization_id=None
        )
        db.add(admin)
        db.commit()
        print(f"      ✓ Yangi admin yaratildi")
    
    db.close()
    
    print()
    print("=" * 60)
    print("  ✅ Tayyor!")
    print("=" * 60)
    print()
    print("Login ma'lumotlari:")
    print("  📧 Email: admin@gmail.com")
    print("  🔑 Parol: admin123")
    print()
    
except Exception as e:
    print(f"\n❌ Xatolik: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
