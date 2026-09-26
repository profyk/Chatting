# Ditsala — Security Model

## Principles
- **No cross-user data access via ID manipulation.** Every conversation/message endpoint calls
  `require_member(conversation_id, user_id)` which verifies the caller is in `conversation.members`
  before returning or mutating anything. A user cannot read another user's private thread by guessing IDs.
- **Auth vs profile vs message separation.**
  - Auth data: `users.password_hash` — bcrypt (cost 12), never returned by any endpoint (`public_user()`).
  - Profile data: display_name, username, bio, avatar, language, privacy — returned via public projection.
  - Message metadata (ids, timestamps, sender, read state) vs message CONTENT (`text`, attachment) are
    handled distinctly; content is never written to application logs.
- **JWT** HS256, signed with `JWT_SECRET` (env only), with `iss`/`aud`/`exp` claims required and verified.
  Algorithm allow-list is explicit (`["HS256"]`).
- **Secrets** (`JWT_SECRET`, `EMERGENT_LLM_KEY`, `MONGO_URL`) live only in `backend/.env`. Nothing sensitive
  is exposed to the mobile bundle; the app only knows `EXPO_PUBLIC_BACKEND_URL`.

## Access control matrix
- Messages: sender-only edit/delete. Any member may react/pin/reply/forward within their conversations.
- Groups: only `admins` may edit metadata, add/remove members, promote admins.
- Blocking: two-way block prevents direct conversation creation and messaging.
- Media download: `/api/files/{path}` checks the caller owns the attachment OR is a member of a
  conversation referencing it.

## Input validation & abuse prevention
- Pydantic schemas validate every request body; username regex `^[a-z0-9_]{3,20}$`.
- File uploads capped at 30 MB; content-type recorded.
- In-memory rate limiter on register/login (swap for Redis token-bucket at scale).
- User reporting (`/api/reports`) and blocking (`/api/block`) for moderation.

## End-to-end encryption (roadmap)
v1 is transport-encrypted (HTTPS/WSS) with server-side storage. The schema keeps message content
isolated so a future phase can store per-device public keys (`user_devices`) and ciphertext without
schema churn. Admin tooling is designed to never surface message content.
