export const LANGUAGES: { code: string; name: string; flag: string }[] = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "tn", name: "Setswana", flag: "🇧🇼" },
  { code: "zu", name: "isiZulu", flag: "🇿🇦" },
  { code: "af", name: "Afrikaans", flag: "🇿🇦" },
  { code: "ve", name: "Tshivenda", flag: "🇿🇦" },
  { code: "ts", name: "Xitsonga", flag: "🇿🇦" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
];

export function languageName(code?: string | null): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? "English";
}
