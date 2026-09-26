"""Ditsala VIP multilingual translation.

Provider-abstraction module: the chat app depends only on `translate()`. The
concrete provider (Claude Sonnet 5 today, Azure AI Translator tomorrow) is
selected here and can be swapped without touching chat code.

Privacy: we translate on demand and DO NOT persist copies of translated
message content. Only the original message is stored.
"""
import os
from abc import ABC, abstractmethod

LANGUAGES: dict[str, str] = {
    "en": "English",
    "tn": "Setswana",
    "zu": "isiZulu",
    "af": "Afrikaans",
    "ve": "Tshivenda",
    "ts": "Xitsonga",
    "fr": "French",
    "es": "Spanish",
    "zh": "Chinese (Simplified)",
}

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")


class TranslationProvider(ABC):
    name: str = "abstract"

    @abstractmethod
    async def translate(self, text: str, target_lang: str, source_lang: str | None = None) -> str:
        ...


class ClaudeTranslationProvider(TranslationProvider):
    name = "anthropic:claude-sonnet-5"

    async def translate(self, text: str, target_lang: str, source_lang: str | None = None) -> str:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        target = LANGUAGES.get(target_lang, target_lang)
        source = LANGUAGES.get(source_lang or "", "the source language")
        system = (
            "You are Ditsala's translation engine. Translate the user's chat message "
            f"from {source} into {target}. Preserve tone, emoji, names and slang where "
            "sensible. Reply with ONLY the translated text — no quotes, no notes, no "
            "language labels."
        )
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id="ditsala-translate",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-5")
        result = await chat.send_message(UserMessage(text=text))
        return (result or "").strip()


_PROVIDERS: dict[str, TranslationProvider] = {
    "claude": ClaudeTranslationProvider(),
}


def get_provider() -> TranslationProvider:
    key = os.environ.get("TRANSLATION_PROVIDER", "claude")
    return _PROVIDERS.get(key, _PROVIDERS["claude"])


async def translate(text: str, target_lang: str, source_lang: str | None = None) -> dict:
    if not text or not text.strip():
        return {"text": text, "provider": None}
    provider = get_provider()
    translated = await provider.translate(text, target_lang, source_lang)
    return {"text": translated, "provider": provider.name, "target_lang": target_lang}
