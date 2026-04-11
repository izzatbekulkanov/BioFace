"""
Kamera to'liq audit skripti - to'g'ri endpoint orqali
"""
import httpx
import json
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BACKEND = "http://localhost:8000"

# /devices dan kamera ro'yxatini olamiz
devs = httpx.get("http://localhost:7670/devices", timeout=5.0).json()
print(f"\n{'='*70}")
print(f"  Jami {len(devs)} ta kamera online")
print(f"{'='*70}")

# Har bir kamerani database dan ham olamiz
db_cams = httpx.get(f"{BACKEND}/api/isup-devices", timeout=10.0).json()
db_map = {}
for c in db_cams:
    did = c.get("device_id") or c.get("id")
    if did: db_map[did] = c

audit = {}

for dev in devs:
    cam_id   = dev.get("device_id") or dev.get("id")
    ip       = dev.get("ip") or dev.get("remote_ip") or "?"
    model    = dev.get("device_model") or dev.get("model") or "?"
    fw       = dev.get("firmware_version") or dev.get("firmware") or "?"
    serial   = dev.get("serial") or "?"
    isup_ver = dev.get("isup_version") or "?"
    
    db_info  = db_map.get(cam_id) or {}
    db_cam_id = db_info.get("db_camera_id")
    
    print(f"\n{'='*70}")
    print(f"  {cam_id}")
    print(f"  IP: {ip}  |  Model: {model}  |  FW: {fw}")
    print(f"  Serial: {serial}  |  ISUP: {isup_ver}")
    print(f"  DB Camera ID: {db_cam_id or '?'}")
    print(f"{'='*70}")

    result = {
        "ip": ip, "model": model, "firmware": fw, "serial": serial,
        "isup_version": isup_ver, "db_camera_id": db_cam_id,
    }

    if not db_cam_id:
        print("  [!] Bu kamera DB da sozlanmagan!")
        audit[cam_id] = result
        continue

    # Database camera ID orqali ISAPI buyruq yuboramiz
    ISAPI_PATHS = [
        ("deviceInfo",     "GET", "/ISAPI/System/deviceInfo",                    None),
        ("httpListening",  "GET", "/ISAPI/System/Network/httpListening",          None),
        ("networkInterfaces","GET","/ISAPI/System/Network/interfaces",            None),
        ("platformConfig", "GET", "/ISAPI/System/Network/platform",              None),
    ]

    for label, method, path, body in ISAPI_PATHS:
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

        try:
            resp = httpx.post(
                f"{BACKEND}/api/cameras/{db_cam_id}/command",
                json=payload,
                timeout=20.0,
            )
            data = resp.json()

            if data.get("ok"):
                j = data.get("json") or {}
                txt = data.get("text") or ""
                print(f"\n  [{label}] OK")
                if j:
                    print(f"    {json.dumps(j, indent=4, ensure_ascii=False)[:1500]}")
                elif txt:
                    print(f"    {txt[:800]}")
                result[label] = j or txt
            else:
                err = data.get("error") or data.get("detail") or data
                print(f"\n  [{label}] XATO: {err}")
                result[label] = {"error": str(err)}

        except Exception as ex:
            print(f"\n  [{label}] Exception: {ex}")
            result[label] = {"error": str(ex)}

    audit[cam_id] = result

with open("CAMERA_AUDIT.json", "w", encoding="utf-8") as f:
    json.dump(audit, f, ensure_ascii=False, indent=2)

print(f"\n\nAudit tugadi. Natijalar CAMERA_AUDIT.json ga saqlandi.")
