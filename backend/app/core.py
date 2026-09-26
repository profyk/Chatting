"""Core: settings, database, security primitives and shared dependencies.

Sensitive data separation (documented in docs/SECURITY.md):
  - Authentication data (password_hash) lives on the user document but is NEVER
    returned by any endpoint (see public_user()).
  - Message CONTENT is stored separately from message METADATA conceptually and
    is never written to application logs.
"""
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ISSUER = os.environ.get("JWT_ISSUER", "ditsala-api")
JWT_AUDIENCE = os.environ.get("JWT_AUDIENCE", "ditsala-mobile")
ACCESS_TOKEN_MINUTES = 60 * 24 * 30  # 30 days for mobile UX (single access token v1)

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

bearer = HTTPBearer(auto_error=False)


# --------------------------------------------------------------------------- #
# Password hashing (bcrypt)                                                    #
# --------------------------------------------------------------------------- #
def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(400, "Password must be at most 72 bytes")
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False


# --------------------------------------------------------------------------- #
# JWT                                                                          #
# --------------------------------------------------------------------------- #
def make_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "type": "access",
            "iss": JWT_ISSUER,
            "aud": JWT_AUDIENCE,
            "iat": now,
            "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        },
        JWT_SECRET,
        algorithm="HS256",
    )


def decode_token(token: str) -> str:
    """Return the user id (sub) for a valid access token, else raise."""
    payload = jwt.decode(
        token,
        JWT_SECRET,
        algorithms=["HS256"],
        issuer=JWT_ISSUER,
        audience=JWT_AUDIENCE,
        options={"require": ["sub", "type", "iss", "aud", "iat", "exp"]},
    )
    if payload.get("type") != "access":
        raise InvalidTokenError("wrong token type")
    return payload["sub"]


# --------------------------------------------------------------------------- #
# Current user dependency                                                      #
# --------------------------------------------------------------------------- #
UNAUTH = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_user_by_token(token: str) -> dict:
    try:
        uid = decode_token(token)
    except (InvalidTokenError, KeyError, TypeError, ValueError):
        raise UNAUTH
    user = await db.users.find_one({"id": uid, "deleted_at": None})
    if not user:
        raise UNAUTH
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended")
    return user


async def current_user(
    auth: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)],
) -> dict:
    if not auth or auth.scheme.lower() != "bearer":
        raise UNAUTH
    return await get_user_by_token(auth.credentials)


CurrentUser = Annotated[dict, Depends(current_user)]


# --------------------------------------------------------------------------- #
# Public projections (never leak password_hash / email to third parties)      #
# --------------------------------------------------------------------------- #
def public_user(u: dict, *, include_email: bool = False) -> dict:
    if not u:
        return {}
    out = {
        "id": u["id"],
        "display_name": u.get("display_name", ""),
        "username": u.get("username", ""),
        "bio": u.get("bio", ""),
        "avatar_url": u.get("avatar_url"),
        "preferred_language": u.get("preferred_language", "en"),
        "is_online": bool(u.get("is_online")) if u.get("privacy", {}).get("online_status", True) else False,
        "last_seen": u.get("last_seen"),
        "is_vip": bool(u.get("is_vip")),
        "status": u.get("status", "active"),
    }
    if include_email:
        out["email"] = u.get("email")
        out["privacy"] = u.get("privacy", {})
        out["push_settings"] = u.get("push_settings", {})
    return out


# --------------------------------------------------------------------------- #
# Simple in-memory rate limiter (per key). Architecture placeholder; swap for  #
# Redis token-bucket in production.                                            #
# --------------------------------------------------------------------------- #
_hits: dict[str, list[float]] = {}


def rate_limit(key: str, limit: int, window_seconds: int) -> None:
    now = time.time()
    bucket = [t for t in _hits.get(key, []) if now - t < window_seconds]
    if len(bucket) >= limit:
        raise HTTPException(status_code=429, detail="Too many requests, slow down")
    bucket.append(now)
    _hits[key] = bucket


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
