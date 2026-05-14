#!/usr/bin/env pwsh
$ErrorActionPreference = "Continue"

$PROJECT_ROOT = (Resolve-Path "$PSScriptRoot\..").Path

Write-Host "Vite React Frontend ishga tushirilmoqda..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @("-NoExit", "-Command", "cd '$PROJECT_ROOT\frontend'; npm run dev")

cd "$PROJECT_ROOT\backend"
$PYTHON = ".\.venv\Scripts\python.exe"
$env:ISUP_IMPLEMENTATION_MODE = "hikvision_sdk"

Write-Host "ISUP Server (hikvision_sdk mode) ishga tushirilmoqda..." -ForegroundColor Yellow
& $PYTHON -m scripts.start_isup

Write-Host "FastAPI Uvicorn ishga tushirilmoqda..." -ForegroundColor Green
& $PYTHON -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-dir . --timeout-graceful-shutdown 3
