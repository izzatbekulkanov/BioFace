#!/usr/bin/env python3
"""
BioFace — Production Performance Config
gunicorn + uvicorn workers, CPU to'liq ishlatish
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
SUDO = f"echo '{PASS}' | sudo -S"

def connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, port=PORT, username=USER, password=PASS,
              timeout=30, banner_timeout=60)
    c.get_transport().set_keepalive(20)
    return c

def run(client, cmd, timeout=300, show_cmd=True):
    display = cmd.replace(PASS, "***")[:150]
    if show_cmd:
        print(f"\n\033[36m$ {display}\033[0m")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err and "password" not in err.lower():
        print(f"\033[33m{err[:300]}\033[0m")
    return out

print("═" * 65)
print("  BioFace — Production Performance Setup")
print(f"  Target: {USER}@{HOST}:{PORT}")
print("═" * 65)

c = connect()
print("\033[32m[OK] SSH ulandi\033[0m")

# ── 1. Server resurslarini o'lchash ──────────────────────
print("\n\033[1m[1/4] Server resurslari...\033[0m")
cpu_out = run(c, "nproc")
mem_out = run(c, "free -h | grep Mem")
run(c, "uname -r && python3 --version 2>&1")

try:
    cpu_count = int(cpu_out.strip())
except:
    cpu_count = 4
    print(f"CPU count aniqlanmadi, default={cpu_count} ishlatiladi")

# Gunicorn formula: (2 * CPU) + 1 workers
# Lekin har bir worker uvicorn async process
# 50 kamera/so'rovlar uchun optimal: CPU*2 + 1
workers = (cpu_count * 2) + 1
# Har bir worker uchun thread emas, async loop
# keepalive, timeout katta bo'lsin
print(f"\n\033[32m  CPU yadrolar: {cpu_count}\033[0m")
print(f"\033[32m  Optimal workers: {workers} (2×CPU+1)\033[0m")
print(f"\033[32m  RAM: {mem_out}\033[0m")

# ── 2. gunicorn o'rnatish ────────────────────────────────
print("\n\033[1m[2/4] gunicorn o'rnatish...\033[0m")
run(c, f"cd {APP_DIR} && source {VENV}/bin/activate && pip install gunicorn -q && echo 'gunicorn OK'", timeout=60)
run(c, f"{VENV}/bin/gunicorn --version")

# ── 3. gunicorn config fayli yaratish ────────────────────
print("\n\033[1m[3/4] gunicorn.conf.py yaratish...\033[0m")

gunicorn_conf = f"""# gunicorn.conf.py — BioFace Production Config
# CPU: {cpu_count} yadro | Workers: {workers}

import multiprocessing

# ── Binding ──────────────────────────────────────────────
bind = "0.0.0.0:8000"
backlog = 2048          # Navbatdagi so'rovlar soni

# ── Workers ──────────────────────────────────────────────
# uvicorn.workers.UvicornWorker = async, non-blocking
# har bir worker = alohida process, GIL yo'q
workers = {workers}                  # 2 * {cpu_count} CPU + 1
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000    # Har bir worker max ulanish
threads = 1                  # Uvicorn async, thread kerak emas

# ── Timeouts ─────────────────────────────────────────────
timeout = 120            # 50 kamera so'rovi uchun yetarli
keepalive = 10           # Kamera ulanishlarini ushlab turadi
graceful_timeout = 30    # Restart paytida graceful shutdown

# ── Performance ──────────────────────────────────────────
max_requests = 1000           # Har 1000 so'rovdan keyin worker restart
max_requests_jitter = 100     # Bir vaqtda hammasi restart qilmasin
preload_app = True            # DB, modellar bir marta yuklansin (RAM tejash)

# ── Logging ──────────────────────────────────────────────
accesslog = "{APP_DIR}/logs/access.log"
errorlog  = "{APP_DIR}/logs/error.log"
loglevel  = "warning"        # Kam disk I/O
capture_output = True
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(D)s'

# ── Process naming ───────────────────────────────────────
proc_name = "bioface"
"""

run(c, f"mkdir -p {APP_DIR}/logs")
run(c, f"cat > {APP_DIR}/gunicorn.conf.py << 'GCEOF'\n{gunicorn_conf}\nGCEOF")
run(c, f"echo 'gunicorn.conf.py saqlandi:' && head -15 {APP_DIR}/gunicorn.conf.py")

# ── 4. systemd service — gunicorn bilan yangilash ────────
print("\n\033[1m[4/4] systemd service yangilash...\033[0m")

service = f"""[Unit]
Description=BioFace Davomat Tizimi (Production — {workers} workers)
After=network.target redis-server.service
Wants=redis-server.service

[Service]
Type=notify
NotifyAccess=all
User={USER}
Group={USER}
WorkingDirectory={APP_DIR}
Environment="PATH={VENV}/bin:/usr/local/bin:/usr/bin:/bin"
EnvironmentFile={APP_DIR}/.env

# gunicorn + uvicorn workers (async, {cpu_count} CPU x2+1)
ExecStart={VENV}/bin/gunicorn main:app \\
    --config {APP_DIR}/gunicorn.conf.py

ExecReload=/bin/kill -s HUP $MAINPID

# Xizmat o'lsa qayta ishga tushsin
Restart=always
RestartSec=3
StartLimitBurst=5
StartLimitIntervalSec=60

# Resurs limiti (8 GB server)
LimitNOFILE=65536            # File descriptor limit
LimitNPROC=4096              # Process limit

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""

run(c, f"printf '%s' '{service}' > /tmp/bioface.service")
run(c, f"{SUDO} cp /tmp/bioface.service /etc/systemd/system/bioface.service 2>/dev/null && echo 'Service yangilandi'")
run(c, f"{SUDO} systemctl daemon-reload 2>/dev/null && echo 'Daemon reload OK'")
run(c, f"{SUDO} systemctl restart bioface 2>/dev/null && echo 'Restart OK'")

time.sleep(6)

# ── Status ───────────────────────────────────────────────
print("\n" + "═" * 65)
print("  HOLAT TEKSHIRUVI")
print("═" * 65)

out = run(c, f"{SUDO} systemctl status bioface 2>/dev/null | head -20", show_cmd=False)
run(c, "redis-cli ping 2>/dev/null || echo 'Redis: DOWN'")
run(c, "curl -s -m 8 -o /dev/null -w 'HTTP: %{http_code}' http://127.0.0.1:8000/login 2>/dev/null || echo 'Web javob bermadi'")

# Worker processlarni ko'rsatish
print("\n\033[1mIshlaydigan worker processlar:\033[0m")
run(c, f"pgrep -a -f 'gunicorn|uvicorn' 2>/dev/null | head -20 || echo 'Process topilmadi'")

# CPU/RAM ishlatilishi
run(c, "ps aux --sort=-%cpu | grep -E 'gunicorn|uvicorn' | head -10 | awk '{print $2,$3,$4,$11}' 2>/dev/null || true")

print("\n" + "═" * 65)
print(f"  \033[36mWeb URL   :\033[0m http://94.141.85.147:8000")
print(f"  \033[36mLogin     :\033[0m admin@gmail.com / admin123")
print(f"  \033[36mWorkers   :\033[0m {workers} ta (2×{cpu_count} CPU + 1, async uvicorn)")
print(f"  \033[36mMax conn  :\033[0m {workers * 1000} ta parallel so'rov")
print(f"  \033[36mTimeout   :\033[0m 120s (50 kamera so'rovi uchun)")
print("═" * 65)

c.close()
