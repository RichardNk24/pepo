import type { Trip } from "@pepo/types/model";
import { haversine } from "@pepo/utils/rules";
import type { LocatedDriver } from "./availableDrivers";
import type { DispatchCandidate } from "./matching";

type MatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  duration?: string;
  condition?: string;
  status?: { code?: number };
};

type EtaResult = {
  candidates: DispatchCandidate[];
  source: "google" | "estimate";
};

const etaCache = new Map<
  string,
  { etaSeconds: number; expiresAt: number; source: "google" | "estimate" }
>();
const CACHE_TTL_MS = 20_000;
const PROVIDER_BACKOFF_MS = 10_000;
let providerBackoffUntil = 0;

function estimateEtaSeconds(driver: LocatedDriver, trip: Trip) {
  // A conservative city-speed proxy is used only when Routes API is disabled
  // or temporarily unavailable. It must never be presented as a live ETA.
  return Math.max(
    60,
    Math.round((haversine(driver, trip.pickup) * 1.7 * 3600) / 12),
  );
}

function cacheKey(driver: LocatedDriver, trip: Trip, now: number) {
  // Keep the memoization tight enough that GPS movement does not reuse a
  // meaningfully stale route ETA. 5 decimals is roughly metre-level.
  const round = (value: number) => value.toFixed(5);
  return [
    driver.city,
    driver.vehicle,
    round(driver.latitude),
    round(driver.longitude),
    round(trip.pickup.latitude),
    round(trip.pickup.longitude),
    Math.floor(now / CACHE_TTL_MS),
  ].join(":");
}

/** Google traffic-aware matrix for a bounded H3 candidate graph. */
export async function computeCandidateEtas(
  trips: Trip[],
  drivers: LocatedDriver[],
  edges: Array<{ tripId: string; driverId: string }>,
  apiKey: string | undefined,
  now = Date.now(),
  fetcher: typeof fetch = fetch,
): Promise<EtaResult> {
  const byTrip = new Map(trips.map((trip) => [trip.id, trip]));
  const byDriver = new Map(drivers.map((driver) => [driver.id, driver]));
  const candidates: DispatchCandidate[] = [];
  let usedEstimate = false;
  let providerFailed = false;
  const failedTripIds = new Set<string>();
  for (const [key, value] of etaCache)
    if (value.expiresAt <= now) etaCache.delete(key);
  const uncached = new Map<
    string,
    { driver: LocatedDriver; trip: Trip; edgeKeys: string[] }
  >();
  for (const edge of edges) {
    const driver = byDriver.get(edge.driverId);
    const trip = byTrip.get(edge.tripId);
    if (!driver || !trip) continue;
    const key = cacheKey(driver, trip, now);
    const cached = etaCache.get(key);
    if (cached && cached.expiresAt > now) {
      usedEstimate ||= cached.source === "estimate";
      candidates.push({
        tripId: trip.id,
        driverId: driver.id,
        etaSeconds: cached.etaSeconds,
      });
    } else {
      const pair = `${driver.id}\u0000${trip.id}`;
      uncached.set(pair, { driver, trip, edgeKeys: [key] });
    }
  }

  const candidatesByTrip = new Map<string, string[]>();
  for (const { driver, trip } of uncached.values()) {
    const origins = candidatesByTrip.get(trip.id) || [];
    origins.push(driver.id);
    candidatesByTrip.set(trip.id, origins);
  }
  const canRequestMatrix =
    Boolean(apiKey) && candidatesByTrip.size > 0 && now >= providerBackoffUntil;

  if (canRequestMatrix) {
    // Compute only eligible driver→pickup pairs. A full Cartesian matrix can
    // bill many impossible driver/trip combinations that matching will ignore.
    const results = await Promise.all(
      [...candidatesByTrip].map(async ([tripId, origins]) => {
        const trip = byTrip.get(tripId)!;
        try {
          const response = await fetcher(
            "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
            {
              method: "POST",
              signal: AbortSignal.timeout(2200),
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": apiKey!,
                "X-Goog-FieldMask":
                  "originIndex,destinationIndex,status,condition,duration",
              },
              body: JSON.stringify({
                origins: origins.map((id) => {
                  const driver = byDriver.get(id)!;
                  return {
                    waypoint: {
                      location: {
                        latLng: {
                          latitude: driver.latitude,
                          longitude: driver.longitude,
                        },
                      },
                    },
                  };
                }),
                destinations: [
                  {
                    waypoint: {
                      location: {
                        latLng: {
                          latitude: trip.pickup.latitude,
                          longitude: trip.pickup.longitude,
                        },
                      },
                    },
                  },
                ],
                travelMode: "DRIVE",
                routingPreference: "TRAFFIC_AWARE",
                departureTime: new Date(now).toISOString(),
              }),
            },
          );
          if (!response.ok)
            throw new Error(`Routes matrix returned ${response.status}`);
          const elements = (await response.json()) as MatrixElement[];
          return {
            tripId,
            origins,
            secondsByDriver: new Map(
              elements.flatMap((element) => {
                const driverId = origins[element.originIndex ?? -1];
                const duration = Number.parseFloat(element.duration || "");
                return driverId &&
                  (element.destinationIndex ?? 0) === 0 &&
                  (!element.status?.code || element.status.code === 0) &&
                  element.condition === "ROUTE_EXISTS" &&
                  Number.isFinite(duration) &&
                  duration > 0
                  ? [[driverId, Math.round(duration)] as const]
                  : [];
              }),
            ),
            failed: false,
          };
        } catch (error) {
          const firstFailure = !providerFailed;
          providerFailed = true;
          failedTripIds.add(tripId);
          if (firstFailure)
            console.warn(
              "[dispatch] Google ETA matrix unavailable; using conservative estimate.",
              (error as Error).message,
            );
          return { tripId, origins, secondsByDriver: new Map(), failed: true };
        }
      }),
    );
    for (const result of results) {
      for (const driverId of result.origins) {
        const pair = `${driverId}\u0000${result.tripId}`;
        const data = uncached.get(pair);
        const seconds = result.secondsByDriver.get(driverId);
        if (!data || seconds === undefined) continue;
        candidates.push({
          tripId: data.trip.id,
          driverId: data.driver.id,
          etaSeconds: seconds,
        });
        for (const key of data.edgeKeys)
          etaCache.set(key, {
            etaSeconds: seconds,
            expiresAt: now + CACHE_TTL_MS,
            source: "google",
          });
      }
    }
    if (providerFailed) providerBackoffUntil = now + PROVIDER_BACKOFF_MS;
  }

  for (const edge of edges) {
    if (
      candidates.some(
        (candidate) =>
          candidate.tripId === edge.tripId &&
          candidate.driverId === edge.driverId,
      )
    )
      continue;
    const driver = byDriver.get(edge.driverId);
    const trip = byTrip.get(edge.tripId);
    if (!driver || !trip) continue;
    if (
      canRequestMatrix &&
      !failedTripIds.has(trip.id) &&
      candidatesByTrip.has(trip.id)
    )
      continue; // Google returned no route for this candidate pair.
    const seconds = estimateEtaSeconds(driver, trip);
    usedEstimate = true;
    candidates.push({
      tripId: trip.id,
      driverId: driver.id,
      etaSeconds: seconds,
    });
    etaCache.set(cacheKey(driver, trip, now), {
      etaSeconds: seconds,
      expiresAt: now + CACHE_TTL_MS,
      source: "estimate",
    });
  }
  return { candidates, source: usedEstimate ? "estimate" : "google" };
}
