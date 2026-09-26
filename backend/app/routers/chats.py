import mimetypes
import uuid

from fastapi import (
    APIRouter,
    File,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..core import CurrentUser, db, get_user_by_token, now_iso, public_user
from ..realtime import manager
from ..storage import APP_NAME, get_object, put_object

router = APIRouter(tags=["chats"])

MAX_UPLOAD = 30 * 1024 * 1024  # 30 MB


def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def require_member(conversation_id: str, user_id: str) -> dict:
    conv = await db.conversations.find_one({"id": conversation_id, "deleted_at": None})
    if not conv or user_id not in conv.get("members", []):
        raise HTTPException(404, "Conversation not found")
    return conv


async def _member_settings(conv: dict, user_id: str) -> dict:
    return conv.get("member_settings", {}).get(user_id, {})


async def _unread_count(conv: dict, user_id: str) -> int:
    ms = conv.get("member_settings", {}).get(user_id, {})
    q = {
        "conversation_id": conv["id"],
        "sender_id": {"$ne": user_id},
        "deleted_at": None,
        "read_by": {"$ne": user_id},
    }
    cleared = ms.get("cleared_at")
    if cleared:
        q["created_at"] = {"$gt": cleared}
    return await db.messages.count_documents(q)


async def _serialize_conversation(conv: dict, user_id: str) -> dict:
    others = [m for m in conv.get("members", []) if m != user_id]
    member_docs = []
    async for u in db.users.find({"id": {"$in": conv.get("members", [])}}):
        pu = public_user(u)
        pu["is_online"] = manager.is_online(u["id"]) if u.get("privacy", {}).get("online_status", True) else False
        member_docs.append(pu)
    title = conv.get("name")
    image = conv.get("image_url")
    if conv["type"] == "direct":
        other = next((m for m in member_docs if m["id"] in others), None)
        title = other["display_name"] if other else "Ditsala user"
        image = other["avatar_url"] if other else None
    ms = conv.get("member_settings", {}).get(user_id, {})
    return {
        "id": conv["id"],
        "type": conv["type"],
        "title": title,
        "image_url": image,
        "description": conv.get("description", ""),
        "members": member_docs,
        "admins": conv.get("admins", []),
        "created_by": conv.get("created_by"),
        "last_message": conv.get("last_message"),
        "pinned_message_ids": conv.get("pinned_message_ids", []),
        "muted": bool(ms.get("muted")),
        "unread_count": await _unread_count(conv, user_id),
        "updated_at": conv.get("updated_at"),
    }


# --------------------------------------------------------------------------- #
# Conversations                                                                #
# --------------------------------------------------------------------------- #
@router.get("/conversations")
async def list_conversations(user: CurrentUser):
    out = []
    async for conv in db.conversations.find({"members": user["id"], "deleted_at": None}):
        out.append(await _serialize_conversation(conv, user["id"]))
    out.sort(key=lambda c: (c.get("last_message") or {}).get("created_at") or c.get("updated_at") or "", reverse=True)
    return out


class DirectBody(BaseModel):
    user_id: str


@router.post("/conversations/direct")
async def create_direct(body: DirectBody, user: CurrentUser):
    if body.user_id == user["id"]:
        raise HTTPException(400, "Cannot chat with yourself")
    target = await db.users.find_one({"id": body.user_id, "deleted_at": None})
    if not target:
        raise HTTPException(404, "User not found")
    if await db.blocked_users.find_one(
        {"$or": [
            {"blocker_id": user["id"], "blocked_id": body.user_id},
            {"blocker_id": body.user_id, "blocked_id": user["id"]},
        ]}
    ):
        raise HTTPException(403, "Unavailable")
    existing = await db.conversations.find_one(
        {"type": "direct", "members": {"$all": [user["id"], body.user_id], "$size": 2}, "deleted_at": None}
    )
    if existing:
        return await _serialize_conversation(existing, user["id"])
    conv = {
        "id": str(uuid.uuid4()),
        "type": "direct",
        "name": None,
        "image_url": None,
        "description": "",
        "members": [user["id"], body.user_id],
        "admins": [],
        "created_by": user["id"],
        "last_message": None,
        "pinned_message_ids": [],
        "member_settings": {},
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "deleted_at": None,
    }
    await db.conversations.insert_one(conv)
    return await _serialize_conversation(conv, user["id"])


class GroupBody(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    member_ids: list[str] = Field(default_factory=list)
    image_url: str | None = None
    description: str = ""


@router.post("/conversations/group", status_code=201)
async def create_group(body: GroupBody, user: CurrentUser):
    members = list({user["id"], *body.member_ids})
    conv = {
        "id": str(uuid.uuid4()),
        "type": "group",
        "name": body.name.strip(),
        "image_url": body.image_url,
        "description": body.description[:300],
        "members": members,
        "admins": [user["id"]],
        "created_by": user["id"],
        "last_message": None,
        "pinned_message_ids": [],
        "member_settings": {},
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "deleted_at": None,
    }
    await db.conversations.insert_one(conv)
    await _system_message(conv["id"], members, f"{user['display_name']} created the group")
    await manager.send_to_users(members, {"type": "conversation:new", "conversation_id": conv["id"]})
    return await _serialize_conversation(conv, user["id"])


@router.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str, user: CurrentUser):
    conv = await require_member(conversation_id, user["id"])
    return await _serialize_conversation(conv, user["id"])


class GroupUpdate(BaseModel):
    name: str | None = None
    image_url: str | None = None
    description: str | None = None


@router.patch("/conversations/{conversation_id}")
async def update_group(conversation_id: str, body: GroupUpdate, user: CurrentUser):
    conv = await require_member(conversation_id, user["id"])
    if conv["type"] != "group" or user["id"] not in conv.get("admins", []):
        raise HTTPException(403, "Only group admins can edit")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        updates["updated_at"] = now_iso()
        await db.conversations.update_one({"id": conversation_id}, {"$set": updates})
    fresh = await db.conversations.find_one({"id": conversation_id})
    await manager.send_to_users(fresh["members"], {"type": "conversation:update", "conversation_id": conversation_id})
    return await _serialize_conversation(fresh, user["id"])


class MembersBody(BaseModel):
    user_ids: list[str]


@router.post("/conversations/{conversation_id}/members")
async def add_members(conversation_id: str, body: MembersBody, user: CurrentUser):
    conv = await require_member(conversation_id, user["id"])
    if conv["type"] != "group" or user["id"] not in conv.get("admins", []):
        raise HTTPException(403, "Only group admins can add members")
    new_members = list({*conv["members"], *body.user_ids})
    await db.conversations.update_one(
        {"id": conversation_id}, {"$set": {"members": new_members, "updated_at": now_iso()}}
    )
    added = await db.users.find({"id": {"$in": body.user_ids}}).to_list(50)
    names = ", ".join(a["display_name"] for a in added) or "members"
    await _system_message(conversation_id, new_members, f"{user['display_name']} added {names}")
    await manager.send_to_users(new_members, {"type": "conversation:update", "conversation_id": conversation_id})
    fresh = await db.conversations.find_one({"id": conversation_id})
    return await _serialize_conversation(fresh, user["id"])


@router.delete("/conversations/{conversation_id}/members/{member_id}")
async def remove_member(conversation_id: str, member_id: str, user: CurrentUser):
    conv = await require_member(conversation_id, user["id"])
    is_admin = user["id"] in conv.get("admins", [])
    is_self = member_id == user["id"]
    if not (is_admin or is_self):
        raise HTTPException(403, "Not allowed")
    members = [m for m in conv["members"] if m != member_id]
    admins = [a for a in conv.get("admins", []) if a != member_id]
    await db.conversations.update_one(
        {"id": conversation_id}, {"$set": {"members": members, "admins": admins, "updated_at": now_iso()}}
    )
    verb = "left the group" if is_self else "was removed"
    target_name = user["display_name"] if is_self else (await db.users.find_one({"id": member_id}) or {}).get("display_name", "A member")
    await _system_message(conversation_id, members, f"{target_name} {verb}")
    await manager.send_to_users(conv["members"], {"type": "conversation:update", "conversation_id": conversation_id})
    return {"ok": True}


@router.post("/conversations/{conversation_id}/admins/{member_id}")
async def promote_admin(conversation_id: str, member_id: str, user: CurrentUser):
    conv = await require_member(conversation_id, user["id"])
    if user["id"] not in conv.get("admins", []):
        raise HTTPException(403, "Only admins can promote")
    if member_id not in conv["members"]:
        raise HTTPException(400, "Not a member")
    admins = list({*conv.get("admins", []), member_id})
    await db.conversations.update_one({"id": conversation_id}, {"$set": {"admins": admins}})
    await manager.send_to_users(conv["members"], {"type": "conversation:update", "conversation_id": conversation_id})
    return {"ok": True}


class SettingsBody(BaseModel):
    muted: bool | None = None
    cleared: bool | None = None


@router.patch("/conversations/{conversation_id}/settings")
async def update_settings(conversation_id: str, body: SettingsBody, user: CurrentUser):
    conv = await require_member(conversation_id, user["id"])
    ms = conv.get("member_settings", {})
    mine = ms.get(user["id"], {})
    if body.muted is not None:
        mine["muted"] = body.muted
    if body.cleared:
        mine["cleared_at"] = now_iso()
    ms[user["id"]] = mine
    await db.conversations.update_one({"id": conversation_id}, {"$set": {"member_settings": ms}})
    return {"ok": True, "muted": bool(mine.get("muted"))}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user: CurrentUser):
    conv = await require_member(conversation_id, user["id"])
    ms = conv.get("member_settings", {})
    mine = ms.get(user["id"], {})
    mine["cleared_at"] = now_iso()
    ms[user["id"]] = mine
    await db.conversations.update_one({"id": conversation_id}, {"$set": {"member_settings": ms}})
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Messages                                                                     #
# --------------------------------------------------------------------------- #
async def _system_message(conversation_id: str, members: list[str], text: str) -> None:
    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": None,
        "type": "system",
        "text": text,
        "attachment": None,
        "reply_to": None,
        "is_forwarded": False,
        "reactions": [],
        "read_by": [],
        "is_edited": False,
        "is_pinned": False,
        "created_at": now_iso(),
        "deleted_at": None,
    }
    await db.messages.insert_one(msg)
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"last_message": {"text": text, "sender_id": None, "type": "system", "created_at": msg["created_at"]}, "updated_at": msg["created_at"]}},
    )
    await manager.send_to_users(members, {"type": "message:new", "conversation_id": conversation_id, "message": clean(dict(msg))})


class Attachment(BaseModel):
    url: str
    name: str | None = None
    size: int | None = None
    mime: str | None = None
    duration: float | None = None
    width: int | None = None
    height: int | None = None
    thumbnail_url: str | None = None
    contact_id: str | None = None
    contact_username: str | None = None
    contact_avatar: str | None = None


class MessageBody(BaseModel):
    type: str = "text"
    text: str = ""
    attachment: Attachment | None = None
    reply_to: str | None = None
    is_forwarded: bool = False
    client_id: str | None = None


@router.get("/conversations/{conversation_id}/messages")
async def list_messages(
    conversation_id: str,
    user: CurrentUser,
    before: str | None = Query(default=None),
    limit: int = Query(default=30, le=50),
):
    conv = await require_member(conversation_id, user["id"])
    ms = conv.get("member_settings", {}).get(user["id"], {})
    q: dict = {"conversation_id": conversation_id, "deleted_at": None}
    cleared = ms.get("cleared_at")
    if cleared:
        q["created_at"] = {"$gt": cleared}
    if before:
        q.setdefault("created_at", {})
        q["created_at"]["$lt"] = before
    cursor = db.messages.find(q).sort("created_at", -1).limit(limit)
    msgs = [clean(m) async for m in cursor]
    msgs.reverse()
    return {"messages": msgs, "has_more": len(msgs) == limit}


@router.post("/conversations/{conversation_id}/messages", status_code=201)
async def send_message(conversation_id: str, body: MessageBody, user: CurrentUser):
    conv = await require_member(conversation_id, user["id"])
    if conv["type"] == "direct":
        other = next((m for m in conv["members"] if m != user["id"]), None)
        if other and await db.blocked_users.find_one(
            {"$or": [
                {"blocker_id": other, "blocked_id": user["id"]},
                {"blocker_id": user["id"], "blocked_id": other},
            ]}
        ):
            raise HTTPException(403, "You cannot message this user")
    msg = {
        "id": str(uuid.uuid4()),
        "conversation_id": conversation_id,
        "sender_id": user["id"],
        "type": body.type,
        "text": body.text,
        "attachment": body.attachment.model_dump() if body.attachment else None,
        "reply_to": body.reply_to,
        "is_forwarded": body.is_forwarded,
        "reactions": [],
        "read_by": [user["id"]],
        "is_edited": False,
        "is_pinned": False,
        "client_id": body.client_id,
        "created_at": now_iso(),
        "deleted_at": None,
    }
    await db.messages.insert_one(msg)
    preview = body.text or {"image": "📷 Photo", "video": "🎥 Video", "voice": "🎤 Voice message", "file": "📄 Document", "contact": "👤 Contact"}.get(body.type, "Message")
    await db.conversations.update_one(
        {"id": conversation_id},
        {"$set": {"last_message": {"text": preview, "sender_id": user["id"], "type": body.type, "created_at": msg["created_at"]}, "updated_at": msg["created_at"]}},
    )
    out = clean(dict(msg))
    await manager.send_to_users(conv["members"], {"type": "message:new", "conversation_id": conversation_id, "message": out})
    return out


class EditBody(BaseModel):
    text: str = Field(min_length=1)


@router.patch("/messages/{message_id}")
async def edit_message(message_id: str, body: EditBody, user: CurrentUser):
    msg = await db.messages.find_one({"id": message_id, "deleted_at": None})
    if not msg:
        raise HTTPException(404, "Message not found")
    if msg["sender_id"] != user["id"]:
        raise HTTPException(403, "You can only edit your own messages")
    await db.messages.update_one(
        {"id": message_id}, {"$set": {"text": body.text, "is_edited": True, "edited_at": now_iso()}}
    )
    members = (await db.conversations.find_one({"id": msg["conversation_id"]}, {"members": 1}))["members"]
    await manager.send_to_users(members, {"type": "message:update", "conversation_id": msg["conversation_id"], "message_id": message_id, "text": body.text, "is_edited": True})
    return {"ok": True}


@router.delete("/messages/{message_id}")
async def delete_message(message_id: str, user: CurrentUser):
    msg = await db.messages.find_one({"id": message_id, "deleted_at": None})
    if not msg:
        raise HTTPException(404, "Message not found")
    if msg["sender_id"] != user["id"]:
        raise HTTPException(403, "You can only delete your own messages")
    await db.messages.update_one({"id": message_id}, {"$set": {"deleted_at": now_iso(), "text": "", "attachment": None, "type": "deleted"}})
    members = (await db.conversations.find_one({"id": msg["conversation_id"]}, {"members": 1}))["members"]
    await manager.send_to_users(members, {"type": "message:delete", "conversation_id": msg["conversation_id"], "message_id": message_id})
    return {"ok": True}


class ReactBody(BaseModel):
    emoji: str


@router.post("/messages/{message_id}/react")
async def react_message(message_id: str, body: ReactBody, user: CurrentUser):
    msg = await db.messages.find_one({"id": message_id, "deleted_at": None})
    if not msg:
        raise HTTPException(404, "Message not found")
    reactions = [r for r in msg.get("reactions", []) if r["user_id"] != user["id"]]
    existing = next((r for r in msg.get("reactions", []) if r["user_id"] == user["id"]), None)
    if not (existing and existing["emoji"] == body.emoji):
        reactions.append({"user_id": user["id"], "emoji": body.emoji})
    await db.messages.update_one({"id": message_id}, {"$set": {"reactions": reactions}})
    members = (await db.conversations.find_one({"id": msg["conversation_id"]}, {"members": 1}))["members"]
    await manager.send_to_users(members, {"type": "message:react", "conversation_id": msg["conversation_id"], "message_id": message_id, "reactions": reactions})
    return {"reactions": reactions}


@router.post("/messages/{message_id}/pin")
async def pin_message(message_id: str, user: CurrentUser):
    msg = await db.messages.find_one({"id": message_id, "deleted_at": None})
    if not msg:
        raise HTTPException(404, "Message not found")
    conv = await require_member(msg["conversation_id"], user["id"])
    pinned = list({*conv.get("pinned_message_ids", []), message_id})
    await db.messages.update_one({"id": message_id}, {"$set": {"is_pinned": True}})
    await db.conversations.update_one({"id": conv["id"]}, {"$set": {"pinned_message_ids": pinned}})
    await manager.send_to_users(conv["members"], {"type": "conversation:update", "conversation_id": conv["id"]})
    return {"ok": True}


@router.delete("/messages/{message_id}/pin")
async def unpin_message(message_id: str, user: CurrentUser):
    msg = await db.messages.find_one({"id": message_id})
    if not msg:
        raise HTTPException(404, "Message not found")
    conv = await require_member(msg["conversation_id"], user["id"])
    pinned = [p for p in conv.get("pinned_message_ids", []) if p != message_id]
    await db.messages.update_one({"id": message_id}, {"$set": {"is_pinned": False}})
    await db.conversations.update_one({"id": conv["id"]}, {"$set": {"pinned_message_ids": pinned}})
    await manager.send_to_users(conv["members"], {"type": "conversation:update", "conversation_id": conv["id"]})
    return {"ok": True}


class ForwardBody(BaseModel):
    conversation_ids: list[str]


@router.post("/messages/{message_id}/forward")
async def forward_message(message_id: str, body: ForwardBody, user: CurrentUser):
    src = await db.messages.find_one({"id": message_id, "deleted_at": None})
    if not src:
        raise HTTPException(404, "Message not found")
    for cid in body.conversation_ids:
        conv = await db.conversations.find_one({"id": cid, "deleted_at": None})
        if not conv or user["id"] not in conv.get("members", []):
            continue
        msg = {
            "id": str(uuid.uuid4()),
            "conversation_id": cid,
            "sender_id": user["id"],
            "type": src["type"],
            "text": src.get("text", ""),
            "attachment": src.get("attachment"),
            "reply_to": None,
            "is_forwarded": True,
            "reactions": [],
            "read_by": [user["id"]],
            "is_edited": False,
            "is_pinned": False,
            "created_at": now_iso(),
            "deleted_at": None,
        }
        await db.messages.insert_one(msg)
        preview = src.get("text") or "Forwarded message"
        await db.conversations.update_one(
            {"id": cid},
            {"$set": {"last_message": {"text": preview, "sender_id": user["id"], "type": src["type"], "created_at": msg["created_at"]}, "updated_at": msg["created_at"]}},
        )
        await manager.send_to_users(conv["members"], {"type": "message:new", "conversation_id": cid, "message": clean(dict(msg))})
    return {"ok": True}


@router.post("/conversations/{conversation_id}/read")
async def mark_read(conversation_id: str, user: CurrentUser):
    conv = await require_member(conversation_id, user["id"])
    if not user.get("privacy", {}).get("read_receipts", True):
        # still clear own unread locally but don't broadcast receipts
        await db.messages.update_many(
            {"conversation_id": conversation_id, "read_by": {"$ne": user["id"]}},
            {"$addToSet": {"read_by": user["id"]}},
        )
        return {"ok": True}
    await db.messages.update_many(
        {"conversation_id": conversation_id, "read_by": {"$ne": user["id"]}},
        {"$addToSet": {"read_by": user["id"]}},
    )
    await manager.send_to_users(conv["members"], {"type": "message:read", "conversation_id": conversation_id, "user_id": user["id"]})
    return {"ok": True}


# --------------------------------------------------------------------------- #
# File upload / download (Object Storage)                                      #
# --------------------------------------------------------------------------- #
@router.post("/upload")
async def upload_file(user: CurrentUser, file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "File too large (max 30MB)")
    ext = (file.filename or "file").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4()}.{ext}"
    try:
        await run_in_threadpool(put_object, path, data, content_type)
    except Exception as e:  # noqa: BLE001
        msg = str(e)
        if "402" in msg:
            raise HTTPException(402, "Storage limit reached")
        raise HTTPException(502, "Upload failed")
    await db.attachments.insert_one(
        {
            "id": str(uuid.uuid4()),
            "owner_id": user["id"],
            "path": path,
            "name": file.filename,
            "mime": content_type,
            "size": len(data),
            "created_at": now_iso(),
        }
    )
    return {"path": path, "url": f"/api/files/{path}", "mime": content_type, "size": len(data), "name": file.filename}


async def _authed_media_user(request: Request, authorization: str | None, token: str | None) -> dict:
    tok = None
    if authorization and authorization.lower().startswith("bearer "):
        tok = authorization.split(" ", 1)[1]
    elif token:
        tok = token
    if not tok:
        raise HTTPException(401, "Not authenticated")
    return await get_user_by_token(tok)


@router.get("/files/{path:path}")
async def download_file(
    path: str,
    request: Request,
    authorization: str | None = Header(default=None),
    token: str | None = Query(default=None),
):
    user = await _authed_media_user(request, authorization, token)
    att = await db.attachments.find_one({"path": path})
    if not att:
        raise HTTPException(404, "Not found")
    if att["owner_id"] != user["id"]:
        # allow if requester is a member of a conversation containing this file
        msg = await db.messages.find_one({"attachment.url": f"/api/files/{path}"})
        if not msg:
            raise HTTPException(403, "Not allowed")
        conv = await db.conversations.find_one({"id": msg["conversation_id"], "members": user["id"]})
        if not conv:
            raise HTTPException(403, "Not allowed")
    try:
        content, ctype = await run_in_threadpool(get_object, path)
    except Exception:  # noqa: BLE001
        raise HTTPException(404, "Not found")
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "public, max-age=31536000"})
