import asyncio
import json
import logging
from typing import Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.add(ws)
        logger.info(f"WebSocket connected. Total: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)
        logger.info(f"WebSocket disconnected. Total: {len(self.active)}")

    async def broadcast(self, data: dict):
        if not self.active:
            return
        message = json.dumps(data)
        dead = set()
        for ws in list(self.active):
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active.discard(ws)

    async def send_personal(self, ws: WebSocket, data: dict):
        try:
            await ws.send_text(json.dumps(data))
        except Exception as e:
            logger.warning(f"Send failed: {e}")
            self.active.discard(ws)
