import { describe, it, expect, vi } from "vitest";
import {
  createPlaceIntelligence,
  localChoices,
  type CatalogPlace,
} from "../apps/api/src/map-search/intelligence";
const entrance = {
  id: "parking",
  name: "Complexe Test — Entrée parking",
  address: "Accès test",
  city: "lubumbashi" as const,
  latitude: -11.664,
  longitude: 27.48,
};
const catalog: CatalogPlace[] = [
  {
    ...entrance,
    id: "mall",
    name: "Complexe Test",
    aliases: ["le mall"],
    entrances: [entrance],
  },
  { ...entrance, id: "hotel", name: "Hôtel du Lac", entrances: [] },
];
const reply = (ids: string[], status = "completed") =>
  new Response(
    JSON.stringify({
      status,
      usage: { input_tokens: 250, output_tokens: 15 },
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify({ ids }) }],
        },
      ],
    }),
    { status: 200 },
  );
const setup = (
  fetcher = vi.fn<typeof fetch>(async () => reply(["hotel"])),
  extra = {},
) => ({
  fetcher,
  service: createPlaceIntelligence({
    catalog: async () => catalog,
    fallback: async () => [],
    apiKey: "fake-unit-test",
    fetcher,
    ...extra,
  }),
});
describe("Grounded local mobility requests", () => {
  it.each([
    "Amène-moi au mall, entrée parking",
    "Take me to the mall parking entrance",
    "Nipeleke mall parking",
    "Nakende na mall parking",
  ])("uses the declared entrance without paid calls: %s", async (q) => {
    const { service, fetcher } = setup();
    const r = await service.resolve(q, "lubumbashi", "fr", true);
    expect(r.source).toBe("local");
    expect(r.places[0]).toMatchObject(entrance);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("keeps distinct partial matches as explicit suggestions", () => {
    const r = localChoices("hotel", catalog);
    expect(r.places).toEqual([]);
    expect(r.candidates[0].id).toBe("hotel");
  });
  it("sends bounded names only and validates model IDs, then caches the decision", async () => {
    const { service, fetcher } = setup();
    const r = await service.resolve("hotel calme", "lubumbashi", "fr", true);
    expect(r.source).toBe("openai");
    expect(r.places[0].id).toBe("hotel");
    const payload = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(payload.store).toBe(false);
    expect(payload.max_output_tokens).toBe(160);
    expect(payload.input).not.toContain("latitude");
    expect(payload.input).not.toContain("longitude");
    expect(
      (await service.resolve("hotel calme", "lubumbashi", "fr", true)).source,
    ).toBe("cache");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["invented-id", "parking"])(
    "rejects invented or non-shortlisted IDs: %s",
    async (id) => {
      const { service } = setup(vi.fn(async () => reply([id])));
      const r = await service.resolve("hotel calme", "lubumbashi", "fr", true);
      expect(r.source).toBe("fallback");
      expect(r.places.map((p) => p.id)).toEqual(["hotel"]);
    },
  );
  it("does not call OpenAI on ungrounded, disabled or sensitive queries", async () => {
    const { service, fetcher } = setup();
    await service.resolve("lieu absent", "lubumbashi", "fr", true);
    await service.resolve("hotel calme", "lubumbashi", "fr", false);
    await service.resolve("hotel 243812345678", "lubumbashi", "fr", true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("falls back on refusal, incomplete, provider errors and timeouts", async () => {
    for (const fetcher of [
      vi.fn(async () => reply([], "incomplete")),
      vi.fn(async () => new Response("", { status: 429 })),
      vi.fn(async () => {
        throw new Error("timeout");
      }),
    ]) {
      expect(
        (
          await setup(fetcher).service.resolve(
            "hotel calme",
            "lubumbashi",
            "fr",
            true,
          )
        ).source,
      ).toBe("fallback");
    }
  });
  it("caps daily calls and supports a persistent budget rejection", async () => {
    const { service, fetcher } = setup(undefined, { dailyLimit: 1 });
    await service.resolve("hotel calme", "lubumbashi", "fr", true);
    await service.resolve("hotel proche", "lubumbashi", "fr", true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const blocked = setup(undefined, { consume: () => false });
    await blocked.service.resolve("hotel calme", "lubumbashi", "fr", true);
    expect(blocked.fetcher).not.toHaveBeenCalled();
  });
  it("coalesces identical simultaneous calls", async () => {
    let release: (r: Response) => void = () => {};
    const { service, fetcher } = setup(
      vi.fn(
        () =>
          new Promise<Response>((r) => {
            release = r;
          }),
      ),
    );
    const first = service.resolve("hotel calme", "lubumbashi", "fr", true),
      second = service.resolve("hotel calme", "lubumbashi", "fr", true);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    release(reply(["hotel"]));
    expect(
      (await Promise.all([first, second])).every(
        (r) => r.places[0].id === "hotel",
      ),
    ).toBe(true);
  });
  it("expires cached decisions and avoids remote entrances", async () => {
    let now = 0;
    const { service, fetcher } = setup(undefined, { now: () => now });
    await service.resolve("hotel calme", "lubumbashi", "fr", true);
    now = 300001;
    await service.resolve("hotel calme", "lubumbashi", "fr", true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const remote = createPlaceIntelligence({
      catalog: async () => [
        { ...catalog[0], entrances: [{ ...entrance, latitude: 48 }] },
      ],
      fallback: async () => [],
    });
    expect(
      (await remote.resolve("au mall parking", "lubumbashi")).places[0].id,
    ).toBe("mall");
  });
});
