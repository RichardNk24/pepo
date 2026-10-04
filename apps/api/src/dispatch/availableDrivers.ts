import type { Trip } from "@pepo/types/model";
import type { Store } from "../database";
/** Indexed capabilities and separate profiles replace a scan of every user at each request. */
export function availableDriverIds(store: Store, trip: Trip) {
  return (
    store.db
      .prepare(
        `SELECT u.id FROM users u
 JOIN driver_profiles d ON d.userId=u.id
 WHERE json_extract(d.data,'$.online')=1
 AND json_extract(d.data,'$.verification')='verified'
 AND json_extract(u.data,'$.city')=?
 AND json_extract(d.data,'$.vehicle.vehicle')=?
 AND u.id<>?
 AND NOT EXISTS (SELECT 1 FROM trips t WHERE t.driverId=u.id AND t.status IN ('accepted','arrived','in_progress'))`,
      )
      .all(trip.pickup.city, trip.vehicle, trip.riderId) as { id: string }[]
  ).map((p) => p.id);
}
