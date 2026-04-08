# BioFace Tizim Sozlash

Quyidagi buyruqlarni ketma-ket bajaring:

## 1. Setup scriptni ishga tushiring
```cmd
cd C:\Users\Izzatbek\Documents\FaceX
.venv\Scripts\python.exe setup_admin.py
```

Bu script:
- ✅ Barcha templatelarni yangi sintaksisga o'zgartiradi
- ✅ admin@gmail.com / admin123 bilan superadmin yaratadi
- ℹ️ ISUP holatini tekshiradi

## 2. Serverni ishga tushiring
```cmd
.\start.ps1
```

## 3. Brauzerda oching
```
http://localhost:8000
```

Login:
- Email: admin@gmail.com
- Parol: admin123

## ISUP haqida
ISUP server faqat Hikvision kameralar bilan ishlash uchun kerak.
Agar sizda Hikvision kameralar bo'lmasa, ISUP server ishlamasa ham
web tizim normal ishlaydi.

ISUP muammosini hal qilish uchun:
1. Hikvision SDK DLL fayllari `hikvision_sdk\` papkasida bo'lishi kerak
2. Yoki `.env` faylida `ISUP_IMPLEMENTATION_MODE=disabled` qilib qo'ying
