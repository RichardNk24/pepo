import type { Profile, Trip } from "@pepo/types/model";
import type { Store } from "../database";
import {
  availableDriverPositions,
  DRIVER_LOCATION_MAX_AGE_MS,
  type LocatedDriver,
} from "./availableDrivers";
import { matchDispatchBatch } from "./matching";
import { computeCandidateEtas } from "./routeMatrix";

const BATCH_WINDOW_MS = 1_500;
const TICK_MS = 1_000;
const INVITE_TTL_MS = 9_000;
const MAX_TRIPS_PER_BATCH = 8;
const MAX_DRIVERS_PER_TRIP = 8;
const MAX_INVITES_PER_TRIP = 3;

type DispatchNotifier = (driverIds: string[]) => void;
type Eligibility = (trip: Trip, driver: Profile) => boolean;
type CandidateGroup = {
  trips: Trip[];
  drivers: Map<string, LocatedDriver>;
  edges: { tripId: string; driverId: string }[];
  slots: Map<string, number>;
};

/**
 * Recommends driver/request pairs in short batches. Drivers are only invited;
 * they still submit a price and the rider still chooses a driver.
 */
export function createDispatchService(
  store: Store,
  googleKey: string | undefined,
  eligible: Eligibility,
  notifyDrivers: DispatchNotifier,
  now: () => number = Date.now,
) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    const timestamp = now();
    try {
      store.db
        .prepare(
          "UPDATE dispatch_recommendations SET status='expired' WHERE status='pending' AND expiresAt<=?",
        )
        .run(timestamp);
      store.db
        .prepare(
          `UPDATE dispatch_recommendations SET status='cancelled' WHERE status='pending'
           AND tripId IN (SELECT id FROM trips WHERE status<>'searching')`,
        )
        .run();

      const trips = store
        .trips(
          `SELECT data FROM trips WHERE status='searching' AND createdAt<=?
           AND json_array_length(data,'$.offers')<?
           ORDER BY createdAt ASC LIMIT 100`,
          timestamp - BATCH_WINDOW_MS,
          MAX_INVITES_PER_TRIP,
        )
        .filter((trip) => trip.offers.length < MAX_INVITES_PER_TRIP)
        .slice(0, MAX_TRIPS_PER_BATCH);
      if (!trips.length) return;

      const pendingRows = store.db
        .prepare(
          "SELECT tripId,driverId,etaSeconds FROM dispatch_recommendations WHERE status='pending' AND expiresAt>?",
        )
        .all(timestamp) as {
        tripId: string;
        driverId: string;
        etaSeconds: number;
      }[];
      const pendingDrivers = new Set(pendingRows.map((row) => row.driverId));
      const pendingPerTrip = new Map<string, number>();
      for (const row of pendingRows)
        pendingPerTrip.set(
          row.tripId,
          (pendingPerTrip.get(row.tripId) || 0) + 1,
        );

      const candidatesByGroup = new Map<string, CandidateGroup>();
      for (const trip of trips) {
        const groupKey = `${trip.pickup.city}:${trip.vehicle}`;
        const group: CandidateGroup = candidatesByGroup.get(groupKey) || {
          trips: [],
          drivers: new Map(),
          edges: [],
          slots: new Map(),
        };
        group.trips.push(trip);
        group.slots.set(
          trip.id,
          Math.max(
            0,
            MAX_INVITES_PER_TRIP -
              trip.offers.length -
              (pendingPerTrip.get(trip.id) || 0),
          ),
        );
        const alreadyOffered = trip.offers.map((offer) => offer.driver.id);
        const nearby = availableDriverPositions(
          store,
          trip,
          timestamp,
          MAX_DRIVERS_PER_TRIP,
          [...new Set([...alreadyOffered, ...pendingDrivers])],
        );
        for (const driver of nearby) {
          const profile = store.user(driver.id, "driver");
          if (!profile || !eligible(trip, profile)) continue;
          group.drivers.set(driver.id, driver);
          group.edges.push({ tripId: trip.id, driverId: driver.id });
        }
        candidatesByGroup.set(groupKey, group);
      }

      const newlyInvited: string[] = [];
      for (const group of candidatesByGroup.values()) {
        if (!group.edges.length) continue;
        // Up to 8 trips × 8 candidates each keeps each Google route matrix
        // below the 625-element Routes API ceiling.
        const eta = await computeCandidateEtas(
          group.trips,
          [...group.drivers.values()],
          group.edges,
          googleKey,
          timestamp,
        );
        const assignments = matchDispatchBatch(
          [...group.slots].map(([tripId, slots]) => ({ tripId, slots })),
          eta.candidates,
        );
        if (!assignments.length) continue;

        store.atomic(() => {
          for (const assignment of assignments) {
            const trip = store.trip(assignment.tripId);
            const driver = store.user(assignment.driverId, "driver");
            if (
              !trip ||
              trip.status !== "searching" ||
              trip.offers.length >= MAX_INVITES_PER_TRIP ||
              trip.offers.some(
                (offer) => offer.driver.id === assignment.driverId,
              ) ||
              !driver?.online ||
              !eligible(trip, driver) ||
              store.activeFor(driver.id).length ||
              store.db
                .prepare(
                  "SELECT 1 FROM dispatch_recommendations WHERE driverId=? AND status='pending' AND expiresAt>?",
                )
                .get(driver.id, timestamp)
            )
              continue;
            const inserted = store.db
              .prepare(
                `INSERT INTO dispatch_recommendations
                 (tripId,driverId,etaSeconds,status,createdAt,expiresAt)
                 VALUES(?,?,?,'pending',?,?)
                 ON CONFLICT(tripId,driverId) DO UPDATE SET
                   etaSeconds=excluded.etaSeconds,status='pending',
                   createdAt=excluded.createdAt,expiresAt=excluded.expiresAt
                 WHERE dispatch_recommendations.status IN ('expired','cancelled')`,
              )
              .run(
                trip.id,
                driver.id,
                assignment.etaSeconds,
                timestamp,
                timestamp + INVITE_TTL_MS,
              );
            if (inserted.changes) newlyInvited.push(driver.id);
          }
        });
      }
      if (newlyInvited.length) notifyDrivers([...new Set(newlyInvited)]);
    } catch (error) {
      console.error(
        "[dispatch] matching cycle failed",
        (error as Error).message,
      );
    } finally {
      running = false;
    }
  }

  return {
    tick,
    start() {
      if (timer) return;
      void tick();
      timer = setInterval(() => void tick(), TICK_MS);
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
    recommendationFor(driverId: string, tripId: string, timestamp = now()) {
      return store.db
        .prepare(
          `SELECT etaSeconds,expiresAt FROM dispatch_recommendations
           WHERE driverId=? AND tripId=? AND status='pending' AND expiresAt>?`,
        )
        .get(driverId, tripId, timestamp) as
        | { etaSeconds: number; expiresAt: number }
        | undefined;
    },
    pendingTripsFor(driverId: string, timestamp = now()) {
      return store.db
        .prepare(
          `SELECT tripId,etaSeconds,expiresAt FROM dispatch_recommendations
           WHERE driverId=? AND status='pending' AND expiresAt>? ORDER BY etaSeconds ASC`,
        )
        .all(driverId, timestamp) as {
        tripId: string;
        etaSeconds: number;
        expiresAt: number;
      }[];
    },
    locationIsFresh(driverId: string, timestamp = now()) {
      return Boolean(
        store.db
          .prepare(
            "SELECT 1 FROM driver_positions WHERE userId=? AND capturedAt>=? AND capturedAt<=?",
          )
          .get(
            driverId,
            timestamp - DRIVER_LOCATION_MAX_AGE_MS,
            timestamp + 2000,
          ),
      );
    },
  };
}
