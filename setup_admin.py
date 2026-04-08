#!/usr/bin/env python3
"""
Bu script templatelarni yangi Starlette sintaksisga o'zgartiradi va
superadmin yaratadi.
"""
import re
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 50)
print("  BioFace Setup Script")
print("=" * 50)
print()

# 1. Fix templates
print("[1/3] Templatelarni tuzatish...")
file_path = r"routers\pages.py"

try:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Count old patterns
    old_count = len(re.findall(r'templates\.TemplateResponse\("', content))
    
    if old_count > 0:
        print(f"      {old_count} ta eski sintaksis topildi...")
        
        # Fix pattern
        content = re.sub(
            r'templates\.TemplateResponse\("([^"]+)",\s*\{',
            r'templates.TemplateResponse(request=request, name="\1", context={',
            content
        )

        # Write back
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        # Verify
        with open(file_path, "r", encoding="utf-8") as f:
            new_content = f.read()
        new_count = len(re.findall(r'templates\.TemplateResponse\("', new_content))

        print(f"      ✓ {old_count - new_count} ta tuzatildi")
        if new_count > 0:
            print(f"      ⚠ {new_count} ta qoldi (bularni qo'lda tekshiring)")
    else:
        print(f"      ✓ Barcha templatelar allaqachon yangi sintaksisda")
except Exception as e:
    print(f"      ✗ Xato: {e}")

print()

# 2. Create superadmin
print("[2/3] Superadmin yaratish...")
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

# 3. Check ISUP
print("[3/3] ISUP holatini tekshirish...")
try:
    from isup_manager import get_process_status, start_isup_server
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
