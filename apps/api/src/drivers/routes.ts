import { z } from "zod";
import { latLngToCell } from "h3-js";
import { CITIES } from "@pepo/utils/cities";
import { haversine } from "@pepo/utils/rules";

import { wrap, type RouteContext } from "../runtime";
export function register_drivers(ctx: RouteContext) {
  const { app, store, visibleTrip, requireDriver, safety } = ctx;
  app.post(
    "/api/me/online",
    wrap((req, res) => {
      const { online } = z.object({ online: z.boolean() }).parse(req.body);
      if (online) requireDriver(req.actor);
      req.actor.online = online;
      store.saveUser(req.actor);
      if (!online)
        store.db
          .prepare("DELETE FROM driver_positions WHERE userId=?")
          .run(req.actor.id);
      res.json(req.actor);
    }),
  );
  app.post(
    "/api/me/location",
    wrap((req, res) => {
      requireDriver(req.actor);
      if (!req.actor.online)
        return res
          .status(409)
          .json({ error: "Passez en ligne pour partager votre position." });
      const fix = z
        .object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          accuracy: z.number().min(0).max(10000),
          capturedAt: z.number().int().positive(),
        })
        .parse(req.body);
      const now = Date.now();
      if (fix.capturedAt > now + 2000 || now - fix.capturedAt > 60000)
        return res.status(202).json({ accepted: false, reason: "stale" });
      if (fix.accuracy > 150)
        return res.status(202).json({ accepted: false, reason: "inaccurate" });
      const city = CITIES[req.actor.city];
      if (!city || haversine(fix, city.center) > 60)
        return res
          .status(400)
          .json({ error: "La position est hors de la zone de votre ville." });
      const cell = latLngToCell(fix.latitude, fix.longitude, 9);
      store.db
        .prepare(
          `INSERT INTO driver_positions
        (userId,city,vehicle,cell,latitude,longitude,accuracy,capturedAt,updatedAt)
        VALUES(?,?,?,?,?,?,?,?,?)
        ON CONFLICT(userId) DO UPDATE SET city=excluded.city,vehicle=excluded.vehicle,cell=excluded.cell,
        latitude=excluded.latitude,longitude=excluded.longitude,accuracy=excluded.accuracy,
        capturedAt=excluded.capturedAt,updatedAt=excluded.updatedAt
        WHERE excluded.capturedAt > driver_positions.capturedAt`,
        )
        .run(
          req.actor.id,
          req.actor.city,
          req.actor.driver!.vehicle,
          cell,
          fix.latitude,
          fix.longitude,
          fix.accuracy,
          fix.capturedAt,
          now,
        );
      res.status(202).json({ accepted: true });
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
          .filter(
            (t) => t.riderId !== req.actor.id && safety.eligible(t, req.actor),
          )
          .map((t) => visibleTrip(t, req.actor)),
      );
    }),
  );
}
