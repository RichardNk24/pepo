import { gridDisk, latLngToCell } from "h3-js";
import type { Trip } from "@pepo/types/model";
import { haversine } from "@pepo/utils/rules";
import type { Store } from "../database";

export const H3_DISPATCH_RESOLUTION = 9;
export const DRIVER_LOCATION_MAX_AGE_MS = 45_000;
const MAX_SHORTLIST = 24;

export type LocatedDriver = {
  id: string;
  city: string;
  vehicle: string;
  cell: string;
  latitude: number;
  longitude: number;
  capturedAt: number;
};

/** H3 prefilter for the bounded ETA stage; does not claim a road-time rank. */
export function availableDriverPositions(
  store: Store,
  trip: Trip,
  now = Date.now(),
  limit = MAX_SHORTLIST,
  excludedDriverIds: string[] = [],
): LocatedDriver[] {
  if (limit <= 0 || limit > 24)
    throw new RangeError("Dispatch shortlist limit must be 1–24.");
  const pickupCell = latLngToCell(
    trip.pickup.latitude,
    trip.pickup.longitude,
    H3_DISPATCH_RESOLUTION,
  );
  let located: LocatedDriver[] = [];

  // Expand through contiguous H3 disks, stopping as soon as the shortlist is
  // useful. The final radius covers a few urban kilometres at resolution 9.
  for (let radius = 0; radius <= 12; radius += 2) {
    const cells = gridDisk(pickupCell, radius);
    const placeholders = cells.map(() => "?").join(",");
    located = store.db
      .prepare(
        `SELECT p.userId AS id,p.city,p.vehicle,p.cell,p.latitude,p.longitude,p.capturedAt
         FROM driver_positions p
         JOIN users u ON u.id=p.userId
         JOIN driver_profiles d ON d.userId=p.userId
         WHERE p.city=? AND p.vehicle=? AND p.cell IN (${placeholders})
           AND p.capturedAt>=? AND p.capturedAt<=? AND p.accuracy<=150
           AND json_extract(u.data,'$.city')=?
           AND json_extract(d.data,'$.online')=1
           AND json_extract(d.data,'$.verification')='verified'
           AND json_extract(d.data,'$.vehicle.vehicle')=?
           AND p.userId<>?
           ${excludedDriverIds.length ? `AND p.userId NOT IN (${excludedDriverIds.map(() => "?").join(",")})` : ""}
           AND NOT EXISTS (
             SELECT 1 FROM trips t WHERE t.driverId=p.userId
               AND t.status IN ('accepted','arrived','in_progress')
           )
         ORDER BY p.capturedAt DESC LIMIT 120`,
      )
      .all(
        trip.pickup.city,
        trip.vehicle,
        ...cells,
        now - DRIVER_LOCATION_MAX_AGE_MS,
        now + 2_000,
        trip.pickup.city,
        trip.vehicle,
        trip.riderId,
        ...excludedDriverIds,
      ) as LocatedDriver[];
    if (located.length >= limit || radius === 12) break;
  }
  return located
    .sort(
      (a, b) =>
        haversine(a, trip.pickup) - haversine(b, trip.pickup) ||
        b.capturedAt - a.capturedAt,
    )
    .slice(0, limit);
}

/** Compatibility feed for older clients; GPS candidates are H3-prefiltered. */
export function availableDriverIds(store: Store, trip: Trip, now = Date.now()) {
  const located = availableDriverPositions(store, trip, now);
  const ranked = located.map((driver) => driver.id);
  if (ranked.length < MAX_SHORTLIST) {
    const excluded = ranked.length
      ? `AND u.id NOT IN (${ranked.map(() => "?").join(",")})`
      : "";
    const legacy = store.db
      .prepare(
        `SELECT u.id FROM users u
         JOIN driver_profiles d ON d.userId=u.id
         WHERE json_extract(d.data,'$.online')=1
           AND json_extract(d.data,'$.verification')='verified'
           AND json_extract(u.data,'$.city')=?
           AND json_extract(d.data,'$.vehicle.vehicle')=?
           AND u.id<>? ${excluded}
           AND NOT EXISTS (SELECT 1 FROM driver_positions p WHERE p.userId=u.id)
           AND NOT EXISTS (SELECT 1 FROM trips t WHERE t.driverId=u.id
             AND t.status IN ('accepted','arrived','in_progress'))
         LIMIT ?`,
      )
      .all(
        trip.pickup.city,
        trip.vehicle,
        trip.riderId,
        ...ranked,
        MAX_SHORTLIST - ranked.length,
      ) as { id: string }[];
    ranked.push(...legacy.map((driver) => driver.id));
  }
  return [...new Set(ranked)];
}
