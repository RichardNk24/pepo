import { z } from "zod";
import { CITIES } from "@pepo/utils/cities";
import { haversine } from "@pepo/utils/rules";
import { ApiError, city, point, wrap, type RouteContext } from "../runtime";
import { driverFingerprint, nightPolicy, reviewedDriver } from "./policy";
export const safetyFixSchema = point
  .extend({
    accuracy: z.number().min(0).max(10000),
    capturedAt: z.number().int().positive(),
  })
  .strict();
export function registerSafety(ctx: RouteContext) {
  const { app, store, safety, requiredTrip, notify } = ctx;
  const owned = (tripId: string, actor: Parameters<typeof safety.state>[1]) => {
    const t = requiredTrip(tripId);
    if (
      !(
        (actor.role === "passenger" && actor.id === t.riderId) ||
        (actor.role === "driver" && actor.id === t.driverId)
      )
    )
      throw new ApiError(403, "Cette course ne vous appartient pas.");
    return t;
  };
  const requireActive = (t: ReturnType<typeof requiredTrip>) => {
    if (!["accepted", "arrived", "in_progress"].includes(t.status))
      throw new ApiError(409, "Cette course n’est plus active.");
  };
  app.get(
    "/api/safety/policy",
    wrap((req, res) => {
      const c = city.parse(req.query.city || req.actor.city);
      res
        .set("Cache-Control", "no-store")
        .json({ enabled: safety.enabled, ...nightPolicy(c, safety.now()) });
    }),
  );
  app.post(
    "/api/me/safety/location",
    wrap((req, res) => {
      if (req.actor.role !== "driver")
        throw new ApiError(403, "Passez en mode conducteur.");
      const fix = safetyFixSchema.parse(req.body);
      if (haversine(fix, CITIES[req.actor.city].center) > 100)
        throw new ApiError(400, "Cette position est hors de votre ville.");
      safety.saveDriverFix(req.actor.id, fix);
      res.status(204).end();
    }),
  );
  app.get(
    "/api/me/safety",
    wrap((req, res) => {
      if (req.actor.role !== "driver")
        throw new ApiError(403, "Passez en mode conducteur.");
      res.set("Cache-Control", "no-store").json({
        enabled: safety.enabled,
        nightApproved: safety.approvalValid(req.actor),
        ...nightPolicy(req.actor.city, safety.now()),
      });
    }),
  );
  app.get(
    "/api/trips/:id/safety",
    wrap((req, res) => {
      res
        .set("Cache-Control", "no-store")
        .json(safety.state(owned(String(req.params.id), req.actor), req.actor));
    }),
  );
  app.post(
    "/api/trips/:id/safety/help",
    wrap((req, res) => {
      const t = owned(String(req.params.id), req.actor);
      requireActive(t);
      const help = store.atomic(() => safety.requestHelp(t, req.actor));
      notify(t);
      res
        .status(201)
        .json({ id: help.id, status: help.status, createdAt: help.createdAt });
    }),
  );
  app.post(
    "/api/trips/:id/safety/check/:checkId",
    wrap((req, res) => {
      const input = z
        .object({ answer: z.enum(["ok", "help"]) })
        .strict()
        .parse(req.body);
      const t = owned(String(req.params.id), req.actor);
      requireActive(t);
      store.atomic(() => {
        const row = store.db
          .prepare(
            "SELECT id,answer FROM safety_checks WHERE id=? AND tripId=? AND userId=? AND role=?",
          )
          .get(
            String(req.params.checkId),
            t.id,
            req.actor.id,
            req.actor.role,
          ) as { id: string; answer: string | null } | undefined;
        if (!row) throw new ApiError(404, "Vérification introuvable.");
        // Help always wins over a prior OK on a retry; it never closes an open ticket.
        if (!row.answer || input.answer === "help")
          store.db
            .prepare(
              "UPDATE safety_checks SET answeredAt=?,answer=? WHERE id=?",
            )
            .run(safety.now(), input.answer, row.id);
        if (input.answer === "help")
          safety.requestHelp(t, req.actor, "check_help");
      });
      notify(t);
      res.status(204).end();
    }),
  );
  app.post(
    "/api/trips/:id/safety/stop",
    wrap((req, res) => {
      const { reason } = z
        .object({
          reason: z.enum(["checkpoint", "traffic", "vehicle", "other"]),
        })
        .strict()
        .parse(req.body);
      const t = owned(String(req.params.id), req.actor);
      requireActive(t);
      if (req.actor.role !== "driver")
        throw new ApiError(
          403,
          "Le conducteur peut indiquer la raison de l’arrêt.",
        );
      store.db
        .prepare(
          "INSERT INTO safety_stop_context VALUES(?,?,?) ON CONFLICT(tripId) DO UPDATE SET reason=excluded.reason,expiresAt=excluded.expiresAt",
        )
        .run(t.id, reason, safety.now() + 10 * 60000);
      safety.audit("stop_context", t.id);
      res.status(204).end();
    }),
  );
  app.delete(
    "/api/trips/:id/share",
    wrap((req, res) => {
      const t = owned(String(req.params.id), req.actor);
      store.db
        .prepare(
          "DELETE FROM shares WHERE tripId=? AND hash IN (SELECT hash FROM share_owners WHERE userId=? AND role=?)",
        )
        .run(t.id, req.actor.id, req.actor.role);
      res.status(204).end();
    }),
  );
}
export function registerSafetyAdmin(ctx: RouteContext) {
  const { app, store, safety } = ctx;
  // Mounted after the admin authorization middleware and before rider/driver auth.
  app.get(
    "/api/admin/safety/drivers",
    wrap((_req, res) => {
      const rows = store.db
        .prepare(
          "SELECT userId FROM driver_profiles WHERE json_extract(data,'$.verification')='verified' LIMIT 200",
        )
        .all() as { userId: string }[];
      res.set("Cache-Control", "no-store").json(
        rows.map((r) => {
          const p = store.user(r.userId, "driver")!;
          const row = store.db
            .prepare(
              "SELECT expiresAt FROM safety_driver_approval WHERE userId=?",
            )
            .get(p.id) as { expiresAt: number } | undefined;
          return {
            id: p.id,
            name: p.name,
            city: p.city,
            model: p.driver?.model,
            plate: p.driver?.plate,
            canApprove: reviewedDriver(p),
            nightApproved: safety.approvalValid(p),
            expiresAt: row?.expiresAt,
          };
        }),
      );
    }),
  );
  app.post(
    "/api/admin/safety/drivers/:id",
    wrap((req, res) => {
      const { approved, validDays } = z
        .object({
          approved: z.boolean(),
          validDays: z.number().int().min(1).max(30).default(7),
        })
        .strict()
        .parse(req.body);
      const p = store.user(String(req.params.id), "driver");
      if (!p?.driver) throw new ApiError(404, "Conducteur introuvable.");
      store.atomic(() => {
        if (approved) {
          if (!reviewedDriver(p))
            throw new ApiError(
              409,
              "Validez d’abord l’identité et les quatre pièces du dossier.",
            );
          store.db
            .prepare(
              "INSERT INTO safety_driver_approval VALUES(?,?,?,?) ON CONFLICT(userId) DO UPDATE SET fingerprint=excluded.fingerprint,expiresAt=excluded.expiresAt,reviewedAt=excluded.reviewedAt",
            )
            .run(
              p.id,
              driverFingerprint(p),
              safety.now() + validDays * 86400000,
              safety.now(),
            );
        } else
          store.db
            .prepare("DELETE FROM safety_driver_approval WHERE userId=?")
            .run(p.id);
        safety.audit(approved ? "night_approved" : "night_revoked", p.id);
      });
      res.status(204).end();
    }),
  );
  app.get(
    "/api/admin/safety/queue",
    wrap((req, res) => {
      const status = z
        .enum(["queued", "acknowledged", "resolved"])
        .parse(req.query.status || "queued");
      const rows = store.db
        .prepare(
          "SELECT * FROM safety_help WHERE status=? ORDER BY CASE WHEN source IN ('manual','check_help') THEN 0 ELSE 1 END,createdAt LIMIT 200",
        )
        .all(status) as {
        id: string;
        tripId: string;
        userId: string;
        role: string;
      }[];
      safety.audit("queue_read", status);
      res.set("Cache-Control", "no-store").json(
        rows.map((row) => {
          const t = store.trip(row.tripId),
            p = store.user(row.userId, row.role as "driver" | "passenger");
          const context = store.db
            .prepare(
              "SELECT reason FROM safety_stop_context WHERE tripId=? AND expiresAt>?",
            )
            .get(row.tripId, safety.now());
          return {
            ...row,
            name: p?.name,
            phone: p?.phone,
            guest: t?.guest,
            trip: t
              ? {
                  status: t.status,
                  city: t.pickup.city,
                  pickup: t.pickup.name,
                  destination: t.destination.name,
                  plate: t.driver?.driver.plate,
                  lastLocation: t.driverLocation,
                  lastLocationAt: t.driverLocationAt,
                  locationQuality: safety.state(t, p!).locationQuality,
                }
              : undefined,
            context,
          };
        }),
      );
    }),
  );
  app.post(
    "/api/admin/safety/queue/:id",
    wrap((req, res) => {
      const { action } = z
        .object({ action: z.enum(["acknowledge", "resolve"]) })
        .strict()
        .parse(req.body);
      const row = store.atomic(() => {
        const row = store.db
          .prepare("SELECT tripId,status FROM safety_help WHERE id=?")
          .get(String(req.params.id)) as
          | { tripId: string; status: string }
          | undefined;
        if (!row) throw new ApiError(404, "Demande introuvable.");
        if (row.status === "resolved")
          throw new ApiError(409, "Cette demande est déjà close.");
        if (action === "resolve" && row.status !== "acknowledged")
          throw new ApiError(409, "Prenez d’abord en charge cette demande.");
        store.db
          .prepare(
            action === "acknowledge"
              ? "UPDATE safety_help SET status='acknowledged',acknowledgedAt=COALESCE(acknowledgedAt,?) WHERE id=?"
              : "UPDATE safety_help SET status='resolved',resolvedAt=? WHERE id=?",
          )
          .run(safety.now(), String(req.params.id));
        safety.audit(action, String(req.params.id));
        return row;
      });
      const t = store.trip(row.tripId);
      if (t) ctx.notify(t);
      res.status(204).end();
    }),
  );
}
