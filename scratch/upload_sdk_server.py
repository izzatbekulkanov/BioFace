#!/usr/bin/env python3
import paramiko, time

HOST, PORT, USER, PASS = "94.141.85.147", 56522, "admin", "admin1231"
LOCAL_FILE = "/Users/macbookpro/Documents/GitHub/BioFace/isup_sdk_server.py"
REMOTE_FILE = "/home/admin/BioFace/isup_sdk_server.py"
SUDO = f"echo '{PASS}' | sudo -S"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30)
print("[OK] SSH connected")

sftp = c.open_sftp()
sftp.put(LOCAL_FILE, REMOTE_FILE)
sftp.close()
print("Uploaded isup_sdk_server.py")

def run(cmd):
    _, o, _ = c.exec_command(f"echo '{PASS}' | sudo -S {cmd}")
    return o.read().decode().strip()

run("systemctl restart bioface-isup")
time.sleep(3)

print("=== STATUS ===")
print(run("systemctl status bioface-isup | head -15"))
print("\n=== LOGS ===")
print(run("journalctl -u bioface-isup -n 30 --no-pager"))

c.close()
