#!/usr/bin/env python3
import paramiko, time

HOST, PORT, USER, PASS = "94.141.85.147", 56522, "admin", "admin1231"
APP_DIR = "/home/admin/BioFace"
VENV = f"{APP_DIR}/venv"
SUDO = f"echo '{PASS}' | sudo -S"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30)
print("[OK] SSH connected")

service = f"""[Unit]
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

sftp = c.open_sftp()
with sftp.file("/tmp/bioface-isup.service", "w") as f:
    f.write(service)
sftp.close()
print("Uploaded service file...")

def run(cmd):
    _, o, e = c.exec_command(f"echo '{PASS}' | sudo -S {cmd}")
    out = o.read().decode().strip()
    return out

run("cp /tmp/bioface-isup.service /etc/systemd/system/bioface-isup.service")
run("systemctl daemon-reload")
run("systemctl enable bioface-isup")
run("systemctl restart bioface-isup")
time.sleep(4)

print("\n=== STATUS ===")
print(run("systemctl status bioface-isup | head -15"))
print("\n=== ISUP LOGS ===")
print(run("journalctl -u bioface-isup -n 30 --no-pager"))

c.close()
