from typing import List, Dict, Any
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[Dict[str, Any]] = []

    async def connect(self, websocket: WebSocket, allowed_org_ids: List[int], is_super_admin: bool):
        await websocket.accept()
        self.active_connections.append({
            "websocket": websocket,
            "allowed_org_ids": set(allowed_org_ids),
            "is_super_admin": is_super_admin
        })

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [
            c for c in self.active_connections if c["websocket"] != websocket
        ]

    async def broadcast(self, message: dict):
        event_org_id = message.get("organization_id")
        
        for conn in list(self.active_connections):
            websocket = conn["websocket"]
            is_super = conn["is_super_admin"]
            allowed = conn["allowed_org_ids"]
            
            # Send message if client is super_admin OR if the event's org matches their allowed list
            if is_super or (event_org_id is not None and int(event_org_id) in allowed):
                try:
                    await websocket.send_json(message)
                except Exception:
                    self.disconnect(websocket)

manager = ConnectionManager()
