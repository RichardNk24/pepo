import { describe, expect, it, vi } from "vitest";
import { withLocalAliases } from "../apps/api/src/map-search/aliases";
import {
  createPlaceIntelligence,
  localChoices,
} from "../apps/api/src/map-search/intelligence";
const pullman = {
  id: "lshi-accor-pullman",
  name: "Pullman Lubumbashi Grand Karavia",
  city: "lubumbashi" as const,
  latitude: -11.655877,
  longitude: 27.454753,
  address: "Fixture source",
  aliases: ["Pullman"],
};
describe("familiar names before paid intelligence", () => {
  it("does not send an unfinished introductory phrase to any provider", async () => {
    const fallback = vi.fn(async () => []),
      fetcher = vi.fn();
    const service = createPlaceIntelligence({
      catalog: async () => [pullman],
      fallback,
      fetcher,
      apiKey: "fixture",
    });
    for (const query of ["Amène-moi à", "Je vais à", "Take me to"])
      expect(
        (await service.resolve(query, "lubumbashi", "fr", true)).places,
      ).toEqual([]);
    expect(fallback).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    "Je vais à l’hôtel Karavia",
    "Amène-moi à l'hôtel Caravia",
    "Take me to Karavia",
    "Nakende na Caravia",
    "Nipeleke Karavia",
  ])("resolves %s locally", async (query) => {
    const fetcher = vi.fn();
    const service = createPlaceIntelligence({
      catalog: async () => withLocalAliases([pullman]),
      fallback: async () => [],
      apiKey: "fixture",
      fetcher,
    });
    const result = await service.resolve(query, "lubumbashi", "fr", true);
    expect(result.source).toBe("local");
    expect(result.places[0].id).toBe(pullman.id);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("suggests partial names and never invents a place when the sourced record is missing", () => {
    expect(
      localChoices("Pull", withLocalAliases([pullman])).candidates[0].id,
    ).toBe(pullman.id);
    expect(withLocalAliases([])).toEqual([]);
    expect(pullman.aliases).toEqual(["Pullman"]);
  });
});
