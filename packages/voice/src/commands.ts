import type { Language } from "@pepo/types/model";
export type VoiceAction =
  | "home"
  | "account"
  | "activity"
  | "help"
  | "back"
  | "recenter"
  | "cancelTrip"
  | "arrive"
  | "startTrip"
  | "finishTrip";
export type VoiceIntent =
  | { kind: "command"; action: VoiceAction }
  | { kind: "destination"; query: string }
  | { kind: "unknown" };
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,!?;:\u2019'‐-―-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const commands: Record<Language, Partial<Record<VoiceAction, string[]>>> = {
  fr: {
    home: ["accueil", "retour a l accueil"],
    account: ["mon compte", "compte", "ouvre mon compte"],
    activity: ["mes courses", "historique"],
    help: ["aide", "j ai besoin d aide"],
    back: ["retour", "revenir"],
    recenter: ["ma position", "ou suis je"],
    cancelTrip: ["annuler la course"],
    arrive: ["je suis arrive", "je suis au depart"],
    startTrip: ["demarrer la course"],
    finishTrip: ["terminer la course"],
  },
  en: {
    home: ["home", "go home"],
    account: ["my account", "account", "open my account"],
    activity: ["my rides", "ride history"],
    help: ["help", "i need help"],
    back: ["back", "go back"],
    recenter: ["my location", "where am i"],
    cancelTrip: ["cancel the ride", "cancel ride"],
    arrive: ["i have arrived", "i am at pickup"],
    startTrip: ["start the ride", "start ride"],
    finishTrip: ["finish the ride", "finish ride", "complete ride"],
  },
  sw: {
    home: ["mwanzo", "rudi mwanzo"],
    account: ["akaunti", "akaunti yangu", "fungua akaunti yangu"],
    activity: ["safari zangu"],
    help: ["msaada", "nahitaji msaada"],
    back: ["rudi"],
    recenter: ["eneo langu", "niko wapi"],
    cancelTrip: ["ghairi safari"],
    arrive: ["nimefika"],
    startTrip: ["anza safari"],
    finishTrip: ["maliza safari"],
  },
  ln: {
    home: ["accueil", "zonga na accueil"],
    account: ["konti", "konti na ngai", "fungola konti na ngai"],
    activity: ["ba courses na ngai", "safari na ngai"],
    help: ["lisalisi", "nasengi lisalisi"],
    back: ["zonga"],
    recenter: ["esika nazali", "nazali wapi"],
    cancelTrip: ["longola course", "annuler course"],
    arrive: ["nakomi", "nakomi na depart"],
    startTrip: ["banda course"],
    finishTrip: ["sukisa course"],
  },
};
const prefixes: Record<Language, RegExp> = {
  fr: /^(?:aller (?:a|au|aux)|emmene(?:z)? moi (?:a|au|aux)|destination)\s+(.+)$/i,
  en: /^(?:go to|take me to|destination)\s+(.+)$/i,
  sw: /^(?:nipeleke(?: kwa)?|nenda(?: kwa)?|nataka kwenda(?: kwa)?)\s+(.+)$/i,
  ln: /^(?:mema nga(?:i)? na|nakende na|kende na)\s+(.+)$/i,
};
export function parseVoice(
  text: string,
  language: Language,
  allowPlace = true,
): VoiceIntent {
  const n = normalize(text);
  if (!n || n.length > 200) return { kind: "unknown" };
  for (const [action, aliases] of Object.entries(commands[language]))
    if (aliases?.includes(n))
      return { kind: "command", action: action as VoiceAction };
  const match = n.match(prefixes[language]);
  if (match) return { kind: "destination", query: match[1].trim() };
  // Unprefixed speech is a place query only in the destination field.
  if (allowPlace && !/^(?:ne |do not |don t |usighairi|kolongola te)/.test(n))
    return { kind: "destination", query: text.trim() };
  return { kind: "unknown" };
}
