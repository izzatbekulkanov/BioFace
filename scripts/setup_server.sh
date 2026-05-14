#!/bin/bash
# BioFace server setup script.

set -e
CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
APP_DIR="${APP_DIR:-$HOME/BioFace}"
SERVICE_NAME="${SERVICE_NAME:-bioface}"

echo -e "${CYAN}BioFace server setup boshlanmoqda...${NC}"

echo -e "${CYAN}[1/6] Tizim paketlarini tekshirish/o'rnatish (tzdata, python3-venv)...${NC}"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -y
sudo apt-get install -y tzdata python3 python3-venv python3-pip curl ca-certificates

echo -e "${CYAN}[2/6] Python va pip tekshirish...${NC}"
python3 --version
pip3 --version

echo -e "${CYAN}[3/6] Virtual environment yaratish...${NC}"
cd "$APP_DIR"
python3 -m venv venv
source venv/bin/activate

echo -e "${CYAN}[4/6] pip paketlarni o'rnatish...${NC}"
pip install --upgrade pip
pip install -r requirements.txt

echo -e "${CYAN}[5/6] Tailwind CSS o'rnatish va build qilish...${NC}"
if ! command -v node &> /dev/null; then
    echo "Node.js topilmadi, o'rnatilmoqda..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v tailwindcss &> /dev/null; then
    curl -sLO https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64
    chmod +x tailwindcss-linux-x64
    sudo mv tailwindcss-linux-x64 /usr/local/bin/tailwindcss
fi

mkdir -p static/css
tailwindcss -i ./src/input.css -o ./static/css/output.css --minify
echo -e "${GREEN}CSS build muvaffaqiyatli.${NC}"

echo -e "${CYAN}[6/6] Systemd service yaratish...${NC}"
VENV_PATH="$APP_DIR/venv"

sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<EOF
[Unit]
Description=BioFace Davomat Tizimi
After=network.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${APP_DIR}
Environment="PATH=${VENV_PATH}/bin"
ExecStart=${VENV_PATH}/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}

sleep 2
STATUS=$(sudo systemctl is-active ${SERVICE_NAME})
if [ "$STATUS" = "active" ]; then
    HOST_IP=$(hostname -I | awk '{print $1}')
    echo -e "${GREEN}BioFace muvaffaqiyatli ishga tushdi.${NC}"
    echo -e "${GREEN}URL: http://${HOST_IP:-0.0.0.0}:8000${NC}"
else
    echo -e "${RED}Xato. Logni ko'rish: sudo journalctl -u ${SERVICE_NAME} -n 30${NC}"
fi
