import re
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

from ..core import (
    CurrentUser,
    hash_password,
    make_token,
    now_iso,
    public_user,
    rate_limit,
    verify_password,
)
from ..core import db

router = APIRouter(prefix="/auth", tags=["auth"])

DEFAULT_PRIVACY = {
    "profile": "everyone",
    "message": "everyone",
    "call": "everyone",
    "read_receipts": True,
    "online_status": True,
    "auto_translate": False,
}

USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    display_name: str = Field(min_length=1, max_length=50)
    username: str = Field(min_length=3, max_length=20)
    preferred_language: str = "en"


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


def _email_key(email: str) -> str:
    return str(email).strip().lower()


@router.post("/register", status_code=201)
async def register(body: RegisterBody):
    rate_limit(f"register:{_email_key(str(body.email))}", limit=5, window_seconds=3600)
    email = _email_key(str(body.email))
    username = body.username.strip().lower()
    if not USERNAME_RE.match(username):
        raise HTTPException(400, "Username must be 3-20 chars: a-z, 0-9, underscore")

    if await db.users.find_one({"email": email, "deleted_at": None}):
        raise HTTPException(409, "Unable to create account")
    if await db.users.find_one({"username": username, "deleted_at": None}):
        raise HTTPException(409, "Username already taken")

    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "display_name": body.display_name.strip(),
        "username": username,
        "bio": "",
        "avatar_url": None,
        "preferred_language": body.preferred_language,
        "is_online": True,
        "last_seen": now_iso(),
        "is_vip": False,
        "vip_since": None,
        "privacy": DEFAULT_PRIVACY.copy(),
        "push_settings": {"messages": True, "calls": True, "groups": True},
        "status": "active",
        "created_at": now_iso(),
        "deleted_at": None,
    }
    await db.users.insert_one(doc)
    return {"access_token": make_token(uid), "token_type": "bearer", "user": public_user(doc, include_email=True)}


@router.post("/login")
async def login(body: LoginBody):
    email = _email_key(str(body.email))
    rate_limit(f"login:{email}", limit=10, window_seconds=900)
    user = await db.users.find_one({"email": email, "deleted_at": None})
    dummy = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.6QePzQJb8M8C6YJw3x0J5m2J7x1K5uG"
    if not user or not verify_password(body.password, user.get("password_hash", dummy)):
        raise HTTPException(401, "Invalid email or password")
    if user.get("status") == "suspended":
        raise HTTPException(403, "Account suspended")
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_online": True, "last_seen": now_iso()}})
    return {"access_token": make_token(user["id"]), "token_type": "bearer", "user": public_user(user, include_email=True)}


@router.get("/me")
async def me(user: CurrentUser):
    return public_user(user, include_email=True)


class UsernameCheck(BaseModel):
    username: str


@router.post("/check-username")
async def check_username(body: UsernameCheck):
    username = body.username.strip().lower()
    if not USERNAME_RE.match(username):
        return {"available": False, "reason": "invalid"}
    exists = await db.users.find_one({"username": username, "deleted_at": None})
    return {"available": not exists}
