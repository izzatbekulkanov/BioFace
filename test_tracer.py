import json
import redis

client = redis.Redis(host='127.0.0.1', port=6379)

cmd = {
    "cmd": "set_face",
    "fpid": "10001",
    "face_b64": " " * 300, # fake short string
}

client.lpush("isup_client_queue", json.dumps({"target_id": "CAMERA0001", "ts": 123, "req": "A", "body": cmd}))
print("Sent command. Check logs!")
