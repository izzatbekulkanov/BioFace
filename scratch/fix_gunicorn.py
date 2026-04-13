#!/usr/bin/env python3
"""Fix gunicorn.conf.py - remove invalid worker_exit=None"""
import paramiko, time

HOST, PORT, USER, PASS = "94.141.85.147", 56522, "admin", "admin1231"
APP_DIR = "/home/admin/BioFace"
SUDO = f"echo '{PASS}' | sudo -S"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30, banner_timeout=60)
c.get_transport().set_keepalive(20)
print("\033[32m[OK] SSH ulandi\033[0m")

# gunicorn.conf.py to'g'ri versiya — invalid parametr yo'q
good_conf = f"""# gunicorn.conf.py — BioFace Production (uvloop)
bind = "0.0.0.0:8000"
backlog = 4096
workers = 17
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 2000
timeout = 120
keepalive = 30
graceful_timeout = 30
max_requests = 2000
max_requests_jitter = 200
preload_app = True
accesslog = "{APP_DIR}/logs/access.log"
errorlog = "{APP_DIR}/logs/error.log"
loglevel = "warning"
capture_output = True
proc_name = "bioface-prod"

# uvloop: har bir worker uchun tezroq async loop
def post_fork(server, worker):
    try:
        import uvloop
        uvloop.install()
    except ImportError:
        pass
"""

sftp = c.open_sftp()
with sftp.file(f"{APP_DIR}/gunicorn.conf.py", "w") as f:
    f.write(good_conf)
sftp.close()
print("\033[32m[OK] gunicorn.conf.py to'g'rilandi\033[0m")

def run(cmd, timeout=60):
    print(f"\033[36m$ {cmd.replace(PASS, '***')[:120]}\033[0m")
    _, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode(errors="replace").strip()
    o.channel.recv_exit_status()
    if out: print(out)
    return out

run(f"{SUDO} systemctl restart bioface 2>/dev/null && echo 'Restart OK'")
time.sleep(6)
run(f"{SUDO} systemctl status bioface 2>/dev/null | head -15")
run("curl -s -m 5 -o /dev/null -w 'HTTP: %{http_code}' http://127.0.0.1:8000/login")
run(f"{SUDO} journalctl -u bioface -n 5 --no-pager 2>/dev/null")
print("\n\033[32m✅ http://94.141.85.147:8000 — admin@gmail.com / admin123\033[0m")
c.close()
