#!/usr/bin/env python3
import paramiko

HOST, PORT, USER, PASS = "94.141.85.147", 56522, "admin", "admin1231"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30)
_, o, _ = c.exec_command(f"echo '{PASS}' | sudo -S journalctl -u bioface-isup -n 30 -q --no-pager")
print(o.read().decode())
c.close()
