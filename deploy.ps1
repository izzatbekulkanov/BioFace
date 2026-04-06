#!/usr/bin/env pwsh

param(
    [string]$Server = $env:BIOFACE_DEPLOY_SERVER,
    [string]$Dest = $env:BIOFACE_DEPLOY_DEST,
    [string]$AppDir = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

if (-not $Server -or -not $Dest) {
    throw "Deploy uchun -Server va -Dest qiymatlarini bering yoki BIOFACE_DEPLOY_SERVER / BIOFACE_DEPLOY_DEST env o'rnating."
}

Write-Host "BioFace fayllari deploy qilinmoqda..." -ForegroundColor Cyan

$rsyncArgs = @(
    "-avz",
    "--exclude", "__pycache__",
    "--exclude", "*.pyc",
    "--exclude", ".venv",
    "--exclude", ".git",
    "--exclude", ".runtime",
    "--exclude", "bioface.db",
    "--exclude", "menu.json",
    "--exclude", "cookies.txt",
    "--exclude", "static/uploads",
    "--exclude", "isup_server/build",
    "$AppDir/",
    "${Server}:${Dest}/"
)

try {
    & rsync @rsyncArgs
    Write-Host "Fayllar rsync orqali ko'chirildi." -ForegroundColor Green
} catch {
    Write-Host "rsync topilmadi, scp fallback ishlatiladi..." -ForegroundColor Yellow
    scp -r "$AppDir" "${Server}:${Dest}"
}

Write-Host "Server setup ishga tushirilmoqda..." -ForegroundColor Cyan
ssh $Server "cd $Dest && bash setup_server.sh"

Write-Host ""
Write-Host "Deploy yakunlandi." -ForegroundColor Green
Write-Host "Server: $Server" -ForegroundColor Green
Write-Host "Path:   $Dest" -ForegroundColor Green
