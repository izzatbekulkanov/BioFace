#!/usr/bin/env python3
"""ISUP serverni ishga tushirish va tekshirish"""
import sys
sys.path.insert(0, '.')
from isup_manager import get_process_status, start_isup_server
import traceback

s = get_process_status()
if s['running']:
    print(f"   OK ISUP server allaqachon ishlamoqda (PID: {s.get('pid', '?')})")
else:
    try:
        print("   ISUP server ishga tushirilmoqda...")
        r = start_isup_server()
        print(f"   Status: {r}")
        if r['running']:
            print(f"   OK ISUP server ishga tushdi (PID: {r.get('pid', '?')})")
        else:
            print("   FAIL ISUP server ishga tushmadi!")
            print(f"   Binary path: {r.get('binary_path')}")
            print(f"   Command: {r.get('start_command')}")
    except Exception as e:
        print(f"   ERROR: {e}")
        traceback.print_exc()
