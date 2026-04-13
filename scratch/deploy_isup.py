#!/usr/bin/env python3
"""Deploy SDK changes and enable ISUP"""
import paramiko, time, os

HOST, PORT, USER, PASS = "94.141.85.147", 56522, "admin", "admin1231"
APP_DIR = "/home/admin/BioFace"
SUDO = f"echo '{PASS}' | sudo -S"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30, banner_timeout=60)
print("\033[32m[OK] SSH ulandi\033[0m")

def run(cmd, timeout=60):
    print(f"\033[36m$ {cmd.replace(PASS, '***')[:120]}\033[0m")
    _, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode(errors="replace").strip()
    return out

# 1. Update .env to hikvision_sdk
run(f"sed -i 's|ISUP_IMPLEMENTATION_MODE=disabled|ISUP_IMPLEMENTATION_MODE=hikvision_sdk|g' {APP_DIR}/.env")

# 2. Push hikvision SDK files if not pushed
project = "/Users/macbookpro/Documents/GitHub/BioFace"
files_to_push = [
    (f"{project}/system_config.py", f"{APP_DIR}/system_config.py"),
]
sftp = c.open_sftp()
for local, remote in files_to_push:
    if os.path.exists(local):
        sftp.put(local, remote)
        print(f"[SFTP] {local.split('/')[-1]} yuborildi.")

# Also ensure hikvision_sdk_linux is uploaded if missing
run(f"ls -ld {APP_DIR}/hikvision_sdk_linux || echo 'No linux SDK'")

print("Restarting bioface and bioface-isup...")
run(f"{SUDO} systemctl daemon-reload 2>/dev/null")
run(f"{SUDO} systemctl restart bioface 2>/dev/null")

# start bioface-isup.service
run(f"{SUDO} systemctl enable bioface-isup 2>/dev/null")
run(f"{SUDO} systemctl restart bioface-isup 2>/dev/null")
time.sleep(3)

print("\n\033[1mStatus:\033[0m")
print(run(f"{SUDO} systemctl status bioface-isup 2>/dev/null | head -15"))
print("\nISUP Logs:\033[0m")
print(run(f"{SUDO} journalctl -u bioface-isup -n 30 --no-pager 2>/dev/null"))

c.close()
