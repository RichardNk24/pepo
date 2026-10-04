import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { localLandmarks } from "../apps/api/src/landmarks";
import { reversePlace, searchPlaces } from "../apps/api/src/maps";
import {
  humanAddress,
  rankReferences,
  useReference,
} from "@pepo/utils/placeReferences";
const point = { latitude: -11.662345, longitude: 27.485678 };
const candidate = {
  id: "madini",
  name: "Institut Maadini",
  address: "Lubumbashi",
  city: "lubumbashi" as const,
  ...point,
};
const geo = {
  status: "OK",
  results: [
    { formatted_address: "8FW9+8RP, Lubumbashi", address_components: [] },
  ],
};
function mock(places: unknown[], geocoding: unknown = geo) {
  const fn = vi.fn(async (url: string, _options?: RequestInit) => ({
    ok: true,
    json: async () => (url.includes("searchNearby") ? { places } : geocoding),
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Human-readable landmarks at the exact pin", () => {
  it("replaces a Plus Code with a nearby named place without moving the pin", async () => {
    const fetch = mock([
      {
        id: "madini",
        displayName: { text: candidate.name },
        location: point,
        formattedAddress: "8FW9+8RP, Lubumbashi",
      },
    ]);
    const p = await reversePlace(point, "lubumbashi", "private-test");
    expect(p).toMatchObject({
      ...point,
      name: candidate.name,
      referenceId: "madini",
      googleAttribution: true,
    });
    expect(p.address).not.toContain("8FW9");
    expect(p.references).toHaveLength(1);
    const body = JSON.parse(
      String(
        fetch.mock.calls.find((c) => c[0].includes("searchNearby"))![1]?.body ||
          "{}",
      ),
    );
    expect(body.locationRestriction.circle.radius).toBe(300);
    expect(body.rankPreference).toBe("DISTANCE");
  });
  it("labels an offset landmark as nearby, not as an exact street or entrance", async () => {
    mock([
      {
        id: "school",
        displayName: { text: "École" },
        location: { ...point, latitude: point.latitude + 0.001 },
      },
    ]);
    const p = await reversePlace(point, "lubumbashi", "key");
    expect(p.name).toBe("À proximité de École");
    expect(p.address).toContain("à vol d’oiseau");
    expect(p.latitude).toBe(point.latitude);
  });
  it("excludes places outside 300 m, closed places and unsupported attributions", async () => {
    mock([
      {
        id: "far",
        displayName: { text: "Loin" },
        location: { ...point, latitude: point.latitude + 0.004 },
      },
      {
        id: "closed",
        displayName: { text: "Fermé" },
        location: point,
        businessStatus: "CLOSED_PERMANENTLY",
      },
      {
        id: "third",
        displayName: { text: "Tiers" },
        location: point,
        attributions: [{}],
      },
    ]);
    const p = await reversePlace(point, "lubumbashi", "key");
    expect(p.references).toEqual([]);
    expect(p.name).toBe("Lieu choisi sur la carte");
    expect(p.address).toBe("Lubumbashi");
  });
  it("finds a road in another geocoding result behind the Plus Code", async () => {
    mock([], {
      status: "OK",
      results: [
        ...geo.results,
        {
          formatted_address: "Avenue du 30 Juin, Lubumbashi",
          address_components: [
            { types: ["route"], long_name: "Avenue du 30 Juin" },
          ],
        },
      ],
    });
    expect((await reversePlace(point, "lubumbashi", "key")).name).toBe(
      "Avenue du 30 Juin",
    );
  });
  it("keeps a useful geocoded road when Nearby Search is disabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: !url.includes("searchNearby"),
        json: async () => ({
          status: "OK",
          results: [
            {
              formatted_address: "Avenue Kasaï",
              address_components: [
                { long_name: "Avenue Kasaï", types: ["route"] },
              ],
            },
          ],
        }),
      })),
    );
    expect((await reversePlace(point, "lubumbashi", "key")).name).toBe(
      "Avenue Kasaï",
    );
  });
  it("still finds a reference when Geocoding fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: url.includes("searchNearby"),
        json: async () => ({
          places: [
            {
              id: "madini",
              displayName: { text: candidate.name },
              location: point,
            },
          ],
        }),
      })),
    );
    expect((await reversePlace(point, "lubumbashi", "key")).name).toBe(
      candidate.name,
    );
  });
  it("offers returned entrances with their actual coordinates, never guessed sides", async () => {
    const entry = { ...point, longitude: point.longitude + 0.0004 };
    mock([
      {
        id: "complex",
        displayName: { text: "Complexe" },
        location: point,
        entrances: [
          { location: entry },
          { location: { latitude: NaN, longitude: 2 } },
        ],
      },
    ]);
    const p = await reversePlace(point, "lubumbashi", "key");
    expect(p.references?.[0].entrances).toHaveLength(1);
    expect(p.references?.[0].entrances?.[0]).toMatchObject({
      ...entry,
      name: "Complexe — Entrée 1",
    });
    expect(p).toMatchObject(point);
  });
  it("ranks by distance, limits suggestions and deduplicates ids", () => {
    const refs = rankReferences(point, [
      candidate,
      candidate,
      ...Array.from({ length: 6 }, (_, i) => ({
        ...candidate,
        id: `p${i}`,
        latitude: point.latitude + (i + 1) * 0.0001,
      })),
    ]);
    expect(refs).toHaveLength(3);
    expect(refs[0].id).toBe(candidate.id);
    const original = { ...candidate, id: "pin" };
    expect(useReference(original, refs[1])).toMatchObject({
      latitude: original.latitude,
      longitude: original.longitude,
      id: "pin",
    });
  });
  it("removes short and full Plus Codes, while preserving normal roads", () => {
    expect(humanAddress("8FW9+8RP, Lubumbashi")).toBe("Lubumbashi");
    expect(humanAddress("6GWC8FW9+8RP, RDC")).toBe("RDC");
    expect(humanAddress("119 Avenue Kasaï")).toBe("119 Avenue Kasaï");
  });
});

describe("PEPO field-checked landmark catalog", () => {
  it("offers authored entrance names and local aliases without inventing coordinates", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pepo-landmarks-"));
    try {
      const path = join(dir, "landmarks.json");
      await writeFile(
        path,
        JSON.stringify([
          {
            ...candidate,
            aliases: ["Madini"],
            entrances: [
              {
                id: "golf",
                name: "Entrée côté Route du Golf",
                ...point,
                longitude: point.longitude + 0.001,
              },
            ],
          },
        ]),
      );
      vi.stubEnv("PEPO_LANDMARKS_FILE", path);
      const p = await reversePlace(point, "lubumbashi");
      expect(p.references?.[0].entrances?.[0].name).toBe(
        "Institut Maadini — Entrée côté Route du Golf",
      );
      expect(await searchPlaces("Madini", "lubumbashi")).toHaveLength(1);
      expect(await localLandmarks("kinshasa")).toEqual([]);
      await writeFile(path, JSON.stringify([{ ...candidate, latitude: 120 }]));
      expect(await localLandmarks("lubumbashi")).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
