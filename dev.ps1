#!/usr/bin/env pwsh
# BioFace local development launcher
# Starts Tailwind watcher, ISUP helper, and FastAPI.

$ErrorActionPreference = "Continue"
$PYTHON = ".\.venv\Scripts\python.exe"

# Hikvision SDK mode for DS-K / DS-2DE devices
$env:ISUP_IMPLEMENTATION_MODE = "hikvision_sdk"

Write-Host "Tailwind CSS watcher ishga tushirilmoqda..." -ForegroundColor Cyan
if (Get-Command tailwindcss -ErrorAction SilentlyContinue) {
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "tailwindcss -i ./src/input.css -o ./static/css/output.css --watch"
    )
} else {
    Write-Host "  [WARN] tailwindcss topilmadi, watcher o'tkazib yuborildi." -ForegroundColor Yellow
}

Write-Host "ISUP Server (hikvision_sdk mode) ishga tushirilmoqda..." -ForegroundColor Yellow
& $PYTHON "_start_isup.py"

Write-Host "FastAPI Uvicorn ishga tushirilmoqda..." -ForegroundColor Green
& $PYTHON -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-dir . --timeout-graceful-shutdown 3
