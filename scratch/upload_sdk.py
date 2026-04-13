#!/usr/bin/env python3
import os
import paramiko

HOST, PORT, USER, PASS = "94.141.85.147", 56522, "admin", "admin1231"
LOCAL_DIR = "/Users/macbookpro/Documents/GitHub/BioFace/hikvision_sdk_linux"
REMOTE_DIR = "/home/admin/BioFace/hikvision_sdk_linux"
SUDO = f"echo '{PASS}' | sudo -S"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30)
print("[OK] SSH Connected")

def run(cmd):
    _, o, _ = c.exec_command(cmd)
    return o.read().decode().strip()

run(f"mkdir -p {REMOTE_DIR}")
sftp = c.open_sftp()

for root, dirs, files in os.walk(LOCAL_DIR):
    for f in files:
        local_path = os.path.join(root, f)
        rel_path = os.path.relpath(local_path, LOCAL_DIR)
        remote_path = os.path.join(REMOTE_DIR, rel_path).replace("\\", "/")
        print(f"Uploading {f}...")
        sftp.put(local_path, remote_path)

sftp.close()
print("Upload complete. Setting permissions and restarting bioface-isup.")

run(f"chmod +x {REMOTE_DIR}/*.so*")
run(f"{SUDO} systemctl restart bioface-isup")
run(f"{SUDO} systemctl status bioface-isup")

c.close()
