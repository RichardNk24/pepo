import { parseVoice } from "./commands";
import type { VoiceLanguage } from "./profiles";
export type SpeechIntent =
  | { kind: "repeat" | "mute" | "unmute" }
  | {
      kind: "destination";
      query: string;
      requiresConfirmation: true;
      spatial: boolean;
    }
  | { kind: "command"; action: string }
  | { kind: "unknown" };
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[.,!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
export function understandSpeech(
  text: string,
  language: VoiceLanguage,
  allowDestination = true,
): SpeechIntent {
  const s = norm(text);
  if (
    !s ||
    s.length > 300 ||
    /^(ne |do not |don t |usifanye |kosala te)/.test(s)
  )
    return { kind: "unknown" };
  if (
    ["repete", "repetez", "repeat", "say again", "rudia", "zongela"].includes(s)
  )
    return { kind: "repeat" };
  if (["coupe la voix", "mute", "nyamaza", "kanga mongongo"].includes(s))
    return { kind: "mute" };
  if (["active la voix", "unmute", "fungua sauti"].includes(s))
    return { kind: "unmute" };
  if (!["fr", "en", "sw", "ln"].includes(language)) return { kind: "unknown" };
  const old = parseVoice(text, language as "fr" | "en" | "sw" | "ln", false);
  if (old.kind === "command") return old;
  if (!allowDestination) return { kind: "unknown" };
  const query = text
    .replace(
      /^(?:je (?:veux |voudrais |vais |pars )(?:aller )?(?:a|à|au|aux|chez) |(?:amène|amene|emmène|emmene)[ -]moi (?:à|a|au|chez) |(?:take me to|i want to go to|go to) |(?:nipeleke|nataka kwenda)(?: pale)?(?: kwa| kwenye)? |(?:mema ngai na|nakende na) )/i,
      "",
    )
    .trim();
  return {
    kind: "destination",
    query: query.slice(0, 300),
    requiresConfirmation: true,
    spatial:
      /\b(apres|avant|derriere|en face|parcelle|intersection|after|before|behind|opposite|baada|nyuma|nsima|liboso)\b/.test(
        s,
      ),
  };
}
