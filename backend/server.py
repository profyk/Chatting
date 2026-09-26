import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware

from app.core import db, get_user_by_token
from app.realtime import conversation_member_ids, manager, set_presence
from app.routers import auth, calls, chats, users, vip
from app.storage import init_storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ditsala")

app = FastAPI(title="Ditsala API")

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(chats.router, prefix="/api")
app.include_router(calls.router, prefix="/api")
app.include_router(vip.router, prefix="/api")


@app.get("/api/")
async def root():
    return {"app": "Ditsala", "status": "ok"}


@app.get("/api/health")
async def health():
    await db.command("ping")
    return {"ok": True, "realtime_connections": sum(len(v) for v in manager.active.values())}


@app.on_event("startup")
async def on_startup():
    # Indexes for scale.
    try:
        await db.users.create_index("email", unique=True, sparse=True)
        await db.users.create_index("username", unique=True, sparse=True)
        await db.conversations.create_index("members")
        await db.conversations.create_index([("updated_at", -1)])
        await db.messages.create_index([("conversation_id", 1), ("created_at", -1)])
        await db.messages.create_index("attachment.url")
        await db.contacts.create_index([("owner_id", 1), ("contact_id", 1)])
        await db.blocked_users.create_index([("blocker_id", 1), ("blocked_id", 1)])
        await db.calls.create_index([("caller_id", 1), ("created_at", -1)])
        await db.attachments.create_index("path")
    except Exception as e:  # noqa: BLE001
        logger.warning("index creation issue: %s", e)
    try:
        init_storage()
    except Exception as e:  # noqa: BLE001
        logger.warning("storage init deferred: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    db.client.close() if hasattr(db, "client") else None


# --------------------------------------------------------------------------- #
# WebSocket: presence + typing + call signaling relay                          #
# --------------------------------------------------------------------------- #
@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket, token: str = ""):
    try:
        user = await get_user_by_token(token)
    except Exception:
        await ws.close(code=4401)
        return
    user_id = user["id"]
    await manager.connect(user_id, ws)
    await set_presence(user_id, True)
    try:
        while True:
            data = await ws.receive_json()
            kind = data.get("type")
            if kind == "typing":
                cid = data.get("conversation_id")
                members = await conversation_member_ids(cid)
                targets = [m for m in members if m != user_id]
                await manager.send_to_users(
                    targets,
                    {"type": "typing", "conversation_id": cid, "user_id": user_id, "is_typing": bool(data.get("is_typing"))},
                )
            elif kind == "call:signal":
                # Relay WebRTC SDP/ICE payloads to the target peer(s).
                to = data.get("to", [])
                await manager.send_to_users(
                    to if isinstance(to, list) else [to],
                    {"type": "call:signal", "from": user_id, "call_id": data.get("call_id"), "signal": data.get("signal")},
                )
            elif kind == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001
        logger.warning("ws error: %s", e)
    finally:
        manager.disconnect(user_id, ws)
        if not manager.is_online(user_id):
            await set_presence(user_id, False)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
