"""Realtime layer: presence + fan-out over WebSockets.

The mobile client keeps one authenticated WebSocket. REST mutations (send /
edit / delete / react / read) push events here; this module fans them out to the
relevant users. Designed to be swappable for a Redis pub/sub backbone when
scaling horizontally beyond one worker.
"""
from typing import Any

from fastapi import WebSocket

from .core import db, now_iso


class ConnectionManager:
    def __init__(self) -> None:
        # user_id -> set of live sockets (multiple devices supported)
        self.active: dict[str, set[WebSocket]] = {}

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self.active.setdefault(user_id, set()).add(ws)

    def disconnect(self, user_id: str, ws: WebSocket) -> None:
        conns = self.active.get(user_id)
        if not conns:
            return
        conns.discard(ws)
        if not conns:
            self.active.pop(user_id, None)

    def is_online(self, user_id: str) -> bool:
        return bool(self.active.get(user_id))

    async def send_to_users(self, user_ids: list[str], message: dict[str, Any]) -> None:
        seen: set[WebSocket] = set()
        for uid in set(user_ids):
            for ws in list(self.active.get(uid, [])):
                if ws in seen:
                    continue
                seen.add(ws)
                try:
                    await ws.send_json(message)
                except Exception:
                    self.disconnect(uid, ws)


manager = ConnectionManager()


async def conversation_member_ids(conversation_id: str) -> list[str]:
    conv = await db.conversations.find_one(
        {"id": conversation_id}, {"members": 1}
    )
    return list(conv.get("members", [])) if conv else []


async def peers_of(user_id: str) -> list[str]:
    """All users that share at least one conversation with `user_id`."""
    peers: set[str] = set()
    async for conv in db.conversations.find(
        {"members": user_id, "deleted_at": None}, {"members": 1}
    ):
        peers.update(conv.get("members", []))
    peers.discard(user_id)
    return list(peers)


async def set_presence(user_id: str, online: bool) -> None:
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_online": online, "last_seen": now_iso()}},
    )
    peers = await peers_of(user_id)
    await manager.send_to_users(
        peers,
        {"type": "presence", "user_id": user_id, "is_online": online, "last_seen": now_iso()},
    )
