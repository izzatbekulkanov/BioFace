#!/usr/bin/env python3
import paramiko

HOST, PORT, USER, PASS = "94.141.85.147", 56522, "admin", "admin1231"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30)
print("Connected")

def run(cmd):
    print(f"Running: {cmd}")
    _, o, e = c.exec_command(f"echo '{PASS}' | sudo -S {cmd}")
    out = o.read().decode().strip()
    err = e.read().decode().strip()
    if out: print("OUT:", out)
    if err: print("ERR:", err)

# Install missing system libraries for headless OpenGL and basic C++ runtimes
run("apt-get update")
run("DEBIAN_FRONTEND=noninteractive apt-get install -y libgl1 libglib2.0-0")

# Register the SDK directory in ld.so.conf.d so all .so files map automatically via ldconfig
run("bash -c 'echo \"/home/admin/BioFace/hikvision_sdk_linux\" > /etc/ld.so.conf.d/hikvision.conf'")
run("ldconfig")

# Restart
run("systemctl restart bioface-isup")
run("systemctl status bioface-isup | head -15")
run("journalctl -u bioface-isup -n 30 --no-pager")

c.close()
