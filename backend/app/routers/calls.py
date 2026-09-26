import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..core import CurrentUser, db, now_iso, public_user
from ..realtime import manager

router = APIRouter(tags=["calls"])


class StartCall(BaseModel):
    conversation_id: str
    type: str = "voice"  # voice | video


@router.post("/calls", status_code=201)
async def start_call(body: StartCall, user: CurrentUser):
    conv = await db.conversations.find_one({"id": body.conversation_id, "deleted_at": None})
    if not conv or user["id"] not in conv.get("members", []):
        raise HTTPException(404, "Conversation not found")
    callee_ids = [m for m in conv["members"] if m != user["id"]]
    call = {
        "id": str(uuid.uuid4()),
        "conversation_id": body.conversation_id,
        "caller_id": user["id"],
        "callee_ids": callee_ids,
        "type": body.type,
        "status": "ringing",
        "participants": [user["id"]],
        "started_at": now_iso(),
        "answered_at": None,
        "ended_at": None,
        "duration": 0,
        "created_at": now_iso(),
    }
    await db.calls.insert_one(call)
    call.pop("_id", None)
    caller = public_user(user)
    await manager.send_to_users(
        callee_ids,
        {"type": "call:incoming", "call": call, "caller": caller},
    )
    return {"call": call, "caller": caller}


class CallAction(BaseModel):
    status: str  # answered | declined | ended | missed
    duration: int | None = None


@router.patch("/calls/{call_id}")
async def update_call(call_id: str, body: CallAction, user: CurrentUser):
    call = await db.calls.find_one({"id": call_id})
    if not call:
        raise HTTPException(404, "Call not found")
    updates: dict = {"status": body.status}
    if body.status == "answered":
        updates["answered_at"] = now_iso()
        participants = list({*call.get("participants", []), user["id"]})
        updates["participants"] = participants
    if body.status in ("ended", "declined", "missed"):
        updates["ended_at"] = now_iso()
        if body.duration is not None:
            updates["duration"] = body.duration
    await db.calls.update_one({"id": call_id}, {"$set": updates})
    everyone = [call["caller_id"], *call.get("callee_ids", [])]
    await manager.send_to_users(
        everyone, {"type": "call:update", "call_id": call_id, "status": body.status, "by": user["id"]}
    )
    return {"ok": True}


@router.get("/calls")
async def call_history(user: CurrentUser):
    out = []
    cursor = db.calls.find(
        {"$or": [{"caller_id": user["id"]}, {"callee_ids": user["id"]}]}
    ).sort("created_at", -1).limit(100)
    async for c in cursor:
        c.pop("_id", None)
        is_outgoing = c["caller_id"] == user["id"]
        other_id = c["callee_ids"][0] if is_outgoing and c.get("callee_ids") else c["caller_id"]
        other = await db.users.find_one({"id": other_id, "deleted_at": None})
        c["direction"] = "outgoing" if is_outgoing else "incoming"
        c["is_missed"] = c["status"] in ("missed", "declined") and not is_outgoing
        c["peer"] = public_user(other) if other else None
        out.append(c)
    return out
