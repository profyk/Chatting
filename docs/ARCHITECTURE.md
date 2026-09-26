# Ditsala — Architecture

Ditsala is a real-time chat platform. This build runs on the Emergent stack:
**Expo (React Native + TypeScript) mobile client · FastAPI backend · MongoDB · WebSocket realtime · Emergent Object Storage · Claude Sonnet 5 translation.**

## Mobile (frontend/)
- `app/` — expo-router file routes: `(auth)/`, `(tabs)/`, `chat/[id]`, `user/[id]`, `group/[id]`,
  `call/[id]`, `new-chat`, `new-group`, `profile-edit`, `vip`, `privacy`, `blocked`.
- `src/` — `theme.ts` (light+dark tokens), `api.ts` (fetch + token + upload/media),
  `auth.tsx` (JWT session), `realtime.tsx` (WebSocket + presence + event bus),
  `toast.tsx`, `components/` (ui, chat/MessageBubble, chat/Composer, Header, IncomingCall).
- Server state via `@tanstack/react-query`; realtime events invalidate/patch caches.

## Backend (backend/app/)
- `core.py` — settings, Mongo client, bcrypt, JWT, `current_user`, public projections, rate limiter.
- `realtime.py` — `ConnectionManager` (presence + fan-out), `set_presence`, `peers_of`.
- `storage.py` — Object Storage handshake (init → storage_key → objects).
- `translation.py` — provider abstraction (`TranslationProvider` → `ClaudeTranslationProvider`).
- `routers/` — `auth`, `users` (profile/contacts/block/report), `chats` (conversations/messages/upload),
  `calls`, `vip` (translate + subscription).
- `server.py` — app assembly, indexes on startup, `/api/ws` websocket (typing + call signaling relay).

## Realtime
REST mutations broadcast events (`message:new/update/delete/react/read`, `conversation:*`,
`call:incoming/update`, `presence`, `typing`) to affected users over their WebSocket. See REALTIME.md.

## Scale notes
- Cursor-based message pagination (`before` timestamp, limit 30).
- Compound index `messages(conversation_id, created_at desc)`; `conversations(members)`.
- Realtime is single-worker in-memory; swap `ConnectionManager` for Redis pub/sub to scale horizontally.
