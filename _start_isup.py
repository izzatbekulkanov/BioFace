import sys
sys.path.insert(0, '.')
from isup_manager import get_process_status, start_isup_server

s = get_process_status()
if s['running']:
    print(f"   OK ISUP server allaqachon ishlamoqda (PID: {s.get('pid', '?')})")
else:
    try:
        r = start_isup_server()
        if r['running']:
            print(f"   OK ISUP server ishga tushdi (PID: {r.get('pid', '?')})")
        else:
            print("   FAIL ISUP server ishga tushmadi!")
    except Exception as e:
        print(f"   WARN ISUP: {e}")
