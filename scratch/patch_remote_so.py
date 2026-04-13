#!/usr/bin/env python3
import paramiko, time

HOST, PORT, USER, PASS = "94.141.85.147", 56522, "admin", "admin1231"
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30)
print("Connected")

# Python script to run on the server to patch the binaries
patch_script = """
import os

target_dir = '/home/admin/BioFace/hikvision_sdk_linux'
target_string = b'HPR_LoadDSoEx\\x00'
replacement = b'HPR_LoadDSo\\x00\\x00\\x00'

for filename in os.listdir(target_dir):
    if not filename.endswith('.so'):
        continue
    filepath = os.path.join(target_dir, filename)
    
    with open(filepath, 'rb') as f:
        data = f.read()
        
    if target_string in data:
        print(f"Patching {filename}...")
        new_data = data.replace(target_string, replacement)
        with open(filepath, 'wb') as f:
            f.write(new_data)
        print(f"Patched {filename} successfully!")
"""

def run(cmd):
    print(f"Run: {cmd}")
    _, o, e = c.exec_command(f"echo '{PASS}' | sudo -S {cmd}")
    out = o.read().decode().strip()
    err = e.read().decode().strip()
    if out: print("OUT:", out)
    if err: print("ERR:", err)

sftp = c.open_sftp()
with sftp.file("/tmp/patcher.py", "w") as f:
    f.write(patch_script)
sftp.close()

run("python3 /tmp/patcher.py")
run("systemctl restart bioface-isup")
time.sleep(4)
run("systemctl status bioface-isup | head -15")
run("journalctl -u bioface-isup -n 30 --no-pager")

c.close()
