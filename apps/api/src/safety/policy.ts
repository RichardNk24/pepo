import type { CityId, Point, Profile, Trip } from "@pepo/types/model";
import { createHash } from "node:crypto";
import { haversine } from "@pepo/utils/rules";

export const SAFETY = Object.freeze({
  fixMaxAgeMs: 45000,
  maxAccuracyM: 80,
  pickupRadiusM: 200,
  stopMs: 5 * 60000,
  deviationMs: 2 * 60000,
  deviationM: 450,
  staleMs: 3 * 60000,
  checkGraceMs: 2 * 60000,
  checkCooldownMs: 10 * 60000,
  retentionMs: 30 * 86400000,
});
export type NightTier = "day" | "night" | "late";
export function nightPolicy(city: CityId, now: number) {
  const timeZone =
    city === "kinshasa" ? "Africa/Kinshasa" : "Africa/Lubumbashi";
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(now),
  );
  const tier: NightTier =
    hour >= 22 || hour < 5 ? "late" : hour >= 18 || hour < 6 ? "night" : "day";
  return { tier, timeZone, localHour: hour };
}
export function driverFingerprint(p: Profile) {
  // Every replacement of a reviewed document or vehicle invalidates night approval.
  return createHash("sha256")
    .update(
      JSON.stringify({
        city: p.city,
        driver: p.driver,
        documents: ["identity", "selfie", "license", "vehicle"].map(
          (k) =>
            p.documents?.[k as keyof NonNullable<Profile["documents"]>]
              ?.submittedAt || null,
        ),
      }),
    )
    .digest("hex");
}
export function reviewedDriver(p: Profile) {
  return (
    p.role === "driver" &&
    p.verification === "verified" &&
    p.identityVerification === "verified" &&
    !!p.driver &&
    ["identity", "selfie", "license", "vehicle"].every(
      (k) => !!p.documents?.[k as keyof NonNullable<Profile["documents"]>],
    )
  );
}
export function distanceFromRouteM(point: Point, route: Trip["route"]) {
  // A straight-line estimate cannot support a road-deviation alert.
  if (route.source !== "google" || route.points.length < 2) return null;
  const cos = Math.cos((point.latitude * Math.PI) / 180);
  const xy = (p: Point) => ({
    x: (p.longitude - point.longitude) * 111320 * cos,
    y: (p.latitude - point.latitude) * 111320,
  });
  let min = Infinity;
  for (let i = 1; i < route.points.length; i++) {
    const a = xy(route.points[i - 1]),
      b = xy(route.points[i]);
    const dx = b.x - a.x,
      dy = b.y - a.y,
      den = dx * dx + dy * dy;
    const u = den ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / den)) : 0;
    min = Math.min(min, Math.hypot(a.x + u * dx, a.y + u * dy));
  }
  return min;
}
export function expectedStop(p: Point, t: Trip) {
  return [...(t.stops || []), t.destination].some(
    (s) => haversine(p, s) * 1000 < 200,
  );
}

export function monitoringThresholds(tier: NightTier) {
  return tier === "late"
    ? {
        stopMs: 3 * 60000,
        deviationMs: 90000,
        staleMs: 2 * 60000,
        checkGraceMs: 90000,
      }
    : {
        stopMs: SAFETY.stopMs,
        deviationMs: SAFETY.deviationMs,
        staleMs: SAFETY.staleMs,
        checkGraceMs: SAFETY.checkGraceMs,
      };
}
