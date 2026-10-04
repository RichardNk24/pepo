import type { Place } from "@pepo/types/model";
import { haversine } from "@pepo/utils/rules";
import { normalizePlaceName } from "./query";

const name = (p: Place) => normalizePlaceName(p.name).replace(/^hotel\s+/, "");
/** Keep provider coordinates intact. A brand name alone never identifies a branch. */
export function mergePlaceResults(...groups: Place[][]): Place[] {
  const result: Place[] = [];
  const ids = new Set<string>();
  for (const p of groups.flat()) {
    if (ids.has(p.id)) continue;
    ids.add(p.id);
    // Only collapse a local mirror near the same named Google establishment.
    // Distinct Google IDs, distant homonyms and declared entrances stay distinct.
    if (
      !p.googleAttribution &&
      result.some(
        (g) =>
          g.googleAttribution &&
          g.city === p.city &&
          name(g) === name(p) &&
          haversine(g, p) <= 0.15,
      )
    )
      continue;
    result.push(p);
  }
  return result.slice(0, 20);
}
