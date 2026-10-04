// Query spelling is separate from place identity: no coordinates or branch chosen.
export const normalizePlaceName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const stop = new Set(
  "je veux voudrais aimerais vais pars aller au a la le les de du des l en vers chez amene moi emmene cote entree please take me to the at entrance side go want going natika nakende na ya kwenda nipeleke kwenye upande mlango svp".split(
    " ",
  ),
);
export function destinationWords(s: string): string[] {
  return normalizePlaceName(s)
    .split(" ")
    .filter((w) => w.length > 1 && !stop.has(w))
    .map((w) => (w === "psarou" ? "psaro" : w === "caravia" ? "karavia" : w));
}
export function destinationQuery(s: string): string {
  const words = destinationWords(s);
  // A familiar hotel nickname is a search term, never a local point selection.
  if (
    words.some((w) => w === "karavia" || w === "pullman") &&
    words.every((w) => ["hotel", "pullman", "grand", "karavia"].includes(w))
  )
    return "hotel pullman grand karavia";
  return words.join(" ").slice(0, 100);
}
