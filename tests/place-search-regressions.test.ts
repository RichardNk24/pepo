import { afterEach, describe, expect, it, vi } from "vitest";
import type { Place } from "@pepo/types/model";
import {
  createPlaceIntelligence,
  localChoices,
} from "../apps/api/src/map-search/intelligence";
import { destinationQuery } from "../apps/api/src/map-search/query";
import { mergePlaceResults } from "../apps/api/src/map-search/results";
import { searchPlaces } from "../apps/api/src/maps";

// Synthetic fixtures, never a catalogue of real entrances or branch coordinates.
const make = (id: string, name: string, latitude = -11.66): Place => ({
  id,
  name,
  city: "lubumbashi",
  address: "Fixture address",
  latitude,
  longitude: 27.48,
});
const branches = [
  make("g-centre", "Hyper Psaro Centre-ville"),
  make("g-plage", "Psaro La Plage", -11.655),
  make("g-carrefour", "Carrefour Hyper Psaro", -11.65),
  make("g-depot", "Dépôt Hyper Psaro", -11.645),
].map((p) => ({ ...p, googleAttribution: true }));
const local = [
  { ...make("local-plage", "Psaro La Plage", -11.655), aliases: ["Psaro"] },
];
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Text and voice share a complete place search", () => {
  it.each([
    "Psaro",
    "Je vais à Psarou",
    "Take me to Psarou",
    "Nipeleke Psarou",
    "Nakende na Psarou",
  ])(
    "does not stop at a local alias and preserves all Google branches: %s",
    async (query) => {
      const fallback = vi.fn(async () => branches),
        fetcher = vi.fn();
      const service = createPlaceIntelligence({
        catalog: async () => local,
        fallback,
        apiKey: "fixture",
        fetcher,
      });
      const result = await service.resolve(query, "lubumbashi", "fr", true);
      expect(result.places.map((p) => p.id)).toEqual(branches.map((p) => p.id));
      expect(fallback).toHaveBeenCalledTimes(1);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it("does not let a short alias make a different specific branch an exact match", () => {
    expect(localChoices("Hyper Psarou Carrefour", local).places).toEqual([]);
    expect(localChoices("Psarou", local).places).toHaveLength(1);
  });
  it.each([
    ["Je vais à Hyper Psarou Carrefour", "hyper psaro carrefour"],
    ["Nipeleke Psarou centre-ville", "psaro centre ville"],
    ["Nakende na dépôt Psarou", "depot psaro"],
    ["Hôtel Caravia", "hotel pullman grand karavia"],
    ["Je vais à Pullman", "hotel pullman grand karavia"],
    ["Marché Karavia", "marche karavia"],
  ])("normalizes %s without erasing branch qualifiers", (query, expected) => {
    expect(destinationQuery(query)).toBe(expected);
  });
  it("keeps distinct Google IDs, distant homonyms and separately declared entrances", () => {
    const first = branches[0];
    expect(
      mergePlaceResults(
        [first, { ...first, id: "g-other" }],
        [
          { ...first, googleAttribution: false, id: "mirror" },
          make("distant", first.name, -11.69),
          make("entrance", first.name + " — Entrée parking"),
        ],
      ).map((p) => p.id),
    ).toEqual(["g-centre", "g-other", "distant", "entrance"]);
  });
  it("keeps local suggestions when Google fails, without retrying the search", async () => {
    const fallback = vi.fn(async () => {
      throw new Error("provider unavailable");
    });
    const service = createPlaceIntelligence({
      catalog: async () => local,
      fallback,
    });
    expect(
      (await service.resolve("Psarou", "lubumbashi")).places.map((p) => p.id),
    ).toEqual(["local-plage"]);
    expect(fallback).toHaveBeenCalledTimes(1);
  });
  it("preserves declared entrance choices even when Google returns the parent", async () => {
    const parent = make("mall", "Complexe Test");
    const entrance = make("parking", "Complexe Test — Entrée parking");
    const service = createPlaceIntelligence({
      catalog: async () => [{ ...parent, entrances: [entrance] }],
      fallback: async () => [
        { ...parent, id: "google-mall", googleAttribution: true },
      ],
    });
    expect(
      (await service.resolve("Complexe Test entrée parking", "lubumbashi"))
        .places[0].id,
    ).toBe("parking");
  });
  it("never trusts an out-of-city discovered result, even with a matching name", async () => {
    const service = createPlaceIntelligence({
      catalog: async () => [],
      fallback: async () => [
        { ...branches[0], latitude: 37, longitude: 25 },
        { ...branches[1], city: "kinshasa" },
      ],
    });
    expect((await service.resolve("Psarou", "lubumbashi")).places).toEqual([]);
  });
  it("preserves other local choices if an AI ranks just one candidate", async () => {
    const catalog = [
      make("one", "Hôtel Test Un"),
      make("two", "Hôtel Test Deux"),
    ];
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: '{"ids":["two"]}' }],
              },
            ],
          }),
        ),
    );
    const service = createPlaceIntelligence({
      catalog: async () => catalog,
      fallback: async () => [],
      apiKey: "fixture",
      fetcher,
    });
    expect(
      (
        await service.resolve("hotel calme", "lubumbashi", "fr", true)
      ).places.map((p) => p.id),
    ).toEqual(["two", "one"]);
  });
  it("queries Google with the same hotel identity for typed or spoken nicknames and retains provider coordinates", async () => {
    vi.stubEnv("PEPO_LANDMARKS_FILE", "/missing-test-catalog.json");
    const position = { latitude: -11.664321, longitude: 27.475432 };
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            places: [
              {
                id: "google-hotel",
                displayName: { text: "Pullman Lubumbashi Grand Karavia" },
                formattedAddress: "55 Route du Golf, Lubumbashi",
                location: position,
              },
            ],
          }),
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    for (const query of [
      "Pullman",
      "Hôtel Pullman",
      "Je vais à l'hôtel Caravia",
    ])
      expect(
        (await searchPlaces(query, "lubumbashi", "fixture"))[0],
      ).toMatchObject({
        id: "google-hotel",
        ...position,
        googleAttribution: true,
      });
    for (const [, options] of fetcher.mock.calls as unknown as [
      string,
      RequestInit,
    ][])
      expect(JSON.parse(String(options.body))).toMatchObject({
        textQuery:
          "hotel pullman grand karavia, Lubumbashi, République démocratique du Congo",
        pageSize: 20,
      });
  });
});
