#!/usr/bin/env python3
"""Service faylni SFTP orqali to'g'ri yozish"""
import paramiko, time

HOST, PORT, USER, PASS = "94.141.85.147", 56522, "admin", "admin1231"
APP_DIR = "/home/admin/BioFace"
VENV = f"{APP_DIR}/venv"
SUDO = f"echo '{PASS}' | sudo -S"

def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30, banner_timeout=60)
    c.get_transport().set_keepalive(20)
    return c

def run(c, cmd, timeout=120):
    display = cmd.replace(PASS, "***")[:150]
    print(f"\033[36m$ {display}\033[0m")
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    stdout.channel.recv_exit_status()
    if out: print(out)
    if err and "password" not in err.lower(): print(f"\033[33m{err[:200]}\033[0m")
    return out

c = connect()
print("\033[32m[OK] SSH ulandi\033[0m")

# SFTP orqali service faylni to'g'ridan to'g'ri yubor
service_content = f"""[Unit]
Description=BioFace Production (gunicorn 17 workers)
After=network.target redis-server.service
Wants=redis-server.service

[Service]
Type=simple
User={USER}
Group={USER}
WorkingDirectory={APP_DIR}
Environment="PATH={VENV}/bin:/usr/local/bin:/usr/bin:/bin"
EnvironmentFile={APP_DIR}/.env
ExecStart={VENV}/bin/gunicorn main:app --config {APP_DIR}/gunicorn.conf.py
ExecReload=/bin/kill -s HUP $MAINPID
Restart=always
RestartSec=3
StartLimitBurst=5
StartLimitIntervalSec=60
LimitNOFILE=65536
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""

# Write via SFTP to /tmp
sftp = c.open_sftp()
with sftp.file("/tmp/bioface_prod.service", "w") as f:
    f.write(service_content)
sftp.close()
print("\033[32m[OK] Service fayl SFTP orqali yuborildi\033[0m")

run(c, f"{SUDO} cp /tmp/bioface_prod.service /etc/systemd/system/bioface.service 2>/dev/null && echo 'Copied OK'")
run(c, f"{SUDO} systemctl daemon-reload 2>/dev/null && echo 'Daemon reload OK'")
run(c, f"{SUDO} systemctl restart bioface 2>/dev/null && echo 'Restart OK'")

time.sleep(6)

print("\n\033[1mStatus:\033[0m")
run(c, f"{SUDO} systemctl status bioface 2>/dev/null | head -25")
run(c, "curl -s -m 5 -o /dev/null -w 'HTTP: %{http_code}' http://127.0.0.1:8000/login")
print("\n\033[1mWorker processlar:\033[0m")
run(c, "pgrep -a -f 'gunicorn' 2>/dev/null | head -5 || pgrep -a -f 'uvicorn' | head -5")

c.close()
