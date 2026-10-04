import { isActive,type CityId,type Trip } from "@pepo/types/model";
export const DISPATCH_LEAD = 15 * 60000;
export const SCHEDULE_GRACE = 30 * 60000;
export const cityTimeZone = (city: CityId) =>
  city === "kinshasa" ? "Africa/Kinshasa" : "Africa/Lubumbashi";
export const scheduledLabel = (timestamp: number, city: CityId) =>
  new Date(timestamp).toLocaleString("fr-FR", {
    timeZone: cityTimeZone(city),
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export function scheduleSlots(now: number, city: CityId, day: number) {
  const offset = (city === "kinshasa" ? 1 : 2) * 3600000;
  const local = new Date(now + offset);
  const midnight =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() + day,
    ) - offset;
  return Array.from({ length: 48 }, (_, i) => midnight + i * 30 * 60000).filter(
    (t) => t >= now + 30 * 60000 && t <= now + 30 * 86400000,
  );
}
// Pure transition shared by the persistent server worker and the local demo.
// Never confirms a driver or a price automatically.
export function releaseScheduled(trips: Trip[], now: number): Trip[] {
  const busy = new Set(trips.filter(isActive).map((t) => t.riderId));
  const changes: Trip[] = [];
  for (const trip of [...trips].sort(
    (a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0),
  )) {
    if (!["scheduled", "searching"].includes(trip.status) || !trip.scheduledAt)
      continue;
    if (now > trip.scheduledAt + SCHEDULE_GRACE) {
      changes.push({
        ...trip,
        status: "cancelled",
        updatedAt: now,
        cancellationReason:
          "Le créneau de départ a expiré sans conducteur confirmé.",
      });
    } else if (
      trip.status === "scheduled" &&
      now >= trip.scheduledAt - DISPATCH_LEAD &&
      !busy.has(trip.riderId)
    ) {
      busy.add(trip.riderId);
      changes.push({
        ...trip,
        status: "searching",
        dispatchStartedAt: now,
        updatedAt: now,
      });
    }
  }
  return changes;
}
