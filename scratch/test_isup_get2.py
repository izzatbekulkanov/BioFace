import json
import redis
import time
import uuid

client = redis.Redis(host='127.0.0.1', port=6379)

states = client.hgetall("isup_device_states")
online_cams = []
for k, v in states.items():
    try:
        sd = json.loads(v)
        if sd.get("online"):
            online_cams.append(k.decode('utf-8'))
    except:
        pass

if not online_cams:
    print("NO ONLINE CAMERAS")
else:
    cam_id = online_cams[0]
    print(f"Testing with {cam_id}")
    
    req_id = uuid.uuid4().hex
    cmd = {
        "command": "get_face_records",
        "params": {
            "limit": 50,
            "all": True
        },
        "request_id": req_id
    }
    client.lpush(f"isup_server_queue:{cam_id}", json.dumps(cmd))
    
    print("Waiting...")
    for _ in range(15):
        r = client.lpop(f"isup_response_queue:{req_id}")
        if r:
            res = json.loads(r)
            if not res.get("ok"):
                print(f"FAILED: {res}")
            else:
                recs = res.get("records", [])
                print(f"GOT {len(recs)} records.")
                for rec in recs[:5]:
                    fpid = str(rec.get("fpid") or rec.get("FPID") or rec.get("employeeNo") or "")
                    print(f"    - ID: {fpid} | face_url: {rec.get('face_url')}")
            break
        time.sleep(1)
