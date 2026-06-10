#!/bin/bash
# BioFace service larni o'rnatish skripti
set -e

echo "======================================"
echo "  BioFace Services O'rnatish"
echo "======================================"

# Backend service
echo "[1/3] bioface-backend.service..."
cp /tmp/bioface-backend.service /etc/systemd/system/ 2>/dev/null || \
cat > /etc/systemd/system/bioface-backend.service << 'EOF'
[Unit]
Description=BioFace Backend (FastAPI + Uvicorn)
Documentation=https://bioface.uz
After=network-online.target redis.service
Wants=network-online.target
Requires=redis.service

[Service]
Type=simple
User=smartgate
Group=smartgate
WorkingDirectory=/home/smartgate/BioFace/backend
Environment="PATH=/home/smartgate/BioFace/backend/.venv/bin:/usr/local/bin:/usr/bin:/bin"
Environment="VIRTUAL_ENV=/home/smartgate/BioFace/backend/.venv"
EnvironmentFile=/home/smartgate/BioFace/backend/.env
ExecStart=/home/smartgate/BioFace/backend/.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8080 --proxy-headers --forwarded-allow-ips=* --workers 1 --log-level info
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30
Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=bioface-backend
PrivateTmp=true
ProtectSystem=full
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

# Tunnel service
echo "[2/3] bioface-tunnel.service..."
cat > /etc/systemd/system/bioface-tunnel.service << 'EOF'
[Unit]
Description=BioFace Cloudflare Tunnel (bioface.uz)
After=network-online.target bioface-backend.service
Wants=network-online.target
Requires=bioface-backend.service

[Service]
Type=simple
User=smartgate
Group=smartgate
ExecStart=/usr/local/bin/cloudflared tunnel --config /home/smartgate/.cloudflared/bioface-tunnel.yml run
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=bioface-tunnel
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

# ISUP service
echo "[3/3] bioface-isup.service..."
ISUP_KEY=$(grep "^ISUP_KEY=" /home/smartgate/BioFace/backend/.env | cut -d= -f2 | tr -d '"')
ISUP_PUBLIC_HOST=$(grep "^ISUP_PUBLIC_HOST=" /home/smartgate/BioFace/backend/.env | cut -d= -f2 | tr -d '"')
cat > /etc/systemd/system/bioface-isup.service << EOISUP
[Unit]
Description=BioFace ISUP SDK Server (Hikvision EHome/ISUP)
After=network-online.target redis.service bioface-backend.service
Wants=network-online.target
Requires=redis.service

[Service]
Type=simple
User=smartgate
Group=smartgate
WorkingDirectory=/home/smartgate/BioFace/backend
Environment="PATH=/home/smartgate/BioFace/backend/.venv/bin:/usr/local/bin:/usr/bin:/bin"
Environment="VIRTUAL_ENV=/home/smartgate/BioFace/backend/.venv"
Environment="LD_LIBRARY_PATH=/home/smartgate/BioFace/isup/hikvision_sdk_linux:/home/smartgate/BioFace/isup/hikvision_sdk_linux/HCAapSDKCom"
EnvironmentFile=/home/smartgate/BioFace/backend/.env
ExecStart=/home/smartgate/BioFace/backend/.venv/bin/python /home/smartgate/BioFace/isup/isup_sdk_server.py \${ISUP_KEY} 7660 7670 127.0.0.1 6379 7661 7662 --sdk-dir /home/smartgate/BioFace/isup/hikvision_sdk_linux --public-host \${ISUP_PUBLIC_HOST} --public-web-base-url https://bioface.uz --camera-event-push-base-url http://127.0.0.1:8080
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30
Restart=always
RestartSec=5
StartLimitIntervalSec=60
StartLimitBurst=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=bioface-isup
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOISUP

echo ""
echo "Systemd reload..."
systemctl daemon-reload

echo "Service larni yoqish..."
systemctl enable bioface-backend.service
systemctl enable bioface-tunnel.service
systemctl enable bioface-isup.service

echo ""
echo "Eski jarayonlarni to'xtatish..."
kill $(pgrep -f "uvicorn main:app") 2>/dev/null || true
kill $(pgrep -f "isup_sdk_server.py") 2>/dev/null || true
sleep 2

echo "Service larni ishga tushirish..."
systemctl start bioface-backend.service
sleep 3
systemctl start bioface-isup.service
sleep 3
systemctl start bioface-tunnel.service

echo ""
echo "======================================"
echo "  Holat tekshiruvi"
echo "======================================"
systemctl status bioface-backend --no-pager -l | head -15
echo "---"
systemctl status bioface-isup --no-pager -l | head -15
echo "---"
systemctl status bioface-tunnel --no-pager -l | head -15
echo ""
echo "Portlar:"
ss -tlnp | grep -E "7660|7661|7662|7670|8080" | head -10
