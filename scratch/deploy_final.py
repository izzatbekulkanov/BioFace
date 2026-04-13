#!/usr/bin/env python3
"""
BioFace — Final Deploy: CSS build + nohup uvicorn
Tailwind binary SFTP orqali yuboriladi (curl o'rniga)
"""
import paramiko
import sys
import time
import os

HOST = "94.141.85.147"
PORT = 56522
USER = "admin"
PASS = "admin1231"
APP_DIR = "/home/admin/BioFace"
VENV = f"{APP_DIR}/venv"
SUDO = f"echo '{PASS}' | sudo -S"

def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, port=PORT, username=USER, password=PASS,
              timeout=30, banner_timeout=60, auth_timeout=30)
    c.get_transport().set_keepalive(20)
    return c

def run(client, cmd, timeout=300, show_cmd=True):
    display = cmd.replace(PASS, "***")[:150]
    if show_cmd:
        print(f"\n\033[36m$ {display}\033[0m")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    exit_code = stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err and "password" not in err.lower() and exit_code != 0:
        print(f"\033[33m{err[:500]}\033[0m")
    return exit_code, out, err

print("═" * 60)
print("  BioFace Final Deploy")
print(f"  Target: {USER}@{HOST}:{PORT}")
print("═" * 60)

c = connect()
print("\033[32m[OK] SSH ulandi\033[0m")

# ── 1. Tailwind binary SFTP orqali yuborish ──────────────
print("\n\033[1m[1/4] Tailwind binary SFTP yuklash...\033[0m")
TW_LOCAL = "/usr/local/bin/tailwindcss"
TW_REMOTE_TMP = "/tmp/tailwindcss_bin"

# Check if tailwindcss already on server
code, out, _ = run(c, "which tailwindcss 2>/dev/null || echo NOT_FOUND")
if "NOT_FOUND" in out or not out:
    # Check if we have tailwindcss locally on Mac
    if os.path.exists("/usr/local/bin/tailwindcss"):
        print("Tailwind Mac dan serverga SFTP yuborilmoqda...")
        sftp = c.open_sftp()
        sftp.put("/usr/local/bin/tailwindcss", TW_REMOTE_TMP)
        sftp.close()
        run(c, f"chmod +x {TW_REMOTE_TMP} && {SUDO} mv {TW_REMOTE_TMP} /usr/local/bin/tailwindcss 2>/dev/null")
        print("SFTP orqali Tailwind o'rnatildi.")
    else:
        # Download with shorter timeout per chunk — wget instead of curl
        print("Serverdagi wget bilan yuklanmoqda...")
        run(c, f"""
wget -q --timeout=60 --tries=3 \
  'https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64' \
  -O /tmp/tw_bin && chmod +x /tmp/tw_bin && {SUDO} mv /tmp/tw_bin /usr/local/bin/tailwindcss \
  && echo 'Tailwind ok' || echo 'Tailwind yuklash muvaffaqiyatsiz'
""", timeout=180)
else:
    print(f"Tailwind allaqachon mavjud: {out}")

# ── 2. CSS Build ─────────────────────────────────────────
print("\n\033[1m[2/4] Tailwind CSS build...\033[0m")
run(c, f"cd {APP_DIR} && mkdir -p static/css && /usr/local/bin/tailwindcss -i ./src/input.css -o ./static/css/output.css --minify 2>&1 | tail -3", timeout=120)
# Verify output.css exists and not empty
run(c, f"ls -lh {APP_DIR}/static/css/output.css 2>/dev/null || echo 'CSS fayl topilmadi!'")

# ── 3. systemd service yaratish ───────────────────────────
print("\n\033[1m[3/4] systemd service yaratish...\033[0m")

service = f"""[Unit]
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

# Write service to tmp file then sudo copy
run(c, f"printf '%s' '{service}' > /tmp/bioface.service")
run(c, f"{SUDO} cp /tmp/bioface.service /etc/systemd/system/bioface.service 2>/dev/null && echo 'Service fayl saqlandi'")
run(c, f"{SUDO} systemctl daemon-reload 2>/dev/null && echo 'daemon-reload OK'")
run(c, f"{SUDO} systemctl enable bioface 2>/dev/null && echo 'enable OK'")

# Kill existing uvicorn if running
run(c, f"pkill -f 'uvicorn main:app' 2>/dev/null || true")
time.sleep(2)
run(c, f"{SUDO} systemctl restart bioface 2>/dev/null && echo 'bioface restart OK'")

# ── 4. Final status ────────────────────────────────────────
print("\n\033[1m[4/4] Holat tekshiruvi...\033[0m")
time.sleep(5)

code, out, _ = run(c, f"{SUDO} systemctl is-active bioface 2>/dev/null", show_cmd=False)
status = out.strip()
color = "\033[32m" if status == "active" else "\033[31m"
print(f"  {color}● bioface: {status}\033[0m")

run(c, "redis-cli ping 2>/dev/null || echo 'Redis: Not running'")
run(c, "curl -s -m 5 -o /dev/null -w 'HTTP: %{http_code}' http://127.0.0.1:8000/login 2>/dev/null || echo 'Web: not up yet'")

# Last 20 journal logs
run(c, f"{SUDO} journalctl -u bioface -n 20 --no-pager 2>/dev/null | tail -20", timeout=30)

print("\n" + "═" * 60)
print(f"  \033[36mWeb URL :\033[0m http://94.141.85.147:8000")
print(f"  \033[36mLogin   :\033[0m admin@gmail.com / admin123")
print(f"  \033[36mRedis   :\033[0m 127.0.0.1:6379")
print("═" * 60)

c.close()
