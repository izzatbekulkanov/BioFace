import psutil, os, signal

for p in psutil.process_iter(['pid', 'cmdline']):
    cmd = p.info.get('cmdline')
    if cmd and 'isup_sdk_server.py' in ' '.join(cmd):
        print("Killing PID", p.info['pid'])
        try:
            os.kill(p.info['pid'], signal.SIGTERM)
        except:
            pass
