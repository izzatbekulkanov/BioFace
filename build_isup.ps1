# Auto-build script for ISUP Server
$ErrorActionPreference = "Stop"

Write-Host "Checking for CMake..." -ForegroundColor Cyan
if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
    Write-Host "CMake topilmadi, o'rnatilmoqda..." -ForegroundColor Yellow
    winget install --id Kitware.CMake -e --silent --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}
else {
    Write-Host "CMake mavjud." -ForegroundColor Green
}

Write-Host "Checking for MinGW (g++)..." -ForegroundColor Cyan
if (-not (Get-Command g++ -ErrorAction SilentlyContinue)) {
    Write-Host "MinGW topilmadi. Kutubxonalarni yuklab olyapman..." -ForegroundColor Yellow
    # W64 devkit ishlatamiz (standart MinGW-w64)
    $zipPath = "$env:TEMP\mingw64.zip"
    $extractPath = "C:\mingw64"
    if (-not (Test-Path $extractPath)) {
        Write-Host "Yuklab olinmoqda (bu biroz vaqt olishi mumkin)..."
        Invoke-WebRequest -Uri "https://github.com/niXman/mingw-builds-binaries/releases/download/13.2.0-rt_v11-rev0/x86_64-13.2.0-release-posix-seh-ucrt-rt_v11-rev0.7z" -OutFile "$env:TEMP\mingw.7z"
        
        # 7z yo'q bo'lsa uni ham o'rnatamiz
        if (-not (Get-Command 7z -ErrorAction SilentlyContinue)) {
            winget install --id 7zip.7zip -e --silent --accept-package-agreements --accept-source-agreements
            $env:Path += ";C:\Program Files\7-Zip"
        }
        
        Write-Host "Extracting MinGW..."
        & 7z x "$env:TEMP\mingw.7z" -o"C:\" -y | Out-Null
    }
    
    # Pathga qo'shish (joriy sessiya uchun)
    $env:Path += ";C:\mingw64\bin"
    
    # Pathga doimiy qo'shish
    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($userPath -notmatch "C:\\mingw64\\bin") {
        [Environment]::SetEnvironmentVariable("PATH", "$userPath;C:\mingw64\bin", "User")
    }
}
else {
    Write-Host "MinGW (g++) mavjud." -ForegroundColor Green
}

Write-Host "`nBuilding ISUP Server..." -ForegroundColor Cyan
Set-Location (Join-Path $PSScriptRoot "isup_server")
if (-not (Test-Path "build")) {
    New-Item -ItemType Directory -Force -Path "build" | Out-Null
}
Set-Location "build"

Write-Host "Running CMake..."
cmake .. -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release

Write-Host "Compiling..."
mingw32-make -j4

if (Test-Path "isup_server.exe") {
    Write-Host "`nMuvaffaqiyatli build qilindi! (isup_server.exe)" -ForegroundColor Green
}
else {
    Write-Host "`nBuild qilishda xatolik yuz berdi." -ForegroundColor Red
}
