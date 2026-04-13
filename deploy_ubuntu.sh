#!/bin/bash
# ─────────────────────────────────────────────────────────
# BioFace Ubuntu Server — To'liq Deploy Skripti
# Ishlatish: bash deploy_ubuntu.sh
# Xizmatlar: bioface (web), bioface-isup, redis-server
# ─────────────────────────────────────────────────────────
set -e
CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

APP_DIR="$HOME/BioFace"
VENV="$APP_DIR/venv"
LOG() { echo -e "${CYAN}[BioFace]${NC} $1"; }
OK()  { echo -e "${GREEN}[OK]${NC}  $1"; }
WARN(){ echo -e "${YELLOW}[WARN]${NC} $1"; }
ERR() { echo -e "${RED}[ERR]${NC}  $1"; }

cd "$APP_DIR" || { ERR "BioFace papkasi topilmadi: $APP_DIR"; exit 1; }
LOG "BioFace to'liq deploy boshlandi. Papka: $APP_DIR"

# ── 1. Tizim paketlari ──────────────────────────────────
LOG "[1/7] Tizim paketlarini yangilash..."
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -yq
sudo apt-get install -yq \
    python3 python3-venv python3-pip \
    redis-server curl git tzdata \
    build-essential libssl-dev libffi-dev \
    ca-certificates 2>&1 | tail -5
OK "Tizim paketlari tayyor."

# ── 2. Redis ishga tushirish ─────────────────────────────
LOG "[2/7] Redis sozlash va ishga tushirish..."
sudo systemctl enable redis-server --now
sleep 1
if redis-cli ping | grep -q PONG; then
    OK "Redis ishlayapti (PONG)."
else
    WARN "Redis javob bermadi, manul start..."
    sudo systemctl start redis-server
fi

# ── 3. Python venv ───────────────────────────────────────
LOG "[3/7] Python virtual environment..."
python3 -m venv "$VENV"
source "$VENV/bin/activate"
pip install --upgrade pip -q
pip install -r requirements.txt -q
OK "Python kutubxonalari o'rnatildi."

# ── 4. Tailwind CSS build ────────────────────────────────
LOG "[4/7] Tailwind CSS standalone binary..."
if ! command -v tailwindcss &>/dev/null; then
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        TW_URL="https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64"
    elif [ "$ARCH" = "aarch64" ]; then
        TW_URL="https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-arm64"
    fi
    curl -sL "$TW_URL" -o /tmp/tailwindcss
    chmod +x /tmp/tailwindcss
    sudo mv /tmp/tailwindcss /usr/local/bin/tailwindcss
    OK "Tailwind o'rnatildi: $(tailwindcss --version 2>/dev/null || echo 'ok')"
fi

mkdir -p static/css
LOG "Tailwind CSS build qilinmoqda..."
tailwindcss -i ./src/input.css -o ./static/css/output.css --minify 2>&1 | tail -3
OK "CSS build muvaffaqiyatli."

# ── 5. .env tekshirish ───────────────────────────────────
LOG "[5/7] .env fayli tekshirilmoqda..."
if [ ! -f .env ]; then
    WARN ".env topilmadi, standart .env yaratilmoqda..."
    cat > .env << 'ENVEOF'
SESSION_SECRET=super-secret-change-me-fast-2026
BIOFACE_HOST=0.0.0.0
BIOFACE_PORT=8000

AUTO_CREATE_DEFAULT_ADMIN=true
DEFAULT_ADMIN_NAME=System Admin
DEFAULT_ADMIN_EMAIL=admin@gmail.com
DEFAULT_ADMIN_PASSWORD=admin123

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

ISUP_IMPLEMENTATION_MODE=disabled
ISUP_KEY=facex2024
ISUP_REGISTER_PORT=7660
ISUP_ALARM_PORT=7661
ISUP_PICTURE_PORT=7662
ISUP_API_PORT=7670
ISUP_PUBLIC_HOST=94.141.85.147
PUBLIC_WEB_BASE_URL=http://94.141.85.147:8000
ENVEOF
    OK ".env yaratildi."
else
    OK ".env mavjud."
    # PUBLIC_WEB_BASE_URL ni server IP ga yangilaymiz agar localhost bo'lsa
    sed -i 's|PUBLIC_WEB_BASE_URL=https://bioface.uz|PUBLIC_WEB_BASE_URL=http://94.141.85.147:8000|g' .env || true
fi

# ── 6. Admin setup ───────────────────────────────────────
LOG "[6/7] Admin foydalanuvchi yaratish..."
source "$VENV/bin/activate"
if python3 setup_admin.py 2>&1 | tail -3; then
    OK "Admin setup muvaffaqiyatli."
else
    WARN "setup_admin.py ishlamadi (ehtimol allaqachon sozlangan)."
fi

# ── 7. Systemd xizmatlar ──────────────────────────────────
LOG "[7/7] Systemd xizmatlar (bioface + bioface-isup) yaratilmoqda..."

# ── bioface.service ──
sudo tee /etc/systemd/system/bioface.service > /dev/null << EOF
[Unit]
Description=BioFace Davomat Tizimi (Web)
After=network.target redis-server.service

[Service]
Type=simple
User=${USER}
WorkingDirectory=${APP_DIR}
Environment="PATH=${VENV}/bin:/usr/local/bin:/usr/bin:/bin"
EnvironmentFile=${APP_DIR}/.env
ExecStart=${VENV}/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# ── bioface-isup.service ──
# ISUP mode ni .env dan o'qib enable/disable qilamiz
ISUP_MODE=$(grep -oP '(?<=ISUP_IMPLEMENTATION_MODE=)\S+' .env 2>/dev/null || echo "disabled")

if [ "$ISUP_MODE" = "disabled" ]; then
    WARN "ISUP_IMPLEMENTATION_MODE=disabled — ISUP service o'rnatilmaydi."
else
    sudo tee /etc/systemd/system/bioface-isup.service > /dev/null << EOF
[Unit]
Description=BioFace ISUP SDK Server (Hikvision)
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${APP_DIR}
Environment="PATH=${VENV}/bin:/usr/local/bin:/usr/bin:/bin"
EnvironmentFile=${APP_DIR}/.env
ExecStart=${VENV}/bin/python isup_sdk_server.py \
    --api-port 7670 \
    --register-port 7660 \
    --alarm-port 7661 \
    --picture-port 7662
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    sudo systemctl enable bioface-isup --now 2>&1 || true
    OK "bioface-isup service faollashtirildi."
fi

# ── Reload va restart ──
sudo systemctl daemon-reload
sudo systemctl enable bioface
sudo systemctl restart bioface

# ── Status tekshirish ──
sleep 3
echo ""
echo "═══════════════════════════════════════════════════"
echo -e "${GREEN}          BioFace Deploy Natijasi${NC}"
echo "═══════════════════════════════════════════════════"

check_service() {
    STATUS=$(sudo systemctl is-active "$1" 2>/dev/null)
    if [ "$STATUS" = "active" ]; then
        echo -e "  ${GREEN}●${NC} $1: ${GREEN}active (running)${NC}"
    else
        echo -e "  ${RED}●${NC} $1: ${RED}$STATUS${NC}"
        sudo journalctl -u "$1" -n 5 --no-pager 2>/dev/null || true
    fi
}

check_service bioface
check_service redis-server
[ "$ISUP_MODE" != "disabled" ] && check_service bioface-isup

HOST_IP=$(hostname -I | awk '{print $1}')
echo "═══════════════════════════════════════════════════"
echo -e "  ${CYAN}Web URL  :${NC} http://${HOST_IP}:8000"
echo -e "  ${CYAN}Login    :${NC} admin@gmail.com / admin123"
echo -e "  ${CYAN}Redis    :${NC} 127.0.0.1:6379"
echo "═══════════════════════════════════════════════════"
