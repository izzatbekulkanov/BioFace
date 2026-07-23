from datetime import datetime
from database import SessionLocal
from models import SystemVersion

def seed_version():
    db = SessionLocal()

    version_num = "2.0.0"
    title = "Telegram WebApp sinxronizatsiyasi, Xodimlarni Ish Vaqtida Kuzatish va Biometriya Tezligi Oshirildi"
    module = "core"
    author = "Antigravity AI"
    status = "released"

    release_notes = """### 🚀 BioFace v2.0.0 — Keng Ko'lamli Yangilanish va Optimallashtirish

Ushbu versiyada tizimning Telegram WebApp integratsiyasi, GPS kuzatuv maxfiyligi, mobil ilova yuz biometriyasi va PostgreSQL ma'lumotlar bazasi barqarorligi sezilarli darajada oshirildi.

---

### 📱 1. Telegram WebApp & Real-Vaqt Sinxronizatsiya
* **Jonli Keldi-Ketdi Sinxronizatsiyasi**: Mobil ilova yoki kameralardan qayd etilgan kirish (IN) va chiqish (OUT) vaqtlari Telegram WebApp'da 4-8 soniya ichida avtomatik yangilanadi.
* **To'liq Profil Sahifasi**: Telegram WebApp profil oynasida F.I.O, Personal ID, Lavozim, Bo'lim, Ish grafigi va Oylik maosh ko'rsatkichlari to'liq aks etadi.
* **Moslashuvchan Dizayn (Responsive Layout)**: Barcha kartalar va matnlar mobil ekranlarda sig'may qolishining (layout overflow) oldi olindi.

---

### 🗺️ 2. Xodimlarni Kuzatish (Tracking) & Maxfiylik Nazorati
* **2-Bosqichli Aqlli Xarita**: Xaritadagi xodimlarni birinchi marta bosganda avtomatik yaqinlashish (Zoom Level 17), ikkinchi marta bosganda batafsil ma'lumotlar kartasi ochilishi yo'lga qo'yildi.
* **Qo'ng'iroq Qilish Tugmasi**: Xodim kartasida uning telefon raqamiga zudlik bilan qo'ng'iroq qilish tugmasi (`Qo'ng'iroq qilish`) qo'shildi.
* **Ish Vaqti Maxfiylik Nazorati**: Xodimlar faqatgina o'zlarining belgilangan ish vaqtlarida xaritada ko'rinadi. Ish vaqtidan tashqari va dam olish kunlarida xodimlarning GPS joylashuvi avtomatik yashiriladi va serverda saqlanmaydi.

---

### ⚡ 3. Mobil Ilova & AI Biometriya Optimallashtirishi
* **Fast Image Processing**: Profil rasmi va biometriya yuklashda 20MB gacha bo'lgan yuqori sifatli fotosuratlar uchun EXIF auto-rotate va avtomatik 1280x1280 (JPEG) me'yoriga keltirish joriy etildi.
* **AI Speedup**: InsightFace AI yuz embeddingi bir necha millisoniyada tezkor hisoblanadi, Timeout va Future not completed xatoliklari bartaraf etildi.
* **Universal Device ID**: Play Store mobil ilovasi so'rovlarida qurilma ID-si bo'lmagan holatlarda avtomatik zaxira qurilma ID (`device_emp_{id}`) biriktiriladi.

---

### 🗄️ 4. Infratuzilma va PostgreSQL Baza Barqarorligi
* **PostgreSQL Production**: Ishlab chiqarish muhitida PostgreSQL bazasi qaytarildi va 20,381+ keldi-ketdi jurnallari hamda 725+ xodim ma'lumotlari barqaror saqlanishi ta'minlandi.
* **Auto-Schema Migration**: `devices.branch_id`, `employees.branch_id` va `users.is_staff` ustunlari avtomatik migratsiya qilindi.
"""

    existing = db.query(SystemVersion).filter(SystemVersion.version == version_num).first()
    if existing:
        existing.title = title
        existing.release_notes = release_notes
        existing.author = author
        existing.status = status
        existing.released_at = datetime.now()
        db.commit()
        print("✅ Version 2.0.0 updated in PostgreSQL successfully!")
    else:
        new_ver = SystemVersion(
            version=version_num,
            title=title,
            module=module,
            release_notes=release_notes,
            author=author,
            status=status,
            released_at=datetime.now()
        )
        db.add(new_ver)
        db.commit()
        print("✅ Version 2.0.0 created in PostgreSQL successfully!")
    db.close()

if __name__ == "__main__":
    seed_version()
