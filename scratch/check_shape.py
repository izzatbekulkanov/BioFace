import httpx, json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

r = httpx.get("http://localhost:8000/api/isup-devices", timeout=10.0)
d = r.json()
print(f"type={type(d)}, len={len(d) if isinstance(d,list) else 'n/a'}")
if isinstance(d, list):
    print("\n--- First 2 items ---")
    for x in d[:2]:
        print(type(x), str(x)[:200])
else:
    print(str(d)[:400])
