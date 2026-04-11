"""
Kamera to'liq audit - login bilan
"""
import httpx, json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BACKEND = "http://localhost:8000"

# ─── 1. Login ───────────────────────────────────────────────────
# env fayldan yoki .env dan admin login/password olish
admin_email = "admin@gmail.com"
admin_pass = "admin123"

client = httpx.Client(base_url=BACKEND, follow_redirects=True, timeout=20.0)
login_resp = client.post("/api/auth/login", json={"email": admin_email, "password": admin_pass})
print(f"Login: {login_resp.status_code} | cookies: {list(client.cookies.keys())}")

if login_resp.status_code not in (200, 302, 303):
    print(f"Login xato: {login_resp.text[:200]}")
    sys.exit(1)

# ─── 2. ISUP devices ──────────────────────────────────────────
isup_devs_resp = client.get("/api/isup-devices")
print(f"\nISUP devices status: {isup_devs_resp.status_code}")
if isup_devs_resp.status_code != 200:
    print(f"  {isup_devs_resp.text[:200]}")
    sys.exit(1)

isup_devs = isup_devs_resp.json()
print(f"Jami {len(isup_devs)} ta kamera:\n")

audit = {}

for dev in isup_devs:
    cam_id   = dev.get("device_id") or dev.get("id") or "?"
    ip       = dev.get("ip") or dev.get("remote_ip") or "?"
    model    = dev.get("model") or dev.get("camera_model") or dev.get("device_model") or "?"
    fw       = dev.get("firmware_version") or dev.get("firmware") or "?"
    serial   = dev.get("serial") or "?"
    isup_ver = dev.get("isup_version") or "?"
    online   = dev.get("online", dev.get("connection_state") == "connected")
    db_cam_id = dev.get("db_camera_id")

    print(f"{'='*70}")
    print(f"  {cam_id}")
    print(f"  IP: {ip}  |  Model: {model}  |  Firmware: {fw}")
    print(f"  Serial: {serial}  |  ISUP: {isup_ver}  |  Online: {online}")
    print(f"  DB Camera ID: {db_cam_id or 'DB DA YOQ'}")

    result = {
        "ip": ip, "model": model, "firmware": fw,
        "serial": serial, "isup_version": isup_ver,
        "online": online, "db_camera_id": db_cam_id,
    }

    if not db_cam_id:
        print("  [!] Bu kamera Database da topilmadi - sozlamalarni tekshirib bo'lmaydi")
        audit[cam_id] = result
        continue

    # ─── ISUP commands ──────────────────────────────────────────
    checks = [
        ("deviceInfo",    "ping",             {}),
        ("techInfo",      "get_info",          {}),
        ("alarmServer",   "get_alarm_server",  {}),
        ("faceCount",     "get_face_count",    {}),
    ]

    for label, command, params in checks:
        payload = {"command": command, "params": params}
        try:
            r = client.post(f"/api/cameras/{db_cam_id}/command", json=payload, timeout=25.0)
            data = r.json()
            if data.get("ok") or r.status_code == 200:
                print(f"\n  [{label}] OK")
                # Show useful nested fields
                for key in ["device_info", "info", "alarm_server", "face_count",
                            "firmware_version", "model", "device_model",
                            "http_url", "host", "port", "enabled", "enable"]:
                    val = data.get(key)
                    if val is not None:
                        print(f"    {key}: {str(val)[:200]}")
                result[label] = data
            else:
                err = data.get("error") or data.get("detail") or str(data)[:150]
                print(f"\n  [{label}] XATO: {err}")
                result[label] = {"error": str(err)}
        except Exception as ex:
            print(f"\n  [{label}] Exception: {ex}")
            result[label] = {"error": str(ex)}

    audit[cam_id] = result
    print()

with open("CAMERA_AUDIT.json", "w", encoding="utf-8") as f:
    json.dump(audit, f, ensure_ascii=False, indent=2)

print("\nNatijalar CAMERA_AUDIT.json ga saqlandi.")
