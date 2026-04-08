@echo off
chcp 65001 >nul
cls

echo ╔════════════════════════════════════════════════════════════╗
echo ║                   BioFace Tizim Sozlash                   ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo [1/2] Superadmin yaratish...
echo.

.venv\Scripts\python.exe create_admin.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Xatolik yuz berdi!
    pause
    exit /b 1
)

echo.
echo ════════════════════════════════════════════════════════════
echo.
echo Tizimni ishga tushirish uchun quyidagini bajaring:
echo.
echo   .\start.ps1
echo.
echo Yoki brauzerda oching:
echo   http://localhost:8000
echo.
echo ════════════════════════════════════════════════════════════
echo.
pause
