"""
Kamera sozlamalarini tekshiruvchi skript
ISUP orqali har bir kameranin firmware, device info va HTTP Push sozlamalarini oladi
"""
import httpx
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ISUP_BASE = "http://localhost:7670"

# Avval barcha ulangan kameralarni olamiz
try:
    devs_resp = httpx.get(f"{ISUP_BASE}/devices", timeout=5.0)
    all_devices = devs_resp.json()
    if isinstance(all_devices, dict):
        all_devices = all_devices.get("devices") or []
    CAMERAS = [d.get("device_id") or d.get("id") for d in all_devices if isinstance(d, dict)]
    print(f"Online kameralar ({len(CAMERAS)} ta): {CAMERAS}")
except Exception as e:
    print(f"Kameralar listini ololmadi: {e}")
    CAMERAS = ["CAMERA0001", "CAMERA0002", "CAMERA0004", "CAMERA12MAKTAB1"]

ISAPI_PATHS = [
    ("deviceInfo",       "/ISAPI/System/deviceInfo"),
    ("httpListening",    "/ISAPI/System/Network/httpListening"),
    ("networkInterfaces","/ISAPI/System/Network/interfaces"),
]

results = {}

for cam_id in CAMERAS:
    if not cam_id:
        continue
    print(f"\n{'='*60}")
    print(f"  Kamera: {cam_id}")
    print(f"{'='*60}")
    cam_results = {}
    
    for label, path in ISAPI_PATHS:
        try:
            resp = httpx.post(
                f"{ISUP_BASE}/command/{cam_id}",
                json={
                    "command": "isapi_passthrough",
                    "params": {
                        "method": "GET",
                        "path": path,
                        "allow_http_fallback": False,
                    }
                },
                timeout=15.0
            )
            data = resp.json()
            cam_results[label] = data
            
            if data.get("ok"):
                j = data.get("json") or {}
                txt = data.get("text") or ""
                print(f"\n  [{label}] OK")
                if j:
                    print(f"    {json.dumps(j, indent=4, ensure_ascii=False)[:1000]}")
                elif txt:
                    print(f"    {txt[:500]}")
            else:
                print(f"\n  [{label}] XATO: {data.get('error')}")
        except Exception as e:
            print(f"\n  [{label}] Exception: {e}")
            cam_results[label] = {"error": str(e)}
    
    results[cam_id] = cam_results

# Natijani faylga ham saqlaymiz
with open("C:/Users/Izzatbek/Documents/FaceX/CAMERA_AUDIT.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("\n\nNatijalar CAMERA_AUDIT.json fayliga saqlandi.")
