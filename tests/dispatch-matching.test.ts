import { describe, expect, it, vi } from "vitest";
import type { Trip } from "@pepo/types/model";
import { PLACES } from "@pepo/utils/cities";
import type { LocatedDriver } from "../apps/api/src/dispatch/availableDrivers";
import { matchDispatchBatch } from "../apps/api/src/dispatch/matching";
import { computeCandidateEtas } from "../apps/api/src/dispatch/routeMatrix";

function trip(id: string, index: number): Trip {
  const pickup = { ...PLACES[index] };
  return {
    id,
    riderId: `rider-${id}`,
    riderName: id,
    riderVerification: "verified",
    pickup,
    destination: { ...PLACES[(index + 1) % PLACES.length] },
    vehicle: "moto",
    proposedPrice: 5000,
    status: "searching",
    offers: [],
    route: {
      points: [pickup],
      distanceKm: 1,
      durationMin: 5,
      source: "estimate",
    },
    createdAt: 1,
    updatedAt: 1,
    payment: "cash",
  };
}

function driver(id: string, index: number): LocatedDriver {
  const position = PLACES[index];
  return {
    id,
    city: position.city,
    vehicle: "moto",
    cell: "test-cell",
    latitude: position.latitude + 0.002,
    longitude: position.longitude + 0.002,
    capturedAt: 1,
  };
}

describe("batched dispatch matching", () => {
  it("assigns the shared closest driver to the rider who benefits most", () => {
    const result = matchDispatchBatch(
      [
        { tripId: "A", slots: 1 },
        { tripId: "B", slots: 1 },
      ],
      [
        { tripId: "A", driverId: "D1", etaSeconds: 240 },
        { tripId: "A", driverId: "D2", etaSeconds: 300 },
        { tripId: "B", driverId: "D1", etaSeconds: 120 },
        { tripId: "B", driverId: "D2", etaSeconds: 900 },
      ],
    );

    expect(result).toEqual([
      { tripId: "A", driverId: "D2", etaSeconds: 300 },
      { tripId: "B", driverId: "D1", etaSeconds: 120 },
    ]);
  });

  it("covers as many requests as possible before giving a trip a second invite", () => {
    const result = matchDispatchBatch(
      [
        { tripId: "A", slots: 2 },
        { tripId: "B", slots: 1 },
      ],
      [
        { tripId: "A", driverId: "D1", etaSeconds: 100 },
        { tripId: "A", driverId: "D2", etaSeconds: 110 },
        { tripId: "A", driverId: "D3", etaSeconds: 120 },
        { tripId: "B", driverId: "D1", etaSeconds: 105 },
      ],
    );

    expect(result).toHaveLength(3);
    expect(result.filter((edge) => edge.tripId === "A")).toHaveLength(2);
    expect(result.filter((edge) => edge.tripId === "B")).toHaveLength(1);
    expect(new Set(result.map((edge) => edge.driverId)).size).toBe(3);
    expect(result.find((edge) => edge.tripId === "B")?.driverId).toBe("D1");
  });
});

describe("traffic-aware ETA matrix", () => {
  it("maps Google road durations back to only the eligible candidate edges", async () => {
    const a = trip("matrix-a", 0);
    const b = trip("matrix-b", 1);
    const d1 = driver("matrix-d1", 2);
    const d2 = driver("matrix-d2", 3);
    const fetcher = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        expect(body.travelMode).toBe("DRIVE");
        expect(body.routingPreference).toBe("TRAFFIC_AWARE");
        expect(body.origins).toHaveLength(1);
        expect(body.destinations).toHaveLength(1);
        const isFirstTrip =
          body.destinations[0].waypoint.location.latLng.latitude ===
          a.pickup.latitude;
        return new Response(
          JSON.stringify([
            {
              originIndex: 0,
              destinationIndex: 0,
              duration: isFirstTrip ? "240s" : "120s",
              condition: "ROUTE_EXISTS",
              status: { code: 0 },
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    );

    const result = await computeCandidateEtas(
      [a, b],
      [d1, d2],
      [
        { tripId: a.id, driverId: d1.id },
        { tripId: b.id, driverId: d2.id },
      ],
      "test-key",
      1_700_000_000_000,
      fetcher,
    );

    expect(result.source).toBe("google");
    expect(result.candidates).toEqual([
      { tripId: a.id, driverId: d1.id, etaSeconds: 240 },
      { tripId: b.id, driverId: d2.id, etaSeconds: 120 },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("uses a bounded estimate when the Routes API is not configured", async () => {
    const ride = trip("estimate-a", 0);
    const cab = driver("estimate-d1", 1);
    const fetcher = vi.fn();
    const result = await computeCandidateEtas(
      [ride],
      [cab],
      [{ tripId: ride.id, driverId: cab.id }],
      undefined,
      1_800_000_000_000,
      fetcher as typeof fetch,
    );

    expect(result.source).toBe("estimate");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].etaSeconds).toBeGreaterThan(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
