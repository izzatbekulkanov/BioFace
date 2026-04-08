import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
import models
import bcrypt

print("=" * 60)
print("  Admin yaratish")
print("=" * 60)

# Create tables
models.Base.metadata.create_all(bind=engine)
print("\n[1] Jadvallar yaratildi")

# Open session
db = SessionLocal()

# Check existing
print("\n[2] Mavjud userlar:")
all_users = db.query(models.User).all()
for u in all_users:
    print(f"    - {u.email}")

# Create admin
print("\n[3] admin@gmail.com yaratish...")
admin = db.query(models.User).filter(models.User.email == "admin@gmail.com").first()

hashed = bcrypt.hashpw("admin123".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

if admin:
    print("    Mavjud admin yangilanmoqda...")
    admin.hashed_password = hashed
    admin.role = models.UserRole.SUPER_ADMIN
    admin.name = "Super Admin"
    admin.first_name = "Super"
    admin.last_name = "Admin"
else:
    print("    Yangi admin yaratilmoqda...")
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

# Verify
verify = db.query(models.User).filter(models.User.email == "admin@gmail.com").first()
test_ok = bcrypt.checkpw("admin123".encode("utf-8"), verify.hashed_password.encode("utf-8"))

print(f"\n[4] Tekshirish:")
print(f"    Email: {verify.email}")
print(f"    Role: {verify.role.value}")
print(f"    Parol test: {'✓ MUVAFFAQIYATLI' if test_ok else '✗ XATO'}")

db.close()

print("\n" + "=" * 60)
print("  TAYYOR!")
print("=" * 60)
print("\nLogin:")
print("  Email: admin@gmail.com")
print("  Parol: admin123")
print("=" * 60)
