import json
import redis
import time
import uuid

client = redis.Redis(host='127.0.0.1', port=6379)
req_id = uuid.uuid4().hex

cmd = {
    "command": "get_face_image",
    "params": {
        "personal_id": "7149926",
    },
    "request_id": req_id
}

camera_id = "CAMERA0002"  # or whatever it is, I can just send to broadcast if I want? NO, need exact
for cam in client.keys("isup_server_queue:*"):
    cam_str = cam.decode('utf-8')
    print(f"Sending to {cam_str}")
    client.lpush(cam_str, json.dumps(cmd))

print("Waiting for response...")
for _ in range(30):
    resp = client.lpop(f"isup_response_queue:{req_id}")
    if resp:
        res = json.loads(resp)
        if 'image_b64' in res:
            res['image_b64'] = f"<{len(res['image_b64'])} bytes of base64>"
        if 'raw_payload' in res:
            res['raw_payload'] = "..."
        print(f"Got response: {json.dumps(res, indent=2)}")
        break
    time.sleep(1)
