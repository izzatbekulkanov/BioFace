import json
import redis
import time
import uuid

client = redis.Redis(host='127.0.0.1', port=6379)

cmd = {
    "command": "get_face_records",
    "params": {
        "limit": 1000
    },
    "request_id": uuid.uuid4().hex
}

cams = client.keys("isup_server_queue:*")
if not cams:
    print("NO CAMERAS!")
else:
    cam_str = cams[0].decode('utf-8')
    print(f"Sending to {cam_str}")
    client.lpush(cam_str, json.dumps(cmd))
    
    for _ in range(30):
        resp = client.lpop(f"isup_response_queue:{cmd['request_id']}")
        if resp:
            res = json.loads(resp)
            records = res.get("records", [])
            print(f"Got {len(records)} records")
            for r in records:
                if str(r.get('fpid')) in ['1086', '7149926'] or str(r.get('FPID')) in ['1086', '7149926'] or str(r.get('employeeNo')) in ['1086', '7149926']:
                    print(f"FOUND TARGET: {r}")
                    if r.get('face_url'):
                        print(f"Its URL is {r.get('face_url')} and raw is {r.get('raw')}")
            break
        time.sleep(1)
