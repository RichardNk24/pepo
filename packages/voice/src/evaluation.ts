/** Offline evaluation of consented reference/transcript pairs. No audio or location is uploaded. */
export type VoiceSample = {
  profile: string;
  expectedText: string;
  transcript: string;
  latencyMs?: number;
  expectedPlaceId?: string;
  predictedPlaceId?: string;
};
const words = (s: string) =>
  s
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
function edits(a: string[], b: string[]) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        next[j - 1] + 1,
        row[j] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
}
export function evaluateVoiceSamples(samples: VoiceSample[]) {
  const groups = new Map<
    string,
    {
      samples: number;
      referenceWords: number;
      wordErrors: number;
      placeSamples: number;
      placeCorrect: number;
      latencies: number[];
    }
  >();
  for (const s of samples) {
    if (
      !s ||
      typeof s.profile !== "string" ||
      typeof s.expectedText !== "string" ||
      typeof s.transcript !== "string" ||
      s.expectedText.length > 2000 ||
      s.transcript.length > 2000
    )
      throw new Error("Échantillon invalide");
    const reference = words(s.expectedText);
    if (!reference.length) throw new Error("Référence vide");
    let g = groups.get(s.profile);
    if (!g) {
      g = {
        samples: 0,
        referenceWords: 0,
        wordErrors: 0,
        placeSamples: 0,
        placeCorrect: 0,
        latencies: [],
      };
      groups.set(s.profile, g);
    }
    g.samples++;
    g.referenceWords += reference.length;
    g.wordErrors += edits(reference, words(s.transcript));
    if (s.expectedPlaceId) {
      g.placeSamples++;
      if (s.predictedPlaceId === s.expectedPlaceId) g.placeCorrect++;
    }
    if (Number.isFinite(s.latencyMs) && s.latencyMs! >= 0)
      g.latencies.push(s.latencyMs!);
  }
  return [...groups].map(([profile, g]) => {
    const sorted = g.latencies.sort((a, b) => a - b);
    return {
      profile,
      samples: g.samples,
      referenceWords: g.referenceWords,
      wordErrors: g.wordErrors,
      wer: g.wordErrors / g.referenceWords,
      placeSamples: g.placeSamples,
      placeAccuracy: g.placeSamples ? g.placeCorrect / g.placeSamples : null,
      latencySamples: sorted.length,
      latencyP50Ms: sorted.length
        ? sorted[Math.ceil(sorted.length * 0.5) - 1]
        : null,
      latencyP95Ms: sorted.length
        ? sorted[Math.ceil(sorted.length * 0.95) - 1]
        : null,
    };
  });
}
