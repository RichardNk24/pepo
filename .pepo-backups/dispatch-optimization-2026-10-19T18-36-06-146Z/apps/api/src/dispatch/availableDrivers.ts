import { gridDisk, latLngToCell } from "h3-js";
import type { Trip } from "@pepo/types/model";
import { haversine } from "@pepo/utils/rules";
import type { Store } from "../database";

const H3_RESOLUTION = 9;
const LOCATION_MAX_AGE_MS = 45_000;
const MAX_SHORTLIST = 24;

type LocatedDriver = {
  id: string;
  latitude: number;
  longitude: number;
  capturedAt: number;
};

/**
 * Return a bounded, city/vehicle/availability-filtered dispatch shortlist.
 * H3 is only the first spatial index: road ETA must be calculated for the
 * shortlist before an automatic assignment is ever made.
 */
export function availableDriverIds(store: Store, trip: Trip, now = Date.now()) {
  const pickupCell = latLngToCell(
    trip.pickup.latitude,
    trip.pickup.longitude,
    H3_RESOLUTION,
  );
  let located: LocatedDriver[] = [];

  // Grow the H3 neighborhood until there is a useful candidate set or the
  // search reaches roughly a few kilometres. gridDisk is pentagon-safe.
  for (let radius = 0; radius <= 8; radius += 2) {
    const cells = gridDisk(pickupCell, radius);
    const placeholders = cells.map(() => "?").join(",");
    located = store.db
      .prepare(
        `SELECT p.userId AS id,p.latitude,p.longitude,p.capturedAt
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
        now - LOCATION_MAX_AGE_MS,
        now + 2_000,
        trip.pickup.city,
        trip.vehicle,
        trip.riderId,
      ) as LocatedDriver[];
    if (located.length >= MAX_SHORTLIST || radius === 8) break;
  }

  const ranked = located
    .sort((a, b) => {
      const etaProxyA = haversine(a, trip.pickup);
      const etaProxyB = haversine(b, trip.pickup);
      return etaProxyA - etaProxyB || b.capturedAt - a.capturedAt;
    })
    .slice(0, MAX_SHORTLIST)
    .map((driver) => driver.id);

  // Keep older app versions and development fixtures usable while location
  // reporting rolls out. These rows have no GPS-based rank and only fill gaps.
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
