import type { VehicleKind } from "@pepo/types/model";
import type { Landmark, LandmarkRelation, NavigationPlan } from "./types";
import { angleDifference, project } from "./geometry";
export const verifiedLandmark = (l: Landmark, now: number) =>
  l.reliability === "verified" &&
  !!l.source.trim() &&
  !!l.validatedAt &&
  l.validatedAt <= now &&
  now - l.validatedAt < 180 * 86400000 &&
  (!l.expiresAt || l.expiresAt > now);
export function chooseLandmark(
  plan: NavigationPlan,
  turnAt: number,
  currentAt: number,
  landmarks: Landmark[],
  context: { now: number; night: boolean; vehicle: VehicleKind; city: string },
): LandmarkRelation | undefined {
  const candidates: LandmarkRelation[] = [];
  for (const l of landmarks) {
    if (
      l.city !== context.city ||
      !verifiedLandmark(l, context.now) ||
      !l.visibility ||
      (context.night ? !l.visibility.night : !l.visibility.day)
    )
      continue;
    if (
      l.entrance &&
      (l.entrance.access !== "vehicle" ||
        (l.entrance.allowedVehicles &&
          !l.entrance.allowedVehicles.includes(context.vehicle)))
    )
      continue;
    // Parcel counting requires complete, reviewed sequence; it is resolved separately, never by satellite guesses.
    if (l.kind === "parcel") continue;
    const hits = project(l, plan.points),
      hit = hits[0];
    if (
      !hit ||
      hit.distance > 18 ||
      angleDifference(hit.bearing, l.visibility.bearing) >
        l.visibility.tolerance
    )
      continue;
    if (
      hits.some(
        (h) =>
          h.distance < hit.distance + 8 && Math.abs(h.along - hit.along) > 60,
      )
    )
      continue;
    const delta = turnAt - hit.along;
    if (
      Math.abs(delta) < 12 ||
      Math.abs(delta) > 120 ||
      hit.along < currentAt - 15
    )
      continue;
    // After-turn landmarks may only augment arrival. At a turn they may be on its outgoing branch.
    if (delta < 0) continue;
    candidates.push({ landmark: l, relation: "after", distanceToTurn: delta });
  }
  return candidates.sort(
    (a, b) =>
      a.distanceToTurn - b.distanceToTurn ||
      a.landmark.id.localeCompare(b.landmark.id),
  )[0];
}
export function verifiedParcel(
  anchor: Landmark,
  entries: Landmark[],
  ordinal: number,
  segmentId: string,
  direction: number,
  now: number,
): Landmark | undefined {
  if (
    !verifiedLandmark(anchor, now) ||
    !Number.isInteger(ordinal) ||
    ordinal < 1 ||
    ordinal > 10
  )
    return undefined;
  const candidates = entries
    .filter(
      (e) =>
        e.kind === "parcel" &&
        verifiedLandmark(e, now) &&
        e.city === anchor.city &&
        e.parcel?.sequenceVerified &&
        e.parcel.anchorId === anchor.id &&
        e.parcel.segmentId === segmentId &&
        angleDifference(direction, e.parcel.directionBearing) < 20,
    )
    .sort((a, b) => a.parcel!.sequence - b.parcel!.sequence);
  const selected = candidates[ordinal - 1];
  if (!selected || selected.parcel!.sequence !== ordinal) return undefined;
  const ids = selected.parcel!.orderedIds;
  if (
    ids.length !== candidates.length ||
    candidates.some(
      (e, i) =>
        e.parcel!.sequence !== i + 1 ||
        ids[i] !== e.id ||
        e.parcel!.orderedIds.join("|") !== ids.join("|"),
    )
  )
    return undefined;
  return selected;
}

/** Re-evaluate visibility at announcement time: a journey may cross dusk after its plan was loaded. */
export function navigationLandmarkNight(
  city: string,
  now: number,
  initialNight: boolean,
) {
  if (city === "fixture") return initialNight;
  if (initialNight) return true; // Retain the stricter visibility requirement during this session.
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: city === "kinshasa" ? "Africa/Kinshasa" : "Africa/Lubumbashi",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(new Date(now)),
    );
    return !Number.isFinite(hour) || hour >= 18 || hour < 6;
  } catch {
    return true;
  }
}
