import type { CatalogPlace } from "./intelligence";

// Richard's local naming, 2026-10-04. Extend an existing, sourced record only.
// No new coordinates and no replacement of a customer's catalogue.
const localAliases: Record<string, string[]> = {
  "lshi-accor-pullman": [
    "Karavia",
    "Caravia",
    "Hôtel Karavia",
    "Hôtel Caravia",
    "Grand Karavia",
    "Pullman",
  ],
  "lshi-osm-node-12484683958": ["La Plage", "La plage de Lubumbashi"],
};
export function withLocalAliases(places: CatalogPlace[]): CatalogPlace[] {
  return places.map((p) => ({
    ...p,
    aliases: [
      ...new Set([
        ...(p.aliases || []),
        ...(p.city === "lubumbashi" ? localAliases[p.id] || [] : []),
      ]),
    ],
  }));
}
