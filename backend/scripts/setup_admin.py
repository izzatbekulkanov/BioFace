#!/usr/bin/env python3
"""
Bu script templatelarni yangi Starlette sintaksisga o'zgartiradi va
superadmin yaratadi.
"""
import os
import re
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

print("=" * 50)
print("  BioFace Setup Script")
print("=" * 50)
print()

# 1. Create superadmin
print("[1/2] Superadmin yaratish...")
try:
    from database import SessionLocal, engine
    import models
    import bcrypt
    
    # Create tables
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # Check if admin@gmail.com exists
    existing = db.query(models.User).filter(models.User.email == "admin@gmail.com").first()
    
    if existing:
        print(f"      ℹ admin@gmail.com allaqachon mavjud")
        # Update password to admin123
        hashed = bcrypt.hashpw("admin123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        existing.hashed_password = hashed
        existing.role = models.UserRole.SUPER_ADMIN
        db.commit()
        print(f"      ✓ Parol yangilandi: admin123")
    else:
        # Create new admin
        hashed = bcrypt.hashpw("admin123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        admin = models.User(
            name="Super Admin",
            first_name="Super",
            last_name="Admin",
            email="admin@gmail.com",
            hashed_password=hashed,
            role=models.UserRole.SUPER_ADMIN,
            organization_id=None
        )
        db.add(admin)
        db.commit()
        print(f"      ✓ admin@gmail.com yaratildi (parol: admin123)")
    
    db.close()
except Exception as e:
    print(f"      ✗ Xato: {e}")

print()

# 2. Check ISUP
print("[2/2] ISUP holatini tekshirish...")
try:
    from services.isup_manager import get_process_status, start_isup_server
    status = get_process_status()
    
    if status['running']:
        print(f"      ✓ ISUP server ishlamoqda (PID: {status.get('pid', '?')})")
    else:
        print(f"      ℹ ISUP server ishlamayapti, ishga tushirilmoqda...")
        try:
            result = start_isup_server()
            if result['running']:
                print(f"      ✓ ISUP server ishga tushdi (PID: {result.get('pid', '?')})")
            else:
                print(f"      ⚠ ISUP server ishga tushmadi")
                print(f"      → Sabab: SDK yoki DLL fayllari muammosi bo'lishi mumkin")
                print(f"      → Web tizim baribir ishlaydi, faqat kamera integratsiyasi bo'lmaydi")
        except Exception as start_err:
            print(f"      ⚠ ISUP ishga tushmadi: {start_err}")
            print(f"      → Web tizim baribir ishlaydi")
except Exception as e:
    print(f"      ⚠ ISUP tekshirib bo'lmadi: {e}")
    print(f"      → Web tizim baribir ishlaydi")

print()
print("=" * 50)
print("  ✓ Setup tugadi!")
print("=" * 50)
print()
print("Login ma'lumotlari:")
print("  Email:    admin@gmail.com")
print("  Parol:    admin123")
print()
print("Serverni ishga tushiring:")
print("  .\\start.ps1")
print()
