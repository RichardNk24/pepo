import type { Offer, Trip } from "@pepo/types/model";
import { CITIES } from "@pepo/utils/cities";
import {
  assertTransition,
  canDrive,
  haversine,
  validateNewTrip,
} from "@pepo/utils/rules";
import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { computeRoute } from "../maps";

import {
  ApiError,
  hash,
  id,
  place,
  price,
  vehicle,
  wrap,
  type RouteContext,
} from "../runtime";
export function register_trips(ctx: RouteContext) {
  const {
    app,
    store,
    config,
    safety,
    notify,
    publicDriver,
    visibleTrip,
    requiredTrip,
    participant,
    requireDriver,
  } = ctx;
  app.get(
    "/api/trips",
    wrap((req, res) => {
      const result = store.trips(
        "SELECT data FROM trips WHERE riderId=? OR driverId=? ORDER BY createdAt DESC LIMIT 100",
        req.actor.id,
        req.actor.id,
      );
      res.json(result.map((t) => visibleTrip(t, req.actor)));
    }),
  );
  app.put(
    "/api/trips/:id/live-activity-token",
    wrap((req, res) => {
      if (req.actor.role !== "passenger")
        throw new ApiError(
          403,
          "Seul le passager peut activer le suivi de sa course.",
        );
      const trip = requiredTrip(String(req.params.id));
      if (trip.riderId !== req.actor.id)
        throw new ApiError(403, "Cette course ne vous appartient pas.");
      if (
        !["searching", "accepted", "arrived", "in_progress"].includes(
          trip.status,
        )
      )
        throw new ApiError(409, "Le suivi de cette course n’est plus actif.");
      const input = z
        .object({
          activityId: z
            .string()
            .min(1)
            .max(120)
            .regex(/^[a-zA-Z0-9_.:-]+$/),
          pushToken: z
            .string()
            .min(32)
            .max(512)
            .regex(/^[a-fA-F0-9]+$/),
          language: z.enum(["fr", "en", "sw", "ln"]),
        })
        .strict()
        .parse(req.body);
      store.db
        .prepare(
          `INSERT INTO live_activity_tokens(tripId,riderId,activityId,pushToken,language,updatedAt)
         VALUES(?,?,?,?,?,?)
         ON CONFLICT(tripId,activityId) DO UPDATE SET riderId=excluded.riderId,pushToken=excluded.pushToken,language=excluded.language,updatedAt=excluded.updatedAt`,
        )
        .run(
          trip.id,
          req.actor.id,
          input.activityId,
          input.pushToken,
          input.language,
          Date.now(),
        );
      res.status(204).end();
    }),
  );
  app.delete(
    "/api/trips/:id/live-activity-token/:activityId",
    wrap((req, res) => {
      const trip = requiredTrip(String(req.params.id));
      if (trip.riderId !== req.actor.id || req.actor.role !== "passenger")
        throw new ApiError(403, "Cette course ne vous appartient pas.");
      store.db
        .prepare(
          "DELETE FROM live_activity_tokens WHERE tripId=? AND riderId=? AND activityId=?",
        )
        .run(trip.id, req.actor.id, String(req.params.activityId));
      res.status(204).end();
    }),
  );
  app.post(
    "/api/trips",
    wrap(async (req, res) => {
      if (req.actor.role !== "passenger")
        throw new ApiError(403, "Passez en mode passager pour réserver.");
      const input = z
        .object({
          pickup: place,
          destination: place,
          stops: z.array(place).max(3).optional(),
          vehicle,
          proposedPrice: price,
          scheduledAt: z.number().int().optional(),
          guest: z
            .object({
              name: z.string().trim().min(2).max(80),
              phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
            })
            .optional(),
        })
        .parse(req.body);
      validateNewTrip({
        ...input,
        route: {
          points: [],
          distanceKm: 0,
          durationMin: 0,
          source: "estimate",
        },
      });
      if (input.pickup.city !== req.actor.city)
        throw new ApiError(400, "Le départ doit se trouver dans votre ville.");
      if (
        [input.pickup, ...(input.stops || []), input.destination].some(
          (p) => haversine(p, CITIES[p.city].center) > 60,
        )
      )
        throw new ApiError(
          400,
          "Ces lieux sont en dehors de la zone de cette ville.",
        );
      const route = await computeRoute(
        input.pickup,
        input.destination,
        config.googleKey,
        input.stops,
      );
      const trip = store.atomic(() => {
        if (!input.scheduledAt && store.activeFor(req.actor.id).length)
          throw new ApiError(409, "Vous avez déjà une course active.");
        const future = store.trips(
          "SELECT data FROM trips WHERE riderId=? AND status='scheduled'",
          req.actor.id,
        );
        if (
          input.scheduledAt &&
          (future.length >= 10 ||
            future.some(
              (t) => Math.abs(t.scheduledAt! - input.scheduledAt!) < 3600000,
            ))
        )
          throw new ApiError(
            409,
            "Gardez une heure entre deux départs programmés, avec au maximum 10 réservations à venir.",
          );
        const t: Trip = {
          ...input,
          route,
          id: id(),
          riderId: req.actor.id,
          riderName: req.actor.name,
          riderVerification: req.actor.verification,
          riderPhoneVerified: req.actor.phoneVerified,
          status: input.scheduledAt ? "scheduled" : "searching",
          offers: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pickupPin: String(randomInt(1000, 10000)),
          payment: "cash",
        };
        store.saveTrip(t);
        return t;
      });
      notify(trip);
      res.status(201).json(visibleTrip(trip, req.actor));
    }),
  );
  app.post(
    "/api/trips/:id/offers",
    wrap((req, res) => {
      requireDriver(req.actor);
      const input = z
        .object({ price, eta: z.number().int().min(1).max(60) })
        .parse(req.body);
      const t = store.atomic(() => {
        const t = requiredTrip(String(req.params.id));
        if (
          t.status !== "searching" ||
          t.riderId === req.actor.id ||
          t.pickup.city !== req.actor.city ||
          t.vehicle !== req.actor.driver!.vehicle
        )
          throw new ApiError(
            409,
            "Cette demande n’est pas disponible pour vous.",
          );
        if (!req.actor.online || store.activeFor(req.actor.id).length)
          throw new ApiError(
            409,
            "Vous devez être disponible pour proposer un prix.",
          );
        safety.requireEligible(t, req.actor);
        t.offers = t.offers.filter((o) => o.driver.id !== req.actor.id);
        const offer: Offer = {
          id: id(),
          tripId: t.id,
          driver: publicDriver(req.actor),
          ...input,
          status: "pending",
          expiresAt: Date.now() + 120000,
          createdAt: Date.now(),
        };
        t.offers.push(offer);
        t.updatedAt = Date.now();
        store.saveTrip(t);
        return t;
      });
      notify(t);
      res.json(visibleTrip(t, req.actor));
    }),
  );
  app.patch(
    "/api/trips/:id/schedule",
    wrap((req, res) => {
      const { scheduledAt } = z
        .object({ scheduledAt: z.number().int() })
        .parse(req.body);
      const updated = store.atomic(() => {
        const trip = requiredTrip(String(req.params.id));
        if (trip.riderId !== req.actor.id)
          throw new ApiError(
            403,
            "Seul le passager qui a réservé peut modifier le départ.",
          );
        if (trip.status !== "scheduled")
          throw new ApiError(409, "Cette réservation n’est plus modifiable.");
        validateNewTrip({ ...trip, scheduledAt });
        const future = store.trips(
          "SELECT data FROM trips WHERE riderId=? AND status='scheduled'",
          req.actor.id,
        );
        if (
          future.some(
            (t) =>
              t.id !== trip.id &&
              Math.abs(t.scheduledAt! - scheduledAt) < 3600000,
          )
        )
          throw new ApiError(
            409,
            "Gardez une heure entre deux départs programmés.",
          );
        const next = { ...trip, scheduledAt, updatedAt: Date.now() };
        store.saveTrip(next);
        return next;
      });
      notify(updated);
      res.json(visibleTrip(updated, req.actor));
    }),
  );
  app.post(
    "/api/trips/:id/offers/:offerId/counter",
    wrap((req, res) => {
      const input = z.object({ price }).parse(req.body);
      const t = store.atomic(() => {
        const t = requiredTrip(String(req.params.id));
        const o = t.offers.find((o) => o.id === req.params.offerId);
        if (!o || t.riderId !== req.actor.id)
          throw new ApiError(403, "Cette offre ne vous appartient pas.");
        if (t.status !== "searching" || o.expiresAt < Date.now())
          throw new ApiError(409, "Cette offre a expiré.");
        o.riderCounter = input.price;
        o.status = "countered";
        o.expiresAt = Date.now() + 120000;
        t.updatedAt = Date.now();
        store.saveTrip(t);
        return t;
      });
      notify(t);
      res.json(visibleTrip(t, req.actor));
    }),
  );
  app.post(
    "/api/trips/:id/offers/:offerId/accept-counter",
    wrap((req, res) => {
      requireDriver(req.actor);
      const t = store.atomic(() => {
        const t = requiredTrip(String(req.params.id));
        const o = t.offers.find((o) => o.id === req.params.offerId);
        if (!o || o.driver.id !== req.actor.id)
          throw new ApiError(403, "Cette offre est privée.");
        if (
          t.status !== "searching" ||
          o.expiresAt < Date.now() ||
          o.status !== "countered" ||
          !o.riderCounter
        )
          throw new ApiError(409, "Cette contre-offre n’est plus disponible.");
        safety.requireEligible(t, req.actor);
        o.price = o.riderCounter;
        delete o.riderCounter;
        o.status = "pending";
        o.expiresAt = Date.now() + 120000;
        t.updatedAt = Date.now();
        store.saveTrip(t);
        return t;
      });
      notify(t);
      res.json(visibleTrip(t, req.actor));
    }),
  );
  app.post(
    "/api/trips/:id/accept",
    wrap((req, res) => {
      const { offerId } = z.object({ offerId: z.string() }).parse(req.body);
      const t = store.atomic(() => {
        const t = requiredTrip(String(req.params.id));
        participant(t, req.actor);
        assertTransition(t, "accepted", req.actor);
        const o = t.offers.find((o) => o.id === offerId);
        if (!o || o.status !== "pending" || o.expiresAt < Date.now())
          throw new ApiError(409, "Cette offre a expiré.");
        const driver = store.user(o.driver.id, "driver");
        if (
          !driver ||
          !driver.online ||
          !canDrive(driver) ||
          store.activeFor(driver.id).length
        )
          throw new ApiError(409, "Ce conducteur n’est plus disponible.");
        safety.requireEligible(t, driver);
        t.driver = publicDriver(driver);
        t.driverId = driver.id;
        safety.assigned(t);
        t.agreedPrice = o.price;
        t.status = "accepted";
        t.offers = t.offers.map((v) => ({
          ...v,
          status: v.id === offerId ? "accepted" : "rejected",
        }));
        t.updatedAt = Date.now();
        store.saveTrip(t);
        return t;
      });
      notify(t);
      res.json(visibleTrip(t, req.actor));
    }),
  );
  app.post(
    "/api/trips/:id/status",
    wrap((req, res) => {
      const input = z
        .object({
          status: z.enum(["arrived", "in_progress", "completed", "cancelled"]),
          pin: z.string().optional(),
        })
        .parse(req.body);
      if (input.status === "in_progress") {
        const current = requiredTrip(String(req.params.id));
        if (
          req.actor.role !== "driver" ||
          req.actor.id !== current.driverId ||
          current.status !== "arrived"
        )
          throw new ApiError(
            403,
            "Seul le conducteur arrivé peut vérifier le code.",
          );
        const attempts = store.db
          .prepare("SELECT attempts FROM pin_attempts WHERE tripId=?")
          .get(current.id) as { attempts: number } | undefined;
        if ((attempts?.attempts || 0) >= 5)
          throw new ApiError(
            429,
            "Code bloqué après 5 essais. Annulez cette course et contactez l’équipe Pepo.",
          );
        if (input.pin !== current.pickupPin) {
          store.db
            .prepare(
              "INSERT INTO pin_attempts VALUES(?,1) ON CONFLICT(tripId) DO UPDATE SET attempts=attempts+1",
            )
            .run(current.id);
          throw new ApiError(400, "Le code de départ est incorrect.");
        }
      }
      const t = store.atomic(() => {
        const t = requiredTrip(String(req.params.id));
        participant(t, req.actor);
        assertTransition(t, input.status, req.actor, input.pin);
        if (["arrived", "in_progress"].includes(input.status)) {
          if (input.status === "in_progress")
            safety.requireEligible(t, req.actor);
          safety.requirePickup(t);
        }
        t.status = input.status;
        if (input.status === "in_progress") t.startedAt = Date.now();
        t.updatedAt = Date.now();
        if (["completed", "cancelled"].includes(input.status)) safety.finish(t);
        if (input.status === "completed") {
          t.completedAt = Date.now();
          for (const uid of [t.riderId, t.driverId]) {
            if (uid) {
              const p = store.user(
                uid,
                uid === t.driverId ? "driver" : "passenger",
              )!;
              p.trips++;
              store.saveUser(p);
            }
          }
        }
        store.saveTrip(t);
        return t;
      });
      notify(t);
      res.json(visibleTrip(t, req.actor));
    }),
  );
  app.post(
    "/api/trips/:id/rating",
    wrap((req, res) => {
      const { rating } = z
        .object({ rating: z.number().int().min(1).max(5) })
        .parse(req.body);
      const t = store.atomic(() => {
        const t = requiredTrip(String(req.params.id));
        if (req.actor.id !== t.riderId || t.status !== "completed" || t.rating)
          throw new ApiError(409, "Vous ne pouvez pas noter cette course.");
        t.rating = rating;
        store.saveTrip(t);
        const d = store.user(t.driverId!, "driver")!;
        const ratings = store
          .trips(
            "SELECT data FROM trips WHERE driverId=? AND status='completed'",
            d.id,
          )
          .map((t) => t.rating)
          .filter((r): r is number => !!r);
        d.rating =
          Math.round(
            (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10,
          ) / 10;
        store.saveUser(d);
        return t;
      });
      notify(t);
      res.json(visibleTrip(t, req.actor));
    }),
  );
  app.post(
    "/api/trips/:id/location",
    wrap((req, res) => {
      const input = z
        .object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          accuracy: z.number().min(0).max(10000).default(10000),
          capturedAt: z.number().int().positive().default(safety.now()),
        })
        .strict()
        .parse(req.body);
      const t = requiredTrip(String(req.params.id));
      if (
        req.actor.role !== "driver" ||
        req.actor.id !== t.driverId ||
        !["accepted", "arrived", "in_progress"].includes(t.status)
      )
        throw new ApiError(403, "Le suivi n’est pas actif pour cette course.");
      if (haversine(input, t.pickup) > 100)
        throw new ApiError(
          400,
          "Cette position est hors de la zone de la course.",
        );
      const location = safety.saveDriverFix(req.actor.id, input);
      if (t.driverLocationAt && location.capturedAt <= t.driverLocationAt)
        return res.json({ ok: true });
      t.driverLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
      t.driverLocationAt = location.capturedAt;
      t.driverLocationAccuracy = location.accuracy;
      t.updatedAt = Date.now();
      safety.observe(t, location);
      store.saveTrip(t);
      notify(t);
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/trips/:id/messages",
    wrap((req, res) => {
      const t = requiredTrip(String(req.params.id));
      participant(t, req.actor);
      res.json(
        store.db
          .prepare(
            "SELECT * FROM messages WHERE tripId=? ORDER BY createdAt ASC LIMIT 200",
          )
          .all(t.id),
      );
    }),
  );
  app.post(
    "/api/trips/:id/messages",
    wrap((req, res) => {
      const t = requiredTrip(String(req.params.id));
      participant(t, req.actor);
      if (
        !(
          (req.actor.role === "passenger" && req.actor.id === t.riderId) ||
          (req.actor.role === "driver" && req.actor.id === t.driverId)
        )
      )
        throw new ApiError(403, "Cette course ne vous appartient pas.");
      if (
        !t.driverId ||
        !["accepted", "arrived", "in_progress"].includes(t.status)
      )
        throw new ApiError(
          409,
          "La messagerie est disponible pendant la course.",
        );
      const { text } = z
        .object({ text: z.string().trim().min(1).max(1000) })
        .parse(req.body);
      const message = {
        id: id(),
        tripId: t.id,
        senderId: req.actor.id,
        text,
        createdAt: Date.now(),
      };
      store.db
        .prepare("INSERT INTO messages VALUES(?,?,?,?,?)")
        .run(message.id, t.id, req.actor.id, text, message.createdAt);
      notify(t);
      res.status(201).json(message);
    }),
  );
  app.post(
    "/api/trips/:id/share",
    wrap((req, res) => {
      const t = requiredTrip(String(req.params.id));
      participant(t, req.actor);
      if (
        !t.driverId ||
        !["accepted", "arrived", "in_progress"].includes(t.status)
      )
        throw new ApiError(409, "Partagez une course active.");
      if (
        !(
          (req.actor.role === "passenger" && req.actor.id === t.riderId) ||
          (req.actor.role === "driver" && req.actor.id === t.driverId)
        )
      )
        throw new ApiError(403, "Cette course ne vous appartient pas.");
      const token = randomBytes(24).toString("hex");
      store.atomic(() => {
        // Bound the number of live links. Old links made before this patch can still expire normally.
        store.db
          .prepare(
            "DELETE FROM shares WHERE hash IN (SELECT hash FROM share_owners WHERE userId=? AND role=?)",
          )
          .run(req.actor.id, req.actor.role);
        store.db
          .prepare("INSERT INTO shares VALUES(?,?,?)")
          .run(hash(token), t.id, Date.now() + 4 * 3600000);
        store.db
          .prepare("INSERT INTO share_owners VALUES(?,?,?)")
          .run(hash(token), req.actor.id, req.actor.role);
      });
      res.json({ url: `${config.publicUrl}/track/${token}`, expiresIn: 14400 });
    }),
  );
}
