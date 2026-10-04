import type { EarningsSummary } from "@pepo/types/model";
import { ApiError, wrap, type RouteContext } from "../runtime";
export function registerEarningsResource({ app, store }: RouteContext) {
  app.get(
    "/api/earnings/summary",
    wrap((req, res) => {
      if (req.actor.role !== "driver")
        throw new ApiError(403, "Utilisez Pepo Driver.");
      const trips = store.trips(
        "SELECT data FROM trips WHERE driverId=? AND status='completed'",
        req.actor.id,
      );
      const summary: EarningsSummary = {
        completedTrips: trips.length,
        grossAmount: trips.reduce((n, t) => n + (t.agreedPrice || 0), 0),
        distanceKm:
          Math.round(trips.reduce((n, t) => n + t.route.distanceKm, 0) * 10) /
          10,
        commissionAmount: null,
        netAmount: null,
        currency: "CDF",
      };
      res.json(summary);
    }),
  );
}
