/** Speech languages deliberately independent of the four interface locales. */
export type VoiceLanguage = "fr" | "en" | "sw" | "ln" | "lua" | "kg" | "ktu";
export type VoiceProfileId =
  | "fr-CD"
  | "en"
  | "sw-CD-katanga"
  | "ln-CD-kinshasa"
  | "lua-CD"
  | "kg-CD"
  | "ktu-CD";
export type VoiceProfile = {
  id: VoiceProfileId;
  language: VoiceLanguage;
  label: string;
  locales: string[];
  navigation: "ready" | "review" | "planned";
  speech: "baseline" | "field-test" | "experimental" | "planned";
};
export const VOICE_PROFILES: readonly VoiceProfile[] = [
  {
    id: "fr-CD",
    language: "fr",
    label: "Français · RDC",
    locales: ["fr-CD", "fr-FR", "fr-CA"],
    navigation: "ready",
    speech: "baseline",
  },
  {
    id: "en",
    language: "en",
    label: "English",
    locales: ["en-GB", "en-US"],
    navigation: "ready",
    speech: "baseline",
  },
  {
    id: "sw-CD-katanga",
    language: "sw",
    label: "Swahili · Grand Katanga",
    locales: ["sw-CD", "sw-TZ", "sw-KE"],
    navigation: "review",
    speech: "field-test",
  },
  {
    id: "ln-CD-kinshasa",
    language: "ln",
    label: "Lingala · Kinshasa",
    locales: ["ln-CD", "ln-CG", "ln"],
    navigation: "review",
    speech: "experimental",
  },
  {
    id: "lua-CD",
    language: "lua",
    label: "Tshiluba",
    locales: ["lua-CD", "lua"],
    navigation: "planned",
    speech: "planned",
  },
  {
    id: "kg-CD",
    language: "kg",
    label: "Kikongo",
    locales: ["kg-CD", "kg"],
    navigation: "planned",
    speech: "planned",
  },
  {
    id: "ktu-CD",
    language: "ktu",
    label: "Kituba / Kikongo ya leta",
    locales: ["ktu-CD", "ktu"],
    navigation: "planned",
    speech: "planned",
  },
];
export const profileFor = (id: string): VoiceProfile =>
  VOICE_PROFILES.find((p) => p.id === id) || VOICE_PROFILES[0];
export const defaultVoiceProfile = (language: string): VoiceProfileId =>
  VOICE_PROFILES.find((p) => p.language === language)?.id || "fr-CD";
export type DeviceVoice = {
  identifier: string;
  language: string;
  name: string;
};
export function selectDeviceVoice(
  voices: DeviceVoice[],
  profile: VoiceProfile,
  chosen?: string,
): DeviceVoice | undefined {
  const eligible = voices.filter(
    (v) =>
      v.language.replaceAll("_", "-").toLowerCase().split("-")[0] ===
      profile.language,
  );
  if (chosen) return eligible.find((v) => v.identifier === chosen); // No silent switch if the user's voice disappeared.
  return (
    profile.locales
      .map((locale) =>
        eligible.find(
          (v) =>
            v.language.replaceAll("_", "-").toLowerCase() ===
            locale.toLowerCase(),
        ),
      )
      .find(Boolean) || eligible[0]
  );
}
export type VoicePreferences = {
  profile: VoiceProfileId;
  enabled: boolean;
  voiceId?: string;
};
export function safeVoicePreferences(
  value: unknown,
  fallback: VoiceProfileId,
): VoicePreferences {
  const v = value as Partial<VoicePreferences> | null;
  return {
    profile: VOICE_PROFILES.some((p) => p.id === v?.profile)
      ? v!.profile!
      : fallback,
    enabled: typeof v?.enabled === "boolean" ? v.enabled : false,
    ...(typeof v?.voiceId === "string" && v.voiceId.length < 200
      ? { voiceId: v.voiceId }
      : {}),
  };
}
