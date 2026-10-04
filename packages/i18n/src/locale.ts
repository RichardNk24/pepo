import type { Language } from "@pepo/types/model";
export const LANGUAGES = [
  { id: "fr", label: "Français", locale: "fr-CD", speech: ["fr-CD", "fr-FR"] },
  { id: "en", label: "English", locale: "en-US", speech: ["en-US", "en-GB"] },
  {
    id: "sw",
    label: "Kiswahili",
    locale: "sw-CD",
    speech: ["sw-CD", "sw-TZ", "sw-KE"],
  },
  { id: "ln", label: "Lingala", locale: "ln-CD", speech: ["ln-CD", "ln-CG"] },
] as const;
export function safeLanguage(value: unknown): Language {
  return LANGUAGES.some((l) => l.id === value) ? (value as Language) : "fr";
}
export function localeFor(language: Language) {
  return LANGUAGES.find((l) => l.id === language)!.locale;
}
export function chooseSpeechLocale(
  locales: readonly string[],
  language: Language,
): string | null {
  const normalized = locales.map((l) => l.replaceAll("_", "-"));
  for (const candidate of LANGUAGES.find((l) => l.id === language)!.speech) {
    const match = normalized.find(
      (l) => l.toLowerCase() === candidate.toLowerCase(),
    );
    if (match) return match;
  }
  return (
    normalized.find((l) => l.split("-")[0].toLowerCase() === language) || null
  );
}
export function formatDate(
  value: number,
  language: Language,
  options: Intl.DateTimeFormatOptions = {},
) {
  const locale = localeFor(language);
  // Lingala is not implemented by every JS engine; keep a predictable regional fallback.
  const supported = Intl.DateTimeFormat.supportedLocalesOf([locale]);
  return new Intl.DateTimeFormat(supported[0] || "fr-CD", options).format(
    value,
  );
}
