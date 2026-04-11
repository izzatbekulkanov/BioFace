"""
Kamera to'liq audit skripti
FastAPI backend orqali har bir kameradagi sozlamalarni tekshiradi
"""
import httpx
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Backend API URL
BACKEND = "http://localhost:8000"

CAMERAS = [
    {"device_id": "CAMERA0001", "serial": "GH4784120",  "ip": "144.124.196.84"},
    {"device_id": "CAMERA0002", "serial": "GH4783854",  "ip": "144.124.196.117"},
    {"device_id": "CAMERA0004", "serial": "GH4783845",  "ip": "144.124.199.253"},
    {"device_id": "CAMERA12MAKTAB1", "serial": "AG6295171", "ip": "198.163.192.204"},
    {"device_id": "CAMERA12MAKTAB2", "serial": "DS-K1T341CMF20230901...", "ip": "198.163.192.204", "model": "DS-K1T341CMF", "fw": "V3.3.15"},
]

ISAPI_CHECKS = [
    ("deviceInfo",    "GET", "/ISAPI/System/deviceInfo", None),
    ("httpListening", "GET", "/ISAPI/System/Network/httpListening", None),
    ("networkInterfaces", "GET", "/ISAPI/System/Network/interfaces", None),
]

results = {}

for cam in CAMERAS:
    cam_id = cam["device_id"]
    print(f"\n{'='*65}")
    print(f"  Kamera: {cam_id}  |  IP: {cam['ip']}  |  Serial: {cam['serial']}")
    print(f"  Model: {cam.get('model','?')}  |  FW: {cam.get('fw','?')}")
    print(f"{'='*65}")
    cam_results = {"ip": cam["ip"], "serial": cam["serial"]}

    for label, method, path, body in ISAPI_CHECKS:
        try:
            payload = {
                "command": "isapi_passthrough",
                "params": {
                    "method": method,
                    "path": path,
                    "allow_http_fallback": False,
                }
            }
            if body:
                payload["params"]["json_body"] = body

            resp = httpx.post(
                f"{BACKEND}/api/isup-command/{cam_id}",
                json=payload,
                timeout=20.0
            )
            
            if resp.status_code == 404:
                # endpoint pattern boshqacha bo'lishi mumkin
                resp = httpx.post(
                    f"{BACKEND}/api/isup/command/{cam_id}",
                    json=payload,
                    timeout=20.0
                )
            
            data = resp.json()
            cam_results[label] = data

            if isinstance(data, dict) and (data.get("ok") or data.get("status_code") == 200):
                j = data.get("json") or {}
                txt = data.get("text") or ""
                print(f"\n  [{label}] OK (http {resp.status_code})")
                if j:
                    print(f"    {json.dumps(j, indent=4, ensure_ascii=False)[:1200]}")
                elif txt:
                    print(f"    {txt[:600]}")
            else:
                print(f"\n  [{label}] XATO (http {resp.status_code}): {data}")
        except Exception as e:
            print(f"\n  [{label}] Exception: {e}")
            cam_results[label] = {"error": str(e)}

    results[cam_id] = cam_results

with open("C:/Users/Izzatbek/Documents/FaceX/CAMERA_AUDIT.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print("\nNatijalar CAMERA_AUDIT.json fayliga saqlandi.")
