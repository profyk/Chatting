# Ditsala — PRD

## Original problem statement
Build "Ditsala" (Setswana for *friends*; tagline "Your Trusted Circle"), a production-ready mobile
chatting app: private + group messaging, voice notes, media, calls, real-time, and multilingual
communication (Ditsala VIP), with an African-inspired premium identity. Brand palette from the user's
logo: deep navy #0B1E5B, fresh green #5FB325, warm gold #F5A623 — light + dark mode.

## Chosen stack (Emergent)
Expo (React Native + TypeScript) · FastAPI · MongoDB · WebSocket realtime · Emergent Object Storage ·
Claude Sonnet 5 translation. (Spec mentioned Supabase/Next.js admin; delivered feature-equivalent on
this stack; admin dashboard specified in docs/ADMIN.md for a separate future app.)

## User choices (v1)
Auth = JWT email/password. Translation model = Claude Sonnet 5. Calls = full UI + history + signaling now,
real media later. Theme = logo palette, light + dark.

## Personas
- Everyday user chatting 1:1 and in groups, sending voice notes/photos.
- Cross-language user (VIP) chatting with someone in another language.
- Group admin managing members/permissions.

## Core requirements (static)
Accounts/profiles, contacts (search/add/block/report), real-time 1:1 + group chat with rich message
actions, presence/typing/read receipts, calls, VIP translation, notifications (roadmap), strong access
control (no cross-user access by ID), secrets in env, privacy-aware architecture, docs.

## Implemented (2026-06 — v1)
- JWT auth (register/login/me), profiles + privacy, light/dark theme.
- Contacts: search, add/remove, block/unblock, report, contact profile.
- Real-time chat (WebSocket): text, emoji, images, voice notes, reply, forward, copy, edit, delete,
  react, pin, read/delivery ticks, typing + recording indicators, date separators, unread badges,
  online/last-seen presence, cursor pagination.
- Groups: create, members, admins (promote/remove), edit metadata, mute, leave, report.
- Calls: full UI + history + incoming overlay + signaling relay (media provider pending).
- Ditsala VIP: Claude Sonnet 5 translation (9 languages), backend feature-gated, usage metering.
- Emergent Object Storage for media; skeleton/empty/error states; toasts.
- Docs in /app/docs/*; .env.example files. Tested: 32/32 backend + frontend flows pass.

## Backlog
- P0: none blocking.
- P1: real WebRTC media; push notifications; phone/OTP + password reset (Resend); GIF/video/doc/contact
  attachments; server-side global search.
- P2: end-to-end encryption; separate Next.js admin dashboard (RBAC + MFA); VIP billing
  (Stripe/RevenueCat); Redis-backed realtime scaling; media thumbnails.

## Next tasks
Wire a WebRTC provider to `call:signal`; add push notifications; build attachment types beyond image/voice.
