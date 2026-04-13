#!/usr/bin/env python3
import paramiko

HOST, PORT, USER, PASS = "94.141.85.147", 56522, "admin", "admin1231"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30)

def run(cmd):
    _, o, e = c.exec_command(f"echo '{PASS}' | sudo -S {cmd}")
    out = o.read().decode().strip()
    err = e.read().decode().strip()
    return out if out else err

print("=== STATUS ===")
print(run("systemctl status bioface-isup"))
print("\n=== LOGS ===")
print(run("journalctl -u bioface-isup -n 30 --no-pager"))
print("\n=== PIDS ===")
print(run("pgrep -a -f isup_sdk_server.py"))

c.close()
