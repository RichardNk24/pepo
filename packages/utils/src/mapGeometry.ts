import type { Point, Route } from "@pepo/types/model";
import { haversine } from "./rules";

export type LocationFix = Point & {
  speed?: number;
  accuracy: number | null;
  timestamp: number;
};
export const normalizeHeading = (degrees: number) =>
  ((degrees % 360) + 360) % 360;
export function smoothHeading(previous: number, next: number, weight = 0.3) {
  const delta = ((next - previous + 540) % 360) - 180;
  return normalizeHeading(previous + delta * weight);
}
export function cardinalDirection(heading: number) {
  return [
    "Nord",
    "Nord-est",
    "Est",
    "Sud-est",
    "Sud",
    "Sud-ouest",
    "Ouest",
    "Nord-ouest",
  ][Math.round(normalizeHeading(heading) / 45) % 8];
}
export function validPoint(value: unknown): value is Point {
  const p = value as Point | undefined;
  return (
    !!p &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180
  );
}
/** Reveal by physical distance, rather than number of vertices, for a steady drawing speed. */
export function revealRoute(points: Point[], progress: number): Point[] {
  if (points.length < 2 || progress >= 1) return points;
  const lengths = points.slice(1).map((p, i) => haversine(points[i], p));
  let remaining =
    lengths.reduce((sum, n) => sum + n, 0) * Math.max(0, progress);
  const result = [points[0]];
  for (let i = 0; i < lengths.length; i++) {
    if (remaining >= lengths[i]) {
      result.push(points[i + 1]);
      remaining -= lengths[i];
    } else {
      const t = lengths[i] ? remaining / lengths[i] : 0;
      result.push({
        latitude:
          points[i].latitude +
          (points[i + 1].latitude - points[i].latitude) * t,
        longitude:
          points[i].longitude +
          (points[i + 1].longitude - points[i].longitude) * t,
      });
      break;
    }
  }
  return result;
}
export function arrivalLabel(route: Route, departure = Date.now()) {
  const date = new Date(
    departure + (route.durationSeconds ?? route.durationMin * 60) * 1000,
  );
  // Hours refer to the service city, even if the phone is abroad.
  return date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: route.timeZone ?? "Africa/Lubumbashi",
  });
}
