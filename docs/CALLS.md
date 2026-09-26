# Ditsala — Calls

The calling service is modular. v1 ships the full call lifecycle, UI, history and a signaling relay;
real audio/video media requires a production WebRTC provider (Agora / Twilio / LiveKit) wired in a
native build — it does not run in Expo Go / web preview.

## Lifecycle
1. `POST /api/calls {conversation_id, type}` — caller creates a call (status `ringing`); callees get a
   `call:incoming` WebSocket event and see the full-screen incoming call overlay.
2. `PATCH /api/calls/{id} {status}` — `answered` | `declined` | `ended` | `missed` (+ `duration`);
   broadcasts `call:update` to all participants.
3. `GET /api/calls` — call history with direction (incoming/outgoing) and missed flag.

## Client
- `app/call/[id].tsx` — active call screen: avatar, timer, mute / speaker / camera / end controls.
- `IncomingCallOverlay` — global accept/decline overlay driven by `call:incoming`.

## Wiring real media (next phase)
Exchange SDP/ICE over the existing `call:signal` WebSocket relay, attach the provider's RTC engine to
the call screen, and keep `POST/PATCH /calls` for lifecycle + history. Nothing else changes.
