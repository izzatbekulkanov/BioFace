@echo off
echo ================================================
echo   BioFace Tizim Sozlash
echo ================================================
echo.

echo [1/2] Setup script ishga tushirilmoqda...
.venv\Scripts\python.exe setup_admin.py

echo.
echo [2/2] Serverni ishga tushirish uchun ENTER bosing...
echo       (yoki Ctrl+C bilan chiqing)
pause >nul

echo.
echo Server ishga tushmoqda...
.\start.ps1
