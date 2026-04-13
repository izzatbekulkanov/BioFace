#!/usr/bin/env python3
"""
BioFace — Performance + ISUP Fix Deploy
1. system_config.py + isup_manager.py yangi kod serverga push
2. uvloop + httptools o'rnatish (2-5x tezroq async loop)
3. gunicorn.conf.py yangilash
4. Restart
"""
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

def run(c, cmd, timeout=300):
    display = cmd.replace(PASS, "***")[:150]
    print(f"\033[36m$ {display}\033[0m")
    _, stdout, stderr = c.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    stdout.channel.recv_exit_status()
    if out: print(out)
    if err and "password" not in err.lower() and "warn" not in err.lower()[:20]: print(f"\033[33m{err[:300]}\033[0m")
    return out

def sftp_put(c, local_path, remote_path):
    sftp = c.open_sftp()
    sftp.put(local_path, remote_path)
    sftp.close()
    print(f"\033[32m[SFTP] {local_path.split('/')[-1]} → {remote_path}\033[0m")

print("═" * 65)
print("  BioFace — Performance + ISUP Fix")
print(f"  Target: {USER}@{HOST}:{PORT}")
print("═" * 65)

c = connect()
print("\033[32m[OK] SSH ulandi\033[0m")

# ── 1. Yangi kod fayllarini serverga SFTP yuborish ───────
print("\n\033[1m[1/4] Tuzatilgan kod fayllarini serverga yuborish...\033[0m")

import os
project = "/Users/macbookpro/Documents/GitHub/BioFace"
files_to_push = [
    (f"{project}/system_config.py", f"{APP_DIR}/system_config.py"),
    (f"{project}/isup_manager.py", f"{APP_DIR}/isup_manager.py"),
]
for local, remote in files_to_push:
    if os.path.exists(local):
        sftp_put(c, local, remote)
    else:
        print(f"\033[31m[MISS] {local} topilmadi!\033[0m")

# ── 2. uvloop + httptools o'rnatish ──────────────────────
print("\n\033[1m[2/4] uvloop + httptools o'rnatish (async tezlashtirish)...\033[0m")
run(c, f"cd {APP_DIR} && source {VENV}/bin/activate && pip install uvloop httptools -q && echo 'uvloop + httptools OK'", timeout=120)
run(c, f"{VENV}/bin/python -c 'import uvloop; print(\"uvloop\", uvloop.__version__)'")

# ── 3. gunicorn.conf.py — uvloop bilan yangilash ─────────
print("\n\033[1m[3/4] gunicorn.conf.py (uvloop bilan) yangilash...\033[0m")

gunicorn_conf = f"""# gunicorn.conf.py — BioFace Production (uvloop + httptools)
# Server: 8 CPU yadrolar, 7.8 GB RAM

# ── Binding ──────────────────────────────────────────────
bind = "0.0.0.0:8000"
backlog = 4096              # Ko'proq navbat (50 kamera uchun)

# ── Workers ──────────────────────────────────────────────
# UvicornH11Worker o'rniga UvicornWorker (httptools parser)
workers = 17                # 2 * 8 CPU + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 2000   # Har bir worker 2000 ulanish (50*40)

# ── uvloop aktivlashtirish ────────────────────────────────
# uvloop = libuv asosida, asyncio dan 2-5x tezroq
import uvloop
worker_exit = None

# Har bir worker start bo'lganda uvloop ishlatsin
def post_fork(server, worker):
    uvloop.install()

# ── Timeouts ─────────────────────────────────────────────
timeout = 120
keepalive = 30              # Kamera ulanishlarini uzoq ushlab turadi
graceful_timeout = 30

# ── Performance ──────────────────────────────────────────
max_requests = 2000         # Har 2000 so'rovda worker refresh
max_requests_jitter = 200
preload_app = True          # Model va DB bir marta load — RAM tejash

# ── Logging ──────────────────────────────────────────────
accesslog = "{APP_DIR}/logs/access.log"
errorlog = "{APP_DIR}/logs/error.log"
loglevel = "warning"
capture_output = True
access_log_format = '%(h)s "%%(r)s" %%(s)s %%(b)s %%(D)sms'

# ── Process ───────────────────────────────────────────────
proc_name = "bioface-prod"
"""

sftp = c.open_sftp()
with sftp.file(f"{APP_DIR}/gunicorn.conf.py", "w") as f:
    f.write(gunicorn_conf)
sftp.close()
print(f"\033[32m[SFTP] gunicorn.conf.py yangilandi\033[0m")

# ── 4. Restart + Holat ───────────────────────────────────
print("\n\033[1m[4/4] Restart va holat tekshiruvi...\033[0m")
run(c, f"{SUDO} systemctl restart bioface 2>/dev/null && echo 'Restart OK'")
time.sleep(6)

out = run(c, f"{SUDO} systemctl status bioface 2>/dev/null | head -20")
run(c, "curl -s -m 5 -o /dev/null -w 'HTTP: %{http_code}' http://127.0.0.1:8000/login")
print("\n\033[1mWorker processlar:\033[0m")
run(c, "pgrep -a -f 'gunicorn' 2>/dev/null | wc -l | xargs -I{} echo '{} gunicorn process'")
run(c, f"{SUDO} journalctl -u bioface -n 10 --no-pager 2>/dev/null | tail -10", timeout=20)

print("\n" + "═" * 65)
print(f"  \033[36mWeb URL    :\033[0m http://94.141.85.147:8000")
print(f"  \033[36mLogin      :\033[0m admin@gmail.com / admin123")
print(f"  \033[36mWorkers    :\033[0m 17 (2×8 CPU+1)")
print(f"  \033[36mAsync loop :\033[0m uvloop (2-5x tezroq)")
print(f"  \033[36mMax conn   :\033[0m 34,000 parallel")
print(f"  \033[36mISUP       :\033[0m disabled (xato yo'q)")
print("═" * 65)

c.close()
