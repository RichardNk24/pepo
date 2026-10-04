import { describe, it, expect } from "vitest";
import {
  decodePolyline,
  estimateRoute,
  haversine,
  suggestedFare,
  validateNewTrip,
} from "@pepo/utils/rules";
import { PLACES } from "@pepo/utils/cities";
describe("Geometry and booking constraints", () => {
  it("decodes a standard Google route to exact coordinates", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });
  it("rejects a truncated polyline rather than looping forever", () =>
    expect(() => decodePolyline("_p~iF")).toThrow());
  it("keeps indicative routes anchored to the chosen endpoints", () => {
    const route = estimateRoute(PLACES[0], PLACES[2]);
    expect(route.points[0]).toBe(PLACES[0]);
    expect(route.points.at(-1)).toBe(PLACES[2]);
    expect(route.source).toBe("estimate");
    expect(route.distanceKm).toBeGreaterThan(haversine(PLACES[0], PLACES[2]));
  });
  it("rounds all suggested prices to the local negotiating step", () => {
    for (const v of ["moto", "comfort", "taxi"] as const)
      expect(suggestedFare(3.27, v) % 500).toBe(0);
    expect(suggestedFare(3, "taxi")).toBeGreaterThan(suggestedFare(3, "moto"));
  });
  it("rejects the same pickup and dropoff", () =>
    expect(() =>
      validateNewTrip({
        pickup: PLACES[0],
        destination: PLACES[0],
        vehicle: "moto",
        proposedPrice: 5000,
        route: estimateRoute(PLACES[0], PLACES[0]),
      }),
    ).toThrow());
  it("rejects cross-city bookings and invalid prices", () => {
    expect(() =>
      validateNewTrip({
        pickup: PLACES[0],
        destination: PLACES[6],
        vehicle: "moto",
        proposedPrice: 5000,
        route: estimateRoute(PLACES[0], PLACES[6]),
      }),
    ).toThrow();
    expect(() =>
      validateNewTrip({
        pickup: PLACES[0],
        destination: PLACES[2],
        vehicle: "moto",
        proposedPrice: -100,
        route: estimateRoute(PLACES[0], PLACES[2]),
      }),
    ).toThrow();
  });
});
