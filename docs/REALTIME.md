# Ditsala — Realtime

## Transport
One authenticated WebSocket per client: `wss://<host>/api/ws?token=<jwt>`. On connect the server marks
the user online and notifies peers; on disconnect (last socket) it marks offline. Multiple devices per user
are supported (a set of sockets per user id). Client auto-reconnects with backoff.

## Server → client events
- `presence` {user_id, is_online, last_seen}
- `typing` {conversation_id, user_id, is_typing}
- `message:new` {conversation_id, message}
- `message:update` {message_id, text, is_edited}
- `message:delete` {message_id}
- `message:react` {message_id, reactions}
- `message:read` {conversation_id, user_id}
- `conversation:new` / `conversation:update` {conversation_id}
- `call:incoming` {call, caller} · `call:update` {call_id, status, by} · `call:signal` (WebRTC relay)

## Client → server messages
- `typing` {conversation_id, is_typing}
- `call:signal` {to[], call_id, signal} — relayed to peers for future WebRTC SDP/ICE exchange
- `ping` → `pong`

## Delivery correctness
- Client dedupes messages by `id` (POST response + realtime echo cannot duplicate).
- Messages kept sorted by `created_at`; date separators derived client-side.
- Read receipts respect the sender's `privacy.read_receipts`.

## Scaling
`ConnectionManager` is in-process (one worker). For multi-worker/horizontal scale, back it with Redis
pub/sub (publish events to a channel, each worker fans out to its local sockets).
