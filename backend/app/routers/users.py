import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..core import CurrentUser, db, now_iso, public_user
from ..realtime import manager

router = APIRouter(tags=["users"])


# --------------------------------------------------------------------------- #
# Profile                                                                      #
# --------------------------------------------------------------------------- #
class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=50)
    bio: str | None = Field(default=None, max_length=160)
    avatar_url: str | None = None
    preferred_language: str | None = None


class PrivacyUpdate(BaseModel):
    profile: str | None = None
    message: str | None = None
    call: str | None = None
    read_receipts: bool | None = None
    online_status: bool | None = None
    auto_translate: bool | None = None


@router.patch("/users/me")
async def update_me(body: ProfileUpdate, user: CurrentUser):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    fresh = await db.users.find_one({"id": user["id"]})
    return public_user(fresh, include_email=True)


@router.patch("/users/me/privacy")
async def update_privacy(body: PrivacyUpdate, user: CurrentUser):
    privacy = user.get("privacy", {}).copy()
    for k, v in body.model_dump().items():
        if v is not None:
            privacy[k] = v
    await db.users.update_one({"id": user["id"]}, {"$set": {"privacy": privacy}})
    return privacy


@router.get("/users/search")
async def search_users(user: CurrentUser, q: str = Query(min_length=1, max_length=50)):
    term = q.strip().lower()
    blocked = await _blocked_set(user["id"])
    cursor = db.users.find(
        {
            "deleted_at": None,
            "status": "active",
            "id": {"$ne": user["id"], "$nin": list(blocked)},
            "$or": [
                {"username": {"$regex": f"^{term}", "$options": "i"}},
                {"display_name": {"$regex": term, "$options": "i"}},
                {"email": term},
            ],
        },
        limit=30,
    )
    results = []
    async for u in cursor:
        pu = public_user(u)
        pu["is_online"] = manager.is_online(u["id"]) if u.get("privacy", {}).get("online_status", True) else False
        results.append(pu)
    return results


@router.get("/users/{user_id}")
async def get_user(user_id: str, user: CurrentUser):
    target = await db.users.find_one({"id": user_id, "deleted_at": None})
    if not target:
        raise HTTPException(404, "User not found")
    if await _is_blocked_either_way(user["id"], user_id):
        raise HTTPException(403, "Unavailable")
    pu = public_user(target)
    pu["is_online"] = manager.is_online(user_id) if target.get("privacy", {}).get("online_status", True) else False
    pu["is_contact"] = bool(
        await db.contacts.find_one({"owner_id": user["id"], "contact_id": user_id, "deleted_at": None})
    )
    pu["is_blocked"] = bool(
        await db.blocked_users.find_one({"blocker_id": user["id"], "blocked_id": user_id})
    )
    return pu


# --------------------------------------------------------------------------- #
# Contacts                                                                     #
# --------------------------------------------------------------------------- #
@router.get("/contacts")
async def list_contacts(user: CurrentUser):
    out = []
    async for c in db.contacts.find({"owner_id": user["id"], "deleted_at": None}):
        u = await db.users.find_one({"id": c["contact_id"], "deleted_at": None})
        if not u:
            continue
        pu = public_user(u)
        pu["is_online"] = manager.is_online(u["id"]) if u.get("privacy", {}).get("online_status", True) else False
        out.append(pu)
    out.sort(key=lambda x: x["display_name"].lower())
    return out


class AddContact(BaseModel):
    contact_id: str


@router.post("/contacts", status_code=201)
async def add_contact(body: AddContact, user: CurrentUser):
    if body.contact_id == user["id"]:
        raise HTTPException(400, "Cannot add yourself")
    target = await db.users.find_one({"id": body.contact_id, "deleted_at": None})
    if not target:
        raise HTTPException(404, "User not found")
    existing = await db.contacts.find_one({"owner_id": user["id"], "contact_id": body.contact_id})
    if existing:
        await db.contacts.update_one({"id": existing["id"]}, {"$set": {"deleted_at": None}})
    else:
        await db.contacts.insert_one(
            {
                "id": str(uuid.uuid4()),
                "owner_id": user["id"],
                "contact_id": body.contact_id,
                "created_at": now_iso(),
                "deleted_at": None,
            }
        )
    return {"ok": True}


@router.delete("/contacts/{contact_id}")
async def remove_contact(contact_id: str, user: CurrentUser):
    await db.contacts.update_one(
        {"owner_id": user["id"], "contact_id": contact_id},
        {"$set": {"deleted_at": now_iso()}},
    )
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Blocking + reporting                                                         #
# --------------------------------------------------------------------------- #
async def _blocked_set(user_id: str) -> set[str]:
    ids = set()
    async for b in db.blocked_users.find({"blocker_id": user_id}):
        ids.add(b["blocked_id"])
    return ids


async def _is_blocked_either_way(a: str, b: str) -> bool:
    return bool(
        await db.blocked_users.find_one(
            {"$or": [{"blocker_id": a, "blocked_id": b}, {"blocker_id": b, "blocked_id": a}]}
        )
    )


class BlockBody(BaseModel):
    user_id: str


@router.post("/block")
async def block_user(body: BlockBody, user: CurrentUser):
    if body.user_id == user["id"]:
        raise HTTPException(400, "Cannot block yourself")
    if not await db.blocked_users.find_one({"blocker_id": user["id"], "blocked_id": body.user_id}):
        await db.blocked_users.insert_one(
            {
                "id": str(uuid.uuid4()),
                "blocker_id": user["id"],
                "blocked_id": body.user_id,
                "created_at": now_iso(),
            }
        )
    return {"ok": True}


@router.delete("/block/{user_id}")
async def unblock_user(user_id: str, user: CurrentUser):
    await db.blocked_users.delete_one({"blocker_id": user["id"], "blocked_id": user_id})
    return {"ok": True}


@router.get("/block")
async def list_blocked(user: CurrentUser):
    out = []
    for uid in await _blocked_set(user["id"]):
        u = await db.users.find_one({"id": uid, "deleted_at": None})
        if u:
            out.append(public_user(u))
    return out


class ReportBody(BaseModel):
    target_type: str  # user | message | group
    target_id: str
    reason: str
    details: str = ""


@router.post("/reports", status_code=201)
async def create_report(body: ReportBody, user: CurrentUser):
    await db.reports.insert_one(
        {
            "id": str(uuid.uuid4()),
            "reporter_id": user["id"],
            "target_type": body.target_type,
            "target_id": body.target_id,
            "reason": body.reason,
            "details": body.details[:1000],
            "status": "open",
            "created_at": now_iso(),
        }
    )
    return {"ok": True}
