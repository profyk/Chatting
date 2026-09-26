from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..core import CurrentUser, db, now_iso, public_user
from ..translation import LANGUAGES, translate

router = APIRouter(tags=["vip"])


@router.get("/vip/languages")
async def languages():
    return [{"code": k, "name": v} for k, v in LANGUAGES.items()]


@router.get("/vip/status")
async def vip_status(user: CurrentUser):
    return {"is_vip": bool(user.get("is_vip")), "vip_since": user.get("vip_since")}


@router.post("/vip/subscribe")
async def subscribe(user: CurrentUser):
    # v1: instant activation (billing wired later via Stripe/RevenueCat).
    await db.users.update_one(
        {"id": user["id"]}, {"$set": {"is_vip": True, "vip_since": now_iso()}}
    )
    return {"is_vip": True, "vip_since": now_iso()}


@router.post("/vip/cancel")
async def cancel(user: CurrentUser):
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_vip": False}})
    return {"is_vip": False}


class TranslateBody(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    target_lang: str
    source_lang: str | None = None
    message_id: str | None = None


@router.post("/vip/translate")
async def translate_text(body: TranslateBody, user: CurrentUser):
    # Feature-gated in the backend: only VIP users may translate.
    if not user.get("is_vip"):
        raise HTTPException(403, "Ditsala VIP is required for translation")
    # Usage metering (no message CONTENT stored — privacy model).
    await db.vip_usage.insert_one(
        {
            "user_id": user["id"],
            "target_lang": body.target_lang,
            "chars": len(body.text),
            "created_at": now_iso(),
        }
    )
    result = await translate(body.text, body.target_lang, body.source_lang)
    return result
