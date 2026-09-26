# Ditsala — Roadmap

## Shipped (v1)
- JWT auth (email + password), profiles, privacy settings, light + dark themes.
- Contacts: search, add/remove, block/unblock, report, contact profiles.
- Real-time 1:1 + group chat: text, emoji, images, voice notes, reply, forward, copy, edit, delete,
  react, pin, message search, read/delivery ticks, typing + recording indicators, date separators,
  unread badges, online/last-seen presence.
- Groups: create, members, admins (promote/remove), edit name/description, mute, leave, report.
- Calls: full UI + history + incoming overlay + signaling relay (media provider pending).
- Ditsala VIP: Claude Sonnet 5 translation across 9 languages, backend feature-gated, usage metering.
- Object Storage for media; cursor pagination; skeletons/empty/error states.

## P1 (next)
- Real WebRTC audio/video (Agora/Twilio/LiveKit) wired to `call:signal`.
- Push notifications (Emergent-managed) for messages/calls/mentions.
- Phone/OTP verification + forgot/reset password email flow (Resend).
- GIF picker, video attachments playback, document viewer, contact sharing.
- Message search across conversations (server-side), starred/pinned views.

## P2
- End-to-end encryption (per-device keys via `user_devices`, ciphertext storage).
- Separate Next.js admin dashboard (see ADMIN.md) with RBAC + MFA.
- Billing for VIP (Stripe/RevenueCat), auto-translate inbound toggle enforcement.
- Redis-backed realtime + horizontal scaling, media thumbnail generation pipeline.
