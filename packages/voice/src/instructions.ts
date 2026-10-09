import type { StructuredInstruction } from "./types";
import type { VoiceProfile } from "./profiles";
const verbs: Record<string, Record<string, string>> = {
  fr: {
    left: "tournez à gauche",
    right: "tournez à droite",
    straight: "continuez tout droit",
    "slight-left": "prenez légèrement à gauche",
    "slight-right": "prenez légèrement à droite",
    "uturn-left": "faites demi-tour à gauche",
    "uturn-right": "faites demi-tour à droite",
    "roundabout-left": "prenez le rond-point à gauche",
    "roundabout-right": "prenez le rond-point à droite",
    merge: "rejoignez la voie",
    arrive: "vous approchez de votre destination",
  },
  en: {
    left: "turn left",
    right: "turn right",
    straight: "continue straight",
    "slight-left": "bear left",
    "slight-right": "bear right",
    "uturn-left": "make a U-turn to the left",
    "uturn-right": "make a U-turn to the right",
    "roundabout-left": "enter the roundabout to the left",
    "roundabout-right": "enter the roundabout to the right",
    merge: "merge",
    arrive: "you are approaching your destination",
  },
  sw: {
    left: "geuka kushoto",
    right: "geuka kulia",
    straight: "endelea moja kwa moja",
    "slight-left": "elekea kushoto kidogo",
    "slight-right": "elekea kulia kidogo",
    arrive: "unakaribia kufika",
  },
  ln: {
    left: "baluká na lobɔkɔ ya mwasi",
    right: "baluká na lobɔkɔ ya mobali",
    straight: "koba liboso",
    arrive: "okómi pene na esika ozali kokende",
  },
};
/** SW/LN are explicitly draft previews. No native-speaker approval is claimed. */
export function formatInstruction(
  i: StructuredInstruction,
  profile: VoiceProfile,
  preview = false,
): { text: string; approved: boolean } | null {
  if (profile.navigation !== "ready" && !preview) return null;
  const lang = profile.language,
    verb = verbs[lang]?.[i.maneuver];
  // Roundabout exit numbers/road names are not parsed from prose. Use provider's FR verbatim instruction.
  if (
    (i.maneuver === "unknown" ||
      i.maneuver.startsWith("roundabout") ||
      i.maneuver === "merge") &&
    lang === "fr" &&
    i.providerText
  )
    return { text: i.providerText, approved: true };
  if (!verb) return null;
  if (i.maneuver.startsWith("roundabout") || i.maneuver === "merge")
    return null;
  const distance = Math.max(0, Math.round(i.distanceMeters / 10) * 10);
  const prep =
    i.phase === "prepare"
      ? lang === "fr"
        ? `Dans ${distance} mètres, `
        : lang === "en"
          ? `In ${distance} meters, `
          : lang === "sw"
            ? `Baada ya mita ${distance}, `
            : `Na ${distance} mètres, `
      : "";
  let landmark = "";
  if (i.landmark && i.landmark.relation === "after") {
    const name = i.landmark.landmark.name;
    landmark =
      lang === "fr"
        ? `juste après ${name}, `
        : lang === "en"
          ? `just after ${name}, `
          : lang === "sw"
            ? `baada ya ${name}, `
            : `nsima ya ${name}, `;
  }
  const action =
    lang === "fr" && i.providerText && i.maneuver !== "arrive"
      ? i.providerText.replace(/[.!]$/, "")
      : verb;
  return {
    text: `${prep}${landmark}${action}.`,
    approved: profile.navigation === "ready",
  };
}
