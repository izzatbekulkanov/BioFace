# BioFace Setup Guide

## 1. Muhitni tayyorlash

```powershell
python -m venv .venv
.\.venv\Scripts\pip.exe install -r requirements.txt
Copy-Item .env.example .env
Copy-Item menu.example.json menu.json
```

## 2. Serverni ishga tushirish

```powershell
.\start.ps1
```

Yoki faqat web server uchun:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Brauzerda ochish:

```text
http://localhost:8000
```

## 3. iSUP haqida

iSUP faqat Hikvision kameralar bilan ishlash uchun kerak. Agar Hikvision kameralar ulanmagan bo'lsa, `.env` ichida quyidagicha qo'yish mumkin:

```env
ISUP_IMPLEMENTATION_MODE=disabled
```

Runtime loglar va PID fayllar `.runtime/` ichida saqlanadi. SQLite bazasi loyiha rootidagi `bioface.db` faylidan olinadi.
