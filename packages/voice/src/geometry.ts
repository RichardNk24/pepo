import type { Point } from "@pepo/types/model";
const R = 6371000,
  rad = Math.PI / 180;
export const validCoordinate = (p: Point) =>
  Number.isFinite(p.latitude) &&
  Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 &&
  Math.abs(p.longitude) <= 180;
export function meters(a: Point, b: Point) {
  const x =
      (b.longitude - a.longitude) *
      rad *
      Math.cos(((a.latitude + b.latitude) * rad) / 2),
    y = (b.latitude - a.latitude) * rad;
  return Math.hypot(x, y) * R;
}
export function bearing(a: Point, b: Point) {
  const x =
      (b.longitude - a.longitude) *
      Math.cos(((a.latitude + b.latitude) * rad) / 2),
    y = b.latitude - a.latitude;
  return (Math.atan2(x, y) / rad + 360) % 360;
}
export const angleDifference = (a: number, b: number) =>
  Math.abs(((a - b + 540) % 360) - 180);
export function project(p: Point, points: Point[]) {
  let distance = 0;
  const hits: {
    distance: number;
    along: number;
    segment: number;
    t: number;
    bearing: number;
  }[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      c = Math.cos(p.latitude * rad);
    const x = (b.longitude - a.longitude) * c * rad * R,
      y = (b.latitude - a.latitude) * rad * R;
    const px = (p.longitude - a.longitude) * c * rad * R,
      py = (p.latitude - a.latitude) * rad * R;
    const length = Math.hypot(x, y);
    if (length < 0.1) continue;
    const t = Math.max(0, Math.min(1, (px * x + py * y) / (length * length)));
    hits.push({
      distance: Math.hypot(px - t * x, py - t * y),
      along: distance + t * length,
      segment: i - 1,
      t,
      bearing: bearing(a, b),
    });
    distance += length;
  }
  return hits.sort((a, b) => a.distance - b.distance);
}
export function lengthOf(points: Point[]) {
  return points.slice(1).reduce((sum, p, i) => sum + meters(points[i], p), 0);
}
