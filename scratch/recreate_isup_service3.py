#!/usr/bin/env python3
import paramiko, time

HOST, PORT, USER, PASS = "94.141.85.147", 56522, "admin", "admin1231"
APP_DIR = "/home/admin/BioFace"
VENV = f"{APP_DIR}/venv"
SUDO = f"echo '{PASS}' | sudo -S"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30)

service = f"""[Unit]
Description=BioFace ISUP SDK Server
After=network.target redis-server.service

[Service]
Type=simple
User={USER}
WorkingDirectory={APP_DIR}
Environment="PATH={VENV}/bin:/usr/local/bin:/usr/bin:/bin"
Environment="LD_LIBRARY_PATH={APP_DIR}/hikvision_sdk_linux"
EnvironmentFile={APP_DIR}/.env
ExecStart={VENV}/bin/python isup_sdk_server.py facex2024 7660 7670 127.0.0.1 6379 7661 7662
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""

sftp = c.open_sftp()
with sftp.file("/tmp/bioface-isup.service", "w") as f:
    f.write(service)
sftp.close()

def run(cmd):
    _, o, _ = c.exec_command(f"echo '{PASS}' | sudo -S {cmd}")
    return o.read().decode().strip()

run("cp /tmp/bioface-isup.service /etc/systemd/system/bioface-isup.service")
run("systemctl daemon-reload")
run("systemctl restart bioface-isup")
time.sleep(3)

print("=== STATUS ===")
print(run("systemctl status bioface-isup | head -15"))
print("\n=== LOGS ===")
print(run("journalctl -u bioface-isup -n 30 --no-pager"))

c.close()
