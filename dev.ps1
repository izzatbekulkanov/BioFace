#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════
#  BioFace — Mahalliy ishga tushirish skripti
#  Uvicorn + ISUP (hikvision_sdk) + Tailwind
# ═══════════════════════════════════════════════════════

# Hikvision SDK mode — DS-K, DS-2DE kameralar uchun
$env:ISUP_IMPLEMENTATION_MODE = "hikvision_sdk"

Write-Host "🎨 Tailwind CSS watcher ishga tushirilmoqda..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit -Command `"tailwindcss -i ./src/input.css -o ./static/css/output.css --watch`""

Write-Host "📡 ISUP Server (hikvision_sdk mode) ishga tushirilmoqda..." -ForegroundColor Yellow
.\.venv\Scripts\python.exe -c "
from isup_manager import get_process_status, start_isup_server
s = get_process_status()
if s['running']:
    print('  ISUP server allaqachon ishlamoqda (PID:', s.get('pid', '?'), ')')
else:
    r = start_isup_server()
    if r['running']:
        print('  ISUP server ishga tushdi (PID:', r.get('pid', '?'), ')')
    else:
        print('  ISUP server ishga tushmadi!')
"

Write-Host "🚀 FastAPI Uvicorn ishga tushirilmoqda..." -ForegroundColor Green
.\.venv\Scripts\uvicorn.exe main:app --host 0.0.0.0 --port 8000 --reload
