import json
import redis
import time
import uuid
import sys

client = redis.Redis(host='127.0.0.1', port=6379)
req_id = uuid.uuid4().hex

cmd = {
    "command": "set_face",
    "params": {
        "personal_id": "4318523",
        "face_b64": "A" * 65000,
        "face_url": "",
        "face_lib_type": "blackFD",
        "fdid": "1",
        "face_mime": "image/jpeg"
    },
    "request_id": req_id
}

print(f"Sending request {req_id} to isup_server_queue:CAMERA0002")
client.lpush("isup_server_queue:CAMERA0002", json.dumps(cmd))

print("Waiting for response...")
for _ in range(20):
    resp = client.lpop(f"isup_response_queue:{req_id}")
    if resp:
        print(f"Got response: {resp.decode('utf-8')}")
        sys.exit(0)
    time.sleep(1)

print("Timeout waiting for response!")
sys.exit(1)
