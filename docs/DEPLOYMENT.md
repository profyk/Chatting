# Ditsala — Deployment

## Preview vs Production
- This container is the PREVIEW environment. Deploy with the **Publish** button (top-right).
- After deploying, generate iOS/Android builds from the deployment panel (Emergent-managed EAS).
- The mobile app has no hosted web frontend; test the deployed app via the Expo Go QR in the deploy panel.

## Environment variables
Backend (`backend/.env`, copied to deployment secrets on first deploy):
- `MONGO_URL`, `DB_NAME` (managed) — do not change.
- `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE` — auth signing.
- `EMERGENT_LLM_KEY` — Claude Sonnet 5 translation + Object Storage.
- `INTEGRATION_PROXY_URL` — set by platform for Object Storage.
- (optional) `TRANSLATION_PROVIDER` — provider selector (default `claude`).

Frontend (`frontend/.env`, managed):
- `EXPO_PUBLIC_BACKEND_URL`, `EXPO_PACKAGER_*` — do not change.

Never hardcode secrets. Only `backend/.env` holds sensitive keys; the mobile bundle sees only
`EXPO_PUBLIC_BACKEND_URL`.

## Services
- backend: `uvicorn server:app --host 0.0.0.0 --port 8001`
- frontend: `expo start --port 3000`
- mongodb: local instance via `MONGO_URL`

## Future providers to configure at build time
- WebRTC (Agora/Twilio/LiveKit) for real audio/video.
- Push notifications (Emergent-managed) — requires a native build.
