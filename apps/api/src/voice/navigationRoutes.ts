import { nightPolicy } from "../safety/policy";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import {
  ApiError,
  point,
  wrap,
  type AuthRequest,
  type RouteContext,
} from "../runtime";
import { computeRoute } from "../maps";
import { buildNavigationPlan } from "@pepo/voice/routeAdapter";
import { initializeVoiceGeo, landmarkInput, approvedLandmarks } from "./geo";
import type { Landmark } from "@pepo/voice/types";
const fresh = (p: { timestamp: number; accuracy: number }) =>
  p.timestamp <= Date.now() + 3000 &&
  Date.now() - p.timestamp < 15000 &&
  p.accuracy <= 35;
export function registerVoiceNavigation({
  app,
  store,
  requiredTrip,
  config,
  validateMapArea,
}: RouteContext) {
  initializeVoiceGeo(store);
  app.get(
    "/api/voice/landmarks",
    wrap((req, res) => {
      const city = z
        .enum(["lubumbashi", "kinshasa", "kolwezi"])
        .parse(req.query.city);
      res.setHeader("Cache-Control", "no-store");
      res.json(approvedLandmarks(store, city));
    }),
  );
  app.post(
    "/api/voice/landmarks/contributions",
    rateLimit({
      windowMs: 60000,
      limit: 5,
      keyGenerator: (req) => (req as AuthRequest).actor.id,
    }),
    wrap((req, res) => {
      const input = landmarkInput.parse(req.body);
      validateMapArea(input);
      if (input.city !== req.actor.city)
        throw new ApiError(400, "Choisissez un repère dans votre ville.");
      const id = randomUUID(),
        now = Date.now();
      const landmark: Landmark = { ...input, id, reliability: "pending" };
      store.db
        .prepare("INSERT INTO voice_geo VALUES(?,?,?,?,?)")
        .run(id, req.actor.id, "pending", JSON.stringify(landmark), now);
      res.status(201).json({ id, status: "pending" });
    }),
  );
  app.post(
    "/api/trips/:id/voice-navigation",
    rateLimit({
      windowMs: 60000,
      limit: 4,
      keyGenerator: (req) => (req as AuthRequest).actor.id,
    }),
    wrap(async (req, res) => {
      const trip = requiredTrip(String(req.params.id));
      if (req.actor.role !== "driver" || trip.driverId !== req.actor.id)
        throw new ApiError(
          403,
          "Cette navigation appartient au chauffeur de la course.",
        );
      if (!["accepted", "arrived", "in_progress"].includes(trip.status))
        throw new ApiError(409, "Cette course n’est pas en cours.");
      const fix = point
        .extend({
          accuracy: z.number().min(0).max(35),
          timestamp: z.number().int(),
        })
        .strict()
        .parse(req.body);
      validateMapArea({ ...fix, city: trip.pickup.city });
      if (!fresh(fix))
        throw new ApiError(400, "Actualisez votre position GPS.");
      const pickup = trip.status !== "in_progress";
      // One explicit request; no hidden auto-rerouting/provider loop. Existing geometry reused in trip.
      const origin = {
        ...trip.pickup,
        ...fix,
        id: "navigation-origin",
        name: "Position GPS",
      };
      const route = pickup
        ? await computeRoute(origin, trip.pickup, config.googleKey)
        : trip.route;
      if (!config.googleKey || route.source !== "google")
        throw new ApiError(
          503,
          "Le guidage exige un itinéraire routier Google.",
        );
      const plan = buildNavigationPlan(
        `${trip.id}:${pickup ? "pickup" : "trip"}:${route.navigationVersion || route.calculatedAt}`,
        route.navigationSteps || [],
      );
      if (!plan)
        throw new ApiError(
          409,
          "Les manœuvres manquent. Recalculez le trajet dans Pepo ou utilisez Google Maps.",
        );
      // Recheck after paid async pickup calculation: revoked/completed assignment cannot receive plan.
      const current = requiredTrip(trip.id);
      if (current.driverId !== req.actor.id || current.status !== trip.status)
        throw new ApiError(409, "La course a changé. Relancez le guidage.");
      res.setHeader("Cache-Control", "no-store");
      res.json({
        plan,
        night: nightPolicy(trip.pickup.city, Date.now()).tier !== "day",
        landmarks: approvedLandmarks(store, trip.pickup.city),
        target: pickup ? trip.pickup : trip.destination,
      });
    }),
  );
}
export function registerVoiceGeoAdmin({ app, store }: RouteContext) {
  initializeVoiceGeo(store);
  app.get("/api/admin/voice-landmarks", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(
      (
        store.db
          .prepare(
            "SELECT id,status,data,createdAt FROM voice_geo ORDER BY createdAt DESC LIMIT 2000",
          )
          .all() as { data: string }[]
      ).map((r) => ({ ...r, data: JSON.parse(r.data) })),
    );
  });
  app.post(
    "/api/admin/voice-landmarks/:id/review",
    wrap((req, res) => {
      const input = z
        .object({
          approve: z.boolean(),
          fieldChecked: z.boolean(),
          visibility: z
            .object({
              day: z.boolean(),
              night: z.boolean(),
              bearing: z.number().min(0).lt(360),
              tolerance: z.number().min(0).max(35),
            })
            .optional(),
        })
        .strict()
        .parse(req.body);
      const row = store.db
        .prepare("SELECT data FROM voice_geo WHERE id=?")
        .get(String(req.params.id)) as { data: string } | undefined;
      if (!row) throw new ApiError(404, "Repère introuvable.");
      const l = JSON.parse(row.data) as Landmark;
      if (input.approve && !input.fieldChecked)
        throw new ApiError(400, "La vérification terrain est obligatoire.");
      // Parcel sequences require a separate reviewed corpus; one-point approval is insufficient.
      if (input.approve && l.kind === "parcel")
        throw new ApiError(
          400,
          "Une parcelle exige une séquence complète validée.",
        );
      if (input.approve && !input.visibility)
        throw new ApiError(
          400,
          "Vérifiez la visibilité et le sens d’approche.",
        );
      const updated = {
        ...l,
        reliability: input.approve ? "verified" : "rejected",
        validatedAt: Date.now(),
        expiresAt: Date.now() + 180 * 86400000,
        visibility: input.visibility,
      };
      store.db
        .prepare("UPDATE voice_geo SET status=?,data=? WHERE id=?")
        .run(updated.reliability, JSON.stringify(updated), l.id);
      res.json({ id: l.id, status: updated.reliability });
    }),
  );
}
