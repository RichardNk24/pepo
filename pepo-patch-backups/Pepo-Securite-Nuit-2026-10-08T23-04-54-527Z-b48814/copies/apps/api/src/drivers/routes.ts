import { z } from "zod";

import { wrap, type RouteContext } from "../runtime";
export function register_drivers(ctx: RouteContext) {
  const { app, store, visibleTrip, requireDriver } = ctx;
  app.post(
    "/api/me/online",
    wrap((req, res) => {
      const { online } = z.object({ online: z.boolean() }).parse(req.body);
      if (online) requireDriver(req.actor);
      req.actor.online = online;
      store.saveUser(req.actor);
      res.json(req.actor);
    }),
  );
  app.get(
    "/api/requests",
    wrap((req, res) => {
      requireDriver(req.actor);
      if (!req.actor.online || store.activeFor(req.actor.id).length)
        return res.json([]);
      res.json(
        store
          .trips(
            "SELECT data FROM trips WHERE city=? AND vehicle=? AND status='searching' ORDER BY createdAt DESC LIMIT 30",
            req.actor.city,
            req.actor.driver!.vehicle,
          )
          .filter((t) => t.riderId !== req.actor.id)
          .map((t) => visibleTrip(t, req.actor)),
      );
    }),
  );
}
