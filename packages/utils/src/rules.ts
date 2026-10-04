import type {
NewTrip,
Place,
Point,
Profile,
Route,
Trip,
TripStatus,
VehicleKind,
} from "@pepo/types/model";
export class RuleError extends Error {}

export const fare = (n: number) =>
  `${Math.round(n).toLocaleString("fr-FR")} FC`;
export const haversine = (a: Point, b: Point) => {
  const rad = (n: number) => (n * Math.PI) / 180;
  const lat = rad(b.latitude - a.latitude),
    lon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(lat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(lon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
export function estimateRoute(a: Point, b: Point): Route {
  // Visual estimate only. Never represents road navigation.
  const distanceKm = Math.max(0.3, Math.round(haversine(a, b) * 1.3 * 10) / 10);
  return {
    points: [
      a,
      {
        latitude: a.latitude + (b.latitude - a.latitude) * 0.25,
        longitude: a.longitude,
      },
      {
        latitude: a.latitude + (b.latitude - a.latitude) * 0.25,
        longitude: a.longitude + (b.longitude - a.longitude) * 0.45,
      },
      {
        latitude: b.latitude,
        longitude: a.longitude + (b.longitude - a.longitude) * 0.45,
      },
      b,
    ],
    distanceKm,
    durationMin: Math.max(3, Math.round(distanceKm * 3)),
    source: "estimate",
  };
}
export function suggestedFare(km: number, vehicle: VehicleKind) {
  const rates = {
    moto: [1500, 750],
    comfort: [2000, 1000],
    taxi: [3500, 1500],
    suv: [5000, 2000],
    fourByFour: [6500, 2500],
    minibus: [7000, 2500],
    tricycle: [2500, 1250],
    pickupTruck: [8500, 3000],
    truck: [15000, 4500],
  };
  const [base, perKm] = rates[vehicle];
  return Math.max(1000, Math.round((base + km * perKm) / 500) * 500);
}
export function canDrive(p: Profile) {
  return (
    p.role === "driver" &&
    !!p.driver &&
    ["verified", "demo"].includes(p.verification)
  );
}
export function validateNewTrip(input: NewTrip) {
  if (
    (input.stops?.length || 0) > 3 ||
    input.stops?.some(
      (p) =>
        p.city !== input.pickup.city ||
        !Number.isFinite(p.latitude) ||
        !Number.isFinite(p.longitude),
    )
  )
    throw new RuleError("Choisissez jusqu’à 3 étapes dans la ville du départ.");
  if (
    input.scheduledAt !== undefined &&
    (!Number.isSafeInteger(input.scheduledAt) ||
      input.scheduledAt < Date.now() + 30 * 60000 ||
      input.scheduledAt > Date.now() + 30 * 86400000)
  )
    throw new RuleError(
      "Choisissez un départ entre 30 minutes et 30 jours à partir de maintenant.",
    );
  if (
    input.guest &&
    (input.guest.name.trim().length < 2 ||
      input.guest.name.trim().length > 80 ||
      !/^\+[1-9]\d{7,14}$/.test(input.guest.phone || ""))
  )
    throw new RuleError(
      "Indiquez le nom et le téléphone du passager au format international, par exemple +243…",
    );
  if (input.pickup.city !== input.destination.city)
    throw new RuleError(
      "Choisissez un départ et une destination dans la même ville.",
    );
  if (haversine(input.pickup, input.destination) < 0.1)
    throw new RuleError("La destination est trop proche du départ.");
  if (
    !Number.isInteger(input.proposedPrice) ||
    input.proposedPrice < 500 ||
    input.proposedPrice > 500000
  )
    throw new RuleError("Proposez un prix compris entre 500 et 500 000 FC.");
}
const transitions: Record<TripStatus, TripStatus[]> = {
  scheduled: ["cancelled"],
  searching: ["accepted", "cancelled"],
  accepted: ["arrived", "cancelled"],
  arrived: ["in_progress", "cancelled"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};
export function assertTransition(
  trip: Trip,
  next: TripStatus,
  actor: Profile,
  pin?: string,
) {
  if (!transitions[trip.status].includes(next))
    throw new RuleError(
      "Cette action n’est plus disponible pour cette course.",
    );
  const rider = actor.id === trip.riderId;
  const driver = actor.id === trip.driverId;
  if (!rider && !driver)
    throw new RuleError("Vous ne participez pas à cette course.");
  if (["arrived", "in_progress", "completed"].includes(next) && !driver)
    throw new RuleError("Seul le conducteur peut effectuer cette action.");
  if (next === "accepted" && !rider)
    throw new RuleError("Le passager doit choisir une offre.");
  if (next === "in_progress" && (!pin || pin !== trip.pickupPin))
    throw new RuleError("Le code de départ est incorrect.");
}
export function decodePolyline(encoded: string): Point[] {
  const out: Point[] = [];
  let index = 0,
    lat = 0,
    lng = 0;
  while (index < encoded.length) {
    const read = () => {
      let result = 0,
        shift = 0,
        b = 0;
      do {
        if (index >= encoded.length || shift > 30)
          throw new RuleError("Itinéraire invalide.");
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 31) << shift;
        shift += 5;
      } while (b >= 32);
      return result & 1 ? ~(result >> 1) : result >> 1;
    };
    lat += read();
    lng += read();
    out.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return out;
}

export function estimateRouteWithStops(
  pickup: Place,
  destination: Place,
  stops: Place[] = [],
): Route {
  const waypoints = [pickup, ...stops, destination];
  const legs = waypoints.slice(1).map((p, i) => estimateRoute(waypoints[i], p));
  return {
    points: legs.flatMap((leg, i) => (i ? leg.points.slice(1) : leg.points)),
    distanceKm:
      Math.round(legs.reduce((n, leg) => n + leg.distanceKm, 0) * 10) / 10,
    durationMin: legs.reduce((n, leg) => n + leg.durationMin, 0),
    source: "estimate",
  };
}
