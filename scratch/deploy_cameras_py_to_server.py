#!/usr/bin/env python3
import paramiko
import os

HOST, PORT, USER, PASS = "94.141.85.147", 56522, "admin", "admin1231"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30)

print("Connected. Uploading routers/cameras.py...")
sftp = c.open_sftp()
local_path = "/Users/macbookpro/Documents/GitHub/BioFace/routers/cameras.py"
remote_path = "/home/admin/BioFace/routers/cameras.py"
sftp.put(local_path, remote_path)
sftp.close()

print("File uploaded. Restarting bioface service...")
c.exec_command(f"echo '{PASS}' | sudo -S systemctl restart bioface")
c.close()
print("Done!")
