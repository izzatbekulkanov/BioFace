"""Enhanced WebSocket manager — ping/pong, reconnect, typed events."""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from fastapi import WebSocket

LOGGER = logging.getLogger(__name__)

# Ping interval (seconds) — keep-alive
PING_INTERVAL = 30


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[dict[str, Any]] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, allowed_org_ids: list[int], is_super_admin: bool):
        await websocket.accept()
        async with self._lock:
            self.active_connections.append({
                "websocket": websocket,
                "allowed_org_ids": set(allowed_org_ids),
                "is_super_admin": is_super_admin,
                "connected_at": time.time(),
                "last_ping": time.time(),
            })
        LOGGER.debug("WS connected. Total: %d", len(self.active_connections))

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [
            c for c in self.active_connections if c["websocket"] != websocket
        ]
        LOGGER.debug("WS disconnected. Total: %d", len(self.active_connections))

    async def broadcast(self, message: dict):
        """Barcha ulanishlarga xabar yuborish (org filtri bilan)."""
        event_org_id = message.get("organization_id")
        dead = []

        for conn in list(self.active_connections):
            ws = conn["websocket"]
            is_super = conn["is_super_admin"]
            allowed = conn["allowed_org_ids"]

            # Faqat tegishli org ga yuborish
            if not is_super and (event_org_id is None or int(event_org_id) not in allowed):
                continue

            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        # O'lik ulanishlarni tozalash
        for ws in dead:
            self.disconnect(ws)

    async def broadcast_event(self, event_type: str, data: dict, organization_id: int | None = None):
        """Typed event yuborish — {type, data, organization_id, timestamp}"""
        message = {
            "type": event_type,
            "data": data,
            "organization_id": organization_id,
            "timestamp": time.time(),
        }
        await self.broadcast(message)

    async def ping_all(self):
        """Barcha ulanishlarga ping yuborish."""
        dead = []
        for conn in list(self.active_connections):
            ws = conn["websocket"]
            try:
                await ws.send_json({"type": "ping", "timestamp": time.time()})
                conn["last_ping"] = time.time()
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    def get_stats(self) -> dict:
        return {
            "total_connections": len(self.active_connections),
            "super_admin_connections": sum(1 for c in self.active_connections if c["is_super_admin"]),
            "org_connections": sum(1 for c in self.active_connections if not c["is_super_admin"]),
        }


manager = ConnectionManager()
