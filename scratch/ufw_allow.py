#!/usr/bin/env python3
import paramiko

HOST, PORT, USER, PASS = "94.141.85.147", 56522, "admin", "admin1231"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30)

def allow_port(port):
    _, o, _ = c.exec_command(f"echo '{PASS}' | sudo -S ufw allow {port}")
    print(o.read().decode().strip())

for port in ["7660/tcp", "7660/udp", "7661/tcp", "7662/tcp", "7670/tcp"]:
    allow_port(port)

_, o, _ = c.exec_command(f"echo '{PASS}' | sudo -S ufw status")
print(o.read().decode())
c.close()
