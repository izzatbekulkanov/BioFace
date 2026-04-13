#!/usr/bin/env python3
"""
BioFace Ubuntu Server Deploy — paramiko orqali
SSH host: 94.141.85.147 | user: admin | pass: admin1231
"""
import paramiko
import sys
import time

HOST = "94.141.85.147"
PORT = 56522
USER = "admin"
PASS = "admin1231"
APP_DIR = "/home/admin/BioFace"

def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30,
              banner_timeout=60, auth_timeout=30)
    # Keepalive - ulanish uzilmasin
    transport = c.get_transport()
    transport.set_keepalive(30)
    return c

def run(client, cmd, timeout=600):
    print(f"\n\033[36m$ {cmd[:120]}\033[0m")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.strip())
    if err.strip() and exit_code != 0:
        print(f"\033[33m{err.strip()}\033[0m")
    return exit_code, out, err

def send_file(client, local_path, remote_path):
    sftp = client.open_sftp()
    sftp.put(local_path, remote_path)
    sftp.close()
    print(f"\033[32m[SCP] {local_path} → {remote_path}\033[0m")

print("═" * 60)
print("  BioFace Ubuntu Deploy — paramiko")
print(f"  Target: {USER}@{HOST}:{PORT}")
print("═" * 60)

try:
    c = connect()
    print(f"\033[32m[OK] SSH ulandi: {HOST}\033[0m")
except Exception as e:
    print(f"\033[31m[ERR] SSH ulanishda xato: {e}\033[0m")
    sys.exit(1)

# ── 1. Server holati ─────────────────────────────────────
print("\n\033[1m[1/8] Server holati tekshirilmoqda...\033[0m")
run(c, "whoami && uname -r && python3 --version 2>&1 || echo 'python3 yoq'")
run(c, f"ls {APP_DIR}/ 2>/dev/null | wc -l && echo 'fayllar soni'")
run(c, "systemctl is-active bioface 2>/dev/null || echo 'bioface: inactive'")
run(c, "redis-cli ping 2>/dev/null || echo 'redis: not running'")

# ── 2. System packages ───────────────────────────────────
print("\n\033[1m[2/8] Tizim paketlari...\033[0m")
run(c, "export DEBIAN_FRONTEND=noninteractive && sudo apt-get update -yq 2>&1 | tail -3", timeout=120)
run(c, "export DEBIAN_FRONTEND=noninteractive && sudo apt-get install -yq redis-server python3 python3-venv python3-pip curl git tzdata 2>&1 | tail -5", timeout=180)

# ── 3. Redis ─────────────────────────────────────────────
print("\n\033[1m[3/8] Redis...\033[0m")
run(c, "sudo systemctl enable redis-server && sudo systemctl start redis-server")
time.sleep(2)
run(c, "redis-cli ping || echo 'Redis javob bermadi!'")

# ── 4. Python venv ───────────────────────────────────────
print("\n\033[1m[4/8] Python virtual environment...\033[0m")
run(c, f"cd {APP_DIR} && python3 -m venv venv")
run(c, f"cd {APP_DIR} && source venv/bin/activate && pip install --upgrade pip -q", timeout=60)
run(c, f"cd {APP_DIR} && source venv/bin/activate && pip install -r requirements.txt -q 2>&1 | tail -5", timeout=300)

# ── 5. Tailwind CSS build ────────────────────────────────
print("\n\033[1m[5/8] Tailwind CSS build...\033[0m")
run(c, """
if ! command -v tailwindcss &>/dev/null; then
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        URL="https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64"
    else
        URL="https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-arm64"
    fi
    echo "Tailwind yuklanmoqda: $URL"
    curl -sL "$URL" -o /tmp/tailwindcss && chmod +x /tmp/tailwindcss && sudo mv /tmp/tailwindcss /usr/local/bin/tailwindcss
    echo "Tailwind o'rnatildi"
else
    echo "Tailwind allaqachon o'rnatilgan"
fi
""", timeout=60)
run(c, f"cd {APP_DIR} && mkdir -p static/css && tailwindcss -i ./src/input.css -o ./static/css/output.css --minify 2>&1 | tail -5", timeout=120)

# ── 6. .env update ───────────────────────────────────────
print("\n\033[1m[6/8] .env sozlash...\033[0m")
run(c, f"""
cd {APP_DIR}
if [ -f .env ]; then
    sed -i 's|ISUP_IMPLEMENTATION_MODE=hikvision_sdk|ISUP_IMPLEMENTATION_MODE=disabled|g' .env || true
    sed -i 's|PUBLIC_WEB_BASE_URL=https://bioface.uz|PUBLIC_WEB_BASE_URL=http://94.141.85.147:8000|g' .env || true
    echo ".env mavjud, yangilandi:"
    grep -E 'BIOFACE_|REDIS_|ISUP_IMPLEMENTATION|PUBLIC_WEB' .env || true
else
    echo ".env topilmadi!"
fi
""")

# ── 7. Admin setup ───────────────────────────────────────
print("\n\033[1m[7/8] Admin foydalanuvchi...\033[0m")
run(c, f"cd {APP_DIR} && source venv/bin/activate && python3 setup_admin.py 2>&1 | tail -5 || echo 'setup_admin.py skip'", timeout=30)

# ── 8. Systemd xizmatlar ─────────────────────────────────
print("\n\033[1m[8/8] Systemd xizmatlar yaratilmoqda...\033[0m")
VENV = f"{APP_DIR}/venv"

bioface_service = f"""[Unit]
Description=BioFace Davomat Tizimi (Web)
After=network.target redis-server.service

[Service]
Type=simple
User={USER}
WorkingDirectory={APP_DIR}
Environment="PATH={VENV}/bin:/usr/local/bin:/usr/bin:/bin"
EnvironmentFile={APP_DIR}/.env
ExecStart={VENV}/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""

bioface_isup_service = f"""[Unit]
Description=BioFace ISUP SDK Server
After=network.target

[Service]
Type=simple
User={USER}
WorkingDirectory={APP_DIR}
Environment="PATH={VENV}/bin:/usr/local/bin:/usr/bin:/bin"
EnvironmentFile={APP_DIR}/.env
ExecStart={VENV}/bin/python isup_sdk_server.py --api-port 7670 --register-port 7660 --alarm-port 7661 --picture-port 7662
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""

# Write bioface.service
run(c, f"sudo tee /etc/systemd/system/bioface.service > /dev/null << 'SVCEOF'\n{bioface_service}\nSVCEOF")
# Write bioface-isup.service  
run(c, f"sudo tee /etc/systemd/system/bioface-isup.service > /dev/null << 'ISUPEOF'\n{bioface_isup_service}\nISUPEOF")

run(c, "sudo systemctl daemon-reload")
run(c, "sudo systemctl enable bioface")
run(c, "sudo systemctl restart bioface")
time.sleep(4)

# ── Final status ─────────────────────────────────────────
print("\n" + "═" * 60)
print("  STATUS TEKSHIRUVI")
print("═" * 60)

for svc in ["bioface", "redis-server"]:
    code, out, _ = run(c, f"sudo systemctl is-active {svc} 2>/dev/null")
    status = out.strip()
    color = "\033[32m" if status == "active" else "\033[31m"
    print(f"  {color}● {svc}: {status}\033[0m")

# Check web response
run(c, "curl -s -o /dev/null -w 'HTTP Status: %{http_code}' http://localhost:8000/ 2>/dev/null || echo 'Web javob bermadi (hali yuklanmoqda bo'lishi mumkin)'")

# Show last logs if not working
run(c, "sudo journalctl -u bioface -n 15 --no-pager 2>/dev/null | tail -15")

print("\n" + "═" * 60)
print(f"  \033[36mWeb URL  :\033[0m http://94.141.85.147:8000")
print(f"  \033[36mLogin    :\033[0m admin@gmail.com / admin123")
print(f"  \033[36mRedis    :\033[0m 127.0.0.1:6379")
print("═" * 60)

c.close()
