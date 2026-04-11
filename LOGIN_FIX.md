# Login muammosini tuzatish qo'llanmasi

## Muammo
Login sahifasida "Email yoki parol noto'g'ri" xatosi chiqmoqda.

## Yechim

### Usul 1: Avtomatik (tavsiya etiladi)

1. Uvicorn serverni to'xtating (Ctrl+C)
2. Quyidagini ishga tushiring:

```cmd
.venv\Scripts\python.exe setup_admin.py
```

3. Keyin serverni qayta ishga tushiring:

```cmd
.\start.ps1
```

### Usul 2: Qo'lda

1. Uvicorn serverni to'xtating (terminalda Ctrl+C bosing)

2. Admin yaratish scriptini ishga tushiring:

```cmd
.venv\Scripts\python.exe setup_admin.py
```

3. Natijani tekshiring - "Parol tekshiruvi: MUVAFFAQIYATLI ✅" ko'rinishi kerak

4. Serverni qayta ishga tushiring:

```cmd
.\start.ps1
```

5. Brauzerda oching:

```
http://localhost:8000/login
```

6. Login qiling:
   - Email: admin@gmail.com
   - Parol: admin123

## Tekshirish

Script quyidagilarni ko'rsatishi kerak:

```
Tekshirish:
  ✓ Email: admin@gmail.com
  ✓ Ismi: Super Admin
  ✓ Role: super_admin
  ✓ Hashed parol: $2b$12$...
  ✓ Parol tekshiruvi: MUVAFFAQIYATLI ✅
```

Agar "MUVAFFAQIYATLI ✅" ko'rinsa, login ishlaydi!
