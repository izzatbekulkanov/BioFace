#!/usr/bin/env pwsh
$ErrorActionPreference = "Continue"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "     BioFace Server ishga tushmoqda         " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Redis tekshirish ---
Write-Host "[1/3] Redis tekshirilmoqda..." -ForegroundColor Yellow
$redisPong = redis-cli ping 2>&1
if ($redisPong -match "PONG") {
    Write-Host "  [OK]  Redis ishlamoqda (127.0.0.1:6379)" -ForegroundColor Green
}
else {
    Write-Host "  [!!]  Redis ishlamayapti, ishga tushirilmoqda..." -ForegroundColor Yellow
    Start-Process "redis-server" -WindowStyle Hidden -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    $redisPong2 = redis-cli ping 2>&1
    if ($redisPong2 -match "PONG") {
        Write-Host "  [OK]  Redis ishga tushdi!" -ForegroundColor Green
    }
    else {
        Write-Host "  [ERR] Redis ishga tushmadi! redis-server ni qolda ishga tushiring." -ForegroundColor Red
    }
}

Write-Host ""

$PROJECT_ROOT = (Resolve-Path "$PSScriptRoot\..").Path
cd "$PROJECT_ROOT\backend"
$PYTHON = ".\.venv\Scripts\python.exe"
$env:PYTHONPATH = $PROJECT_ROOT

Write-Host "[2/3] ISUP Server ishga tushirilmoqda..." -ForegroundColor Yellow
& $PYTHON -m scripts.start_isup
Write-Host ""

# --- 3. FastAPI Web Server ---
Write-Host "[3/3] FastAPI Uvicorn ishga tushirilmoqda..." -ForegroundColor Green
Write-Host "      http://0.0.0.0:8000" -ForegroundColor Cyan
Write-Host "      http://localhost:8000" -ForegroundColor Cyan
Write-Host ""

& $PYTHON -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload --reload-dir . --timeout-graceful-shutdown 3
