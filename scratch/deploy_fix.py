#!/usr/bin/env python3
"""
BioFace Ubuntu Server — sudo -S bilan to'liq deploy
"""
import paramiko
import sys
import time

HOST = "94.141.85.147"
PORT = 56522
USER = "admin"
PASS = "admin1231"
APP_DIR = "/home/admin/BioFace"
VENV = f"{APP_DIR}/venv"
# sudo -S parol prefix - stdin orqali parol yuborish
SUDO = f"echo '{PASS}' | sudo -S"

def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, port=PORT, username=USER, password=PASS,
              timeout=30, banner_timeout=60, auth_timeout=30)
    c.get_transport().set_keepalive(30)
    return c

def run(client, cmd, timeout=600, show_cmd=True):
    display = cmd.replace(PASS, "***")
    if show_cmd:
        print(f"\n\033[36m$ {display[:150]}\033[0m")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    exit_code = stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err and "password" not in err.lower() and exit_code != 0:
        print(f"\033[33m{err}\033[0m")
    return exit_code, out, err

print("═" * 60)
print("  BioFace Fix Deploy — sudo -S")
print(f"  Target: {USER}@{HOST}:{PORT}")
print("═" * 60)

try:
    c = connect()
    print(f"\033[32m[OK] SSH ulandi\033[0m")
except Exception as e:
    print(f"\033[31m[ERR] {e}\033[0m")
    sys.exit(1)

# ── 1. sudo imtiyozlarini tekshirish ────────────────────
print("\n\033[1m[1/5] sudo tekshirish...\033[0m")
run(c, f"echo '{PASS}' | sudo -S whoami 2>/dev/null")

# ── 2. Tailwind binary — to'g'ri joylashtirish ──────────
print("\n\033[1m[2/5] Tailwind CSS binary...\033[0m")
run(c, f"""
if ! command -v tailwindcss &>/dev/null; then
    echo "Tailwind yuklanmoqda..."
    curl -sL https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64 -o /tmp/tw
    chmod +x /tmp/tw
    echo '{PASS}' | sudo -S mv /tmp/tw /usr/local/bin/tailwindcss
    echo "Tailwind o'rnatildi: $(tailwindcss --version 2>/dev/null || echo ok)"
else
    echo "Tailwind allaqachon mavjud: $(tailwindcss --version 2>/dev/null || echo ok)"
fi
""", timeout=120)

# ── 3. Tailwind CSS build ─────────────────────────────────
print("\n\033[1m[3/5] CSS build...\033[0m")
run(c, f"cd {APP_DIR} && mkdir -p static/css && /usr/local/bin/tailwindcss -i ./src/input.css -o ./static/css/output.css --minify 2>&1 | tail -5", timeout=120)

# ── 4. Systemd service yaratish ───────────────────────────
print("\n\033[1m[4/5] bioface.service yaratish...\033[0m")

# Service faylni yozish — user home da, keyin sudo bilan ko'chirish
service_content = f"""[Unit]
Description=BioFace Davomat Tizimi
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

# Write to tmp, then sudo mv
run(c, f"cat > /tmp/bioface.service << 'SVCEOF'\n{service_content}\nSVCEOF")
run(c, f"echo '{PASS}' | sudo -S cp /tmp/bioface.service /etc/systemd/system/bioface.service 2>/dev/null")
run(c, f"echo '{PASS}' | sudo -S systemctl daemon-reload 2>/dev/null")
run(c, f"echo '{PASS}' | sudo -S systemctl enable bioface 2>/dev/null")
run(c, f"echo '{PASS}' | sudo -S systemctl restart bioface 2>/dev/null")

time.sleep(4)

# ── 5. Final status ────────────────────────────────────────
print("\n\033[1m[5/5] Holat tekshiruvi...\033[0m")
time.sleep(3)

code, out, _ = run(c, f"echo '{PASS}' | sudo -S systemctl is-active bioface 2>/dev/null || echo inactive",
                   show_cmd=False)
status = out.strip()
color = "\033[32m" if status == "active" else "\033[31m"
print(f"  {color}● bioface: {status}\033[0m")

run(c, "redis-cli ping 2>/dev/null && echo 'Redis: OK' || echo 'Redis: DOWN'")

# Web test
run(c, "curl -s -o /dev/null -w 'HTTP Status: %{http_code}' http://localhost:8000/login 2>/dev/null || echo 'Web: not responding yet'")

# Son loglar
run(c, f"echo '{PASS}' | sudo -S journalctl -u bioface -n 20 --no-pager 2>/dev/null | tail -20", timeout=30)

print("\n" + "═" * 60)
print(f"  \033[36mWeb URL :\033[0m http://94.141.85.147:8000")
print(f"  \033[36mLogin   :\033[0m admin@gmail.com / admin123")
print(f"  \033[36mRedis   :\033[0m 127.0.0.1:6379 ✅")
print("═" * 60)

c.close()
