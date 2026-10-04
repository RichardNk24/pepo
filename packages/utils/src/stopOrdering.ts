import type { Place } from "@pepo/types/model";
import { haversine } from "./rules";

// Offline demo only: compare every order (at most six for three stops).
// This does not account for roads, traffic or one-way streets.
export function estimatedStopOrder(
  pickup: Place,
  destination: Place,
  stops: Place[],
): Place[] {
  if (stops.length < 2) return [...stops];
  if (stops.length > 3) throw new Error("3 étapes maximum.");
  const cost = (list: Place[]) => {
    const points = [pickup, ...list, destination];
    return points
      .slice(1)
      .reduce((sum, point, i) => sum + haversine(points[i], point), 0);
  };
  let best = [...stops],
    bestCost = cost(best);
  function visit(prefix: Place[], remaining: Place[]) {
    if (!remaining.length) {
      const value = cost(prefix);
      if (value < bestCost - 0.000001) {
        best = prefix;
        bestCost = value;
      }
      return;
    }
    remaining.forEach((point, i) =>
      visit(
        [...prefix, point],
        remaining.filter((_, j) => j !== i),
      ),
    );
  }
  visit([], stops);
  return best;
}

export function applyStopIndices(stops: Place[], indices: unknown): Place[] {
  if (
    !Array.isArray(indices) ||
    indices.length !== stops.length ||
    new Set(indices).size !== stops.length ||
    !indices.every((i) => Number.isInteger(i) && i >= 0 && i < stops.length)
  ) {
    throw new Error("L’ordre des étapes reçu est invalide. Réessayez.");
  }
  return indices.map((i) => stops[i]);
}
