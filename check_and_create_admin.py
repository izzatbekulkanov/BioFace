#!/usr/bin/env python3
"""Admin tekshirish va yaratish"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 60)
print("  Ma'lumotlar bazasini tekshirish")
print("=" * 60)
print()

try:
    from database import SessionLocal, engine
    import models
    import bcrypt
    
    # Create tables
    print("[1/3] Jadvallarni yaratish...")
    models.Base.metadata.create_all(bind=engine)
    print("      ✓ Jadvallar yaratildi")
    print()
    
    # Open session
    db = SessionLocal()
    
    # Check existing users
    print("[2/3] Mavjud foydalanuvchilar:")
    all_users = db.query(models.User).all()
    if not all_users:
        print("      ⚠ Hech qanday foydalanuvchi topilmadi!")
    else:
        for u in all_users:
            print(f"      - {u.email} ({u.role.value if u.role else 'no role'})")
    print()
    
    # Create or update admin
    print("[3/3] admin@gmail.com yaratish/yangilash...")
    
    admin = db.query(models.User).filter(models.User.email == "admin@gmail.com").first()
    
    # Hash password
    hashed = bcrypt.hashpw("admin123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    
    if admin:
        print("      ℹ admin@gmail.com topildi, parol yangilanmoqda...")
        admin.hashed_password = hashed
        admin.role = models.UserRole.SUPER_ADMIN
        admin.name = "Super Admin"
        admin.first_name = "Super"
        admin.last_name = "Admin"
    else:
        print("      ℹ admin@gmail.com topilmadi, yangi yaratilmoqda...")
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
    print("      ✓ Saqlandi!")
    print()
    
    # Verify
    print("Tekshirish:")
    verify_admin = db.query(models.User).filter(models.User.email == "admin@gmail.com").first()
    if verify_admin:
        print(f"  ✓ Email: {verify_admin.email}")
        print(f"  ✓ Ismi: {verify_admin.name}")
        print(f"  ✓ Role: {verify_admin.role.value if verify_admin.role else 'NONE'}")
        print(f"  ✓ Hashed parol: {verify_admin.hashed_password[:20]}...")
        
        # Test password
        test_ok = bcrypt.checkpw("admin123".encode("utf-8"), verify_admin.hashed_password.encode("utf-8"))
        if test_ok:
            print(f"  ✓ Parol tekshiruvi: MUVAFFAQIYATLI ✅")
        else:
            print(f"  ✗ Parol tekshiruvi: XATO ❌")
    else:
        print("  ✗ Admin topilmadi! ❌")
    
    db.close()
    
    print()
    print("=" * 60)
    print("  Tayyor!")
    print("=" * 60)
    print()
    print("Login ma'lumotlari:")
    print("  📧 Email: admin@gmail.com")
    print("  🔑 Parol: admin123")
    print()
    print("Tizimga kirish:")
    print("  http://localhost:8000/login")
    print()
    
except Exception as e:
    print(f"\n❌ Xatolik: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
