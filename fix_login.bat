@echo off
chcp 65001 >nul
cls

echo ╔════════════════════════════════════════════════════════════╗
echo ║              Admin Yaratish va Tizimni Boshlash           ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo Iltimos, uvicorn serverini to'xtating (Ctrl+C bosing)
echo.
echo Keyin davom etish uchun Enter bosing...
pause >nul

cls
echo.
echo [1/2] Admin yaratilmoqda...
echo.

.venv\Scripts\python.exe check_and_create_admin.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Admin yaratishda xatolik!
    pause
    exit /b 1
)

echo.
echo ════════════════════════════════════════════════════════════
echo.
echo [2/2] Serverni qayta ishga tushirish...
echo.
echo Quyidagi buyruqni bajaring:
echo.
echo   .\start.ps1
echo.
echo Keyin brauzerda oching:
echo   http://localhost:8000/login
echo.
echo Login:
echo   Email: admin@gmail.com
echo   Parol: admin123
echo.
echo ════════════════════════════════════════════════════════════
echo.
pause
