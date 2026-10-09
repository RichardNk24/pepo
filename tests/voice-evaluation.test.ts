import { it, expect } from "vitest";
import { evaluateVoiceSamples } from "../packages/voice/src/evaluation";
it("measures omissions, insertions, missing destination selections and observed latencies without claiming language coverage", () => {
  const result = evaluateVoiceSamples([
    {
      profile: "fr-CD",
      expectedText: "Hôtel Pullman",
      transcript: "hôtel Pullman",
      expectedPlaceId: "hotel",
      predictedPlaceId: "hotel",
      latencyMs: 100,
    },
    {
      profile: "fr-CD",
      expectedText: "marché Kenya",
      transcript: "marché",
      expectedPlaceId: "market",
      latencyMs: 900,
    },
    {
      profile: "ln-CD-kinshasa",
      expectedText: "Kenya",
      transcript: "Kenya marché",
    },
  ]);
  expect(result[0]).toMatchObject({
    samples: 2,
    wer: 0.25,
    placeAccuracy: 0.5,
    latencyP50Ms: 100,
    latencyP95Ms: 900,
  });
  expect(result[1]).toMatchObject({
    wer: 1,
    placeAccuracy: null,
    latencyP95Ms: null,
  });
});
it("refuses empty reference speech instead of producing a misleading WER", () => {
  expect(() =>
    evaluateVoiceSamples([
      { profile: "sw-CD-katanga", expectedText: "", transcript: "station" },
    ]),
  ).toThrow();
});

import { navigationLandmarkNight } from "../packages/voice/src/landmarks";
it("rechecks dusk in the city timezone rather than keeping daylight visibility from a previous plan", () => {
  const now = Date.parse("2026-10-09T16:00:00Z");
  expect(navigationLandmarkNight("lubumbashi", now, false)).toBe(true);
  expect(navigationLandmarkNight("kinshasa", now, false)).toBe(false);
  expect(navigationLandmarkNight("lubumbashi", now - 1, false)).toBe(false);
  expect(navigationLandmarkNight("lubumbashi", now - 1, true)).toBe(true);
});
