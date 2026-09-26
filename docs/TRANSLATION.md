# Ditsala — Translation (VIP)

Ditsala VIP lets people chat across languages. The chat app depends only on a small surface
(`translate()`), decoupled from any provider.

## Module (backend/app/translation.py)
- `TranslationProvider` (ABC) → `ClaudeTranslationProvider` (Claude Sonnet 5 via Emergent LLM key).
- `get_provider()` selects by `TRANSLATION_PROVIDER` env (default `claude`). Add e.g. an
  `AzureTranslationProvider` and register it in `_PROVIDERS` to swap without touching chat code.
- `translate(text, target_lang, source_lang)` → `{text, provider, target_lang}`.

## Languages
en English · tn Setswana · zu isiZulu · af Afrikaans · ve Tshivenda · ts Xitsonga · fr French · es Spanish · zh Chinese.

## API
`POST /api/vip/translate {text, target_lang, source_lang?, message_id?}` — **feature-gated**: returns 403
unless `user.is_vip`. On the client, incoming text messages show a "Translate" chip for VIP users that
translates into the user's `preferred_language`.

## Privacy
Translations are computed on demand and NOT persisted. Only the original message is stored. `vip_usage`
records metering metadata (target_lang, char count) — never the message content.
