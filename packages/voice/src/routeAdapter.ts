import type { Point } from "@pepo/types/model";
import type { Maneuver, NavigationPlan, NavigationStep } from "./types";
import { lengthOf, meters, validCoordinate } from "./geometry";
const mapping: Record<string, Maneuver> = {
  TURN_LEFT: "left",
  TURN_RIGHT: "right",
  STRAIGHT: "straight",
  TURN_SLIGHT_LEFT: "slight-left",
  TURN_SLIGHT_RIGHT: "slight-right",
  TURN_SHARP_LEFT: "left",
  TURN_SHARP_RIGHT: "right",
  UTURN_LEFT: "uturn-left",
  UTURN_RIGHT: "uturn-right",
  ROUNDABOUT_LEFT: "roundabout-left",
  ROUNDABOUT_RIGHT: "roundabout-right",
  MERGE: "merge",
};
export function decodeSteps(
  legs: unknown,
  decode: (value: string) => Point[],
): NavigationStep[] {
  if (!Array.isArray(legs)) return [];
  const out: NavigationStep[] = [];
  let pointsCount = 0;
  for (const [legIndex, leg] of legs.entries()) {
    if (!leg || !Array.isArray(leg.steps)) return [];
    for (const [i, s] of leg.steps.entries()) {
      const start = s.startLocation?.latLng,
        end = s.endLocation?.latLng;
      if (
        !start ||
        !end ||
        !validCoordinate(start) ||
        !validCoordinate(end) ||
        typeof s.polyline?.encodedPolyline !== "string"
      )
        return [];
      let points: Point[];
      try {
        points = decode(s.polyline.encodedPolyline);
      } catch {
        return [];
      }
      pointsCount += points.length;
      if (
        points.length < 2 ||
        pointsCount > 20000 ||
        !points.every(validCoordinate) ||
        meters(points[0], start) > 30 ||
        meters(points.at(-1)!, end) > 30
      )
        return [];
      if (!Number.isFinite(s.distanceMeters) || s.distanceMeters < 0) return [];
      out.push({
        id: `${legIndex}:${i}`,
        start,
        end,
        points,
        distanceMeters: s.distanceMeters,
        maneuver: mapping[s.navigationInstruction?.maneuver] || "unknown",
        providerText:
          typeof s.navigationInstruction?.instructions === "string"
            ? s.navigationInstruction.instructions
                .replace(/<[^>]*>/g, "")
                .slice(0, 300)
            : "",
      });
      if (out.length > 500) return [];
    }
  }
  return out;
}
/** Step geometry is the authority. No turns are inferred from an estimated line or LLM. */
export function buildNavigationPlan(
  id: string,
  steps: NavigationStep[],
  source: NavigationPlan["source"] = "google",
): NavigationPlan | null {
  if (!steps.length || steps.length > 500) return null;
  const points: Point[] = [],
    ordered: NavigationPlan["steps"] = [];
  let length = 0;
  for (const step of steps) {
    if (
      step.points.length < 2 ||
      !step.points.every(validCoordinate) ||
      !Number.isFinite(step.distanceMeters) ||
      step.distanceMeters < 0
    )
      return null;
    if (points.length && meters(points.at(-1)!, step.points[0]) > 30)
      return null;
    if (points.length) length += meters(points.at(-1)!, step.points[0]);
    ordered.push({ ...step, atMeters: length });
    points.push(...step.points);
    length += lengthOf(step.points);
  }
  if (points.length > 20000 || length < 1) return null;
  const last = points.at(-1)!;
  ordered.push({
    id: "arrival",
    start: last,
    end: last,
    points: [last, last],
    distanceMeters: 0,
    maneuver: "arrive",
    providerText: "",
    atMeters: length,
  });
  return { id, source, points, steps: ordered, lengthMeters: length };
}
