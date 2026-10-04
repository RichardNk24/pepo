import { z } from "zod";
import rateLimit from "express-rate-limit";
import { withLocalAliases } from "./aliases";
import { localLandmarks } from "../landmarks";
import { createPlaceIntelligence } from "./intelligence";
import { computeRoute, reversePlace, searchPlaces } from "../maps";

import {
  ApiError,
  city,
  place,
  point,
  wrap,
  type RouteContext,
  type AuthRequest,
} from "../runtime";
export function register_map_search(ctx: RouteContext) {
  const { validateMapArea, app, config, store } = ctx;
  const rawLimit = Number(process.env.PEPO_AI_DAILY_CALL_LIMIT || 100);
  const dailyLimit = Number.isFinite(rawLimit)
    ? Math.max(0, Math.min(1000, Math.floor(rawLimit)))
    : 0;
  store.db.exec(
    "CREATE TABLE IF NOT EXISTS place_ai_budget(day TEXT PRIMARY KEY,calls INTEGER NOT NULL DEFAULT 0)",
  );
  store.db.exec(
    "CREATE TABLE IF NOT EXISTS place_ai_actor_budget(actor TEXT, minute INTEGER, calls INTEGER NOT NULL, PRIMARY KEY(actor,minute))",
  );
  const service = createPlaceIntelligence({
    catalog: async (city) => withLocalAliases(await localLandmarks(city)),
    fallback: (q, c) => searchPlaces(q, c, config.googleKey),
    apiKey:
      process.env.PEPO_AI_PLACES_ENABLED === "true"
        ? process.env.OPENAI_API_KEY
        : undefined,
    model: process.env.OPENAI_PLACES_MODEL || "gpt-4.1-mini",
    dailyLimit,
    consume: (actor = "internal") =>
      store.atomic(() => {
        const minute = Math.floor(Date.now() / 60000);
        store.db
          .prepare("DELETE FROM place_ai_actor_budget WHERE minute < ?")
          .run(minute);
        const used = store.db
          .prepare(
            "SELECT calls FROM place_ai_actor_budget WHERE actor=? AND minute=?",
          )
          .get(actor, minute) as { calls: number } | undefined;
        if ((used?.calls || 0) >= 6) return false;
        const today = new Date().toISOString().slice(0, 10);
        store.db
          .prepare("DELETE FROM place_ai_budget WHERE day < ?")
          .run(today);
        const allowed = !!store.db
          .prepare(
            "INSERT INTO place_ai_budget(day,calls) SELECT ?,1 WHERE ? > 0 ON CONFLICT(day) DO UPDATE SET calls=calls+1 WHERE calls < ? RETURNING calls",
          )
          .get(today, dailyLimit, dailyLimit);
        if (allowed)
          store.db
            .prepare(
              "INSERT INTO place_ai_actor_budget(actor,minute,calls) VALUES(?,?,1) ON CONFLICT(actor,minute) DO UPDATE SET calls=calls+1",
            )
            .run(actor, minute);
        return allowed;
      }),
  });
  app.post(
    "/api/places/resolve",
    rateLimit({
      windowMs: 60000,
      limit: 40,
      keyGenerator: (req) => (req as AuthRequest).actor.id,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Patientez une minute avant une nouvelle demande." },
    }),
    wrap(async (req, res) => {
      const input = z
        .object({
          query: z.string().trim().min(2).max(300),
          city,
          language: z.enum(["fr", "en", "sw", "ln"]).default("fr"),
          allowAi: z.boolean().default(false),
        })
        .strict()
        .parse(req.body);
      res.setHeader("Cache-Control", "no-store");
      res.json(
        await service.resolve(
          input.query,
          input.city,
          input.language,
          input.allowAi,
          req.actor.id,
        ),
      );
    }),
  );
  app.get(
    "/api/places",
    wrap(async (req, res) => {
      const q = z.string().min(2).max(100).parse(req.query.q);
      const c = city.parse(req.query.city);
      res.json(await searchPlaces(q, c, config.googleKey));
    }),
  );
  app.post(
    "/api/routes",
    wrap(async (req, res) => {
      const input = z
        .object({
          pickup: place,
          destination: place,
          stops: z.array(place).max(3).optional(),
          optimizeStops: z.boolean().optional(),
        })
        .parse(req.body);
      if (input.pickup.city !== input.destination.city)
        throw new ApiError(400, "Choisissez deux lieux dans la même ville.");
      validateMapArea(input.pickup);
      validateMapArea(input.destination);
      for (const stop of input.stops || []) {
        if (stop.city !== input.pickup.city)
          throw new ApiError(
            400,
            "Les étapes doivent être dans la ville du départ.",
          );
        validateMapArea(stop);
      }
      res.json(
        await computeRoute(
          input.pickup,
          input.destination,
          config.googleKey,
          input.stops,
          input.optimizeStops,
        ),
      );
    }),
  );
  app.post(
    "/api/reverse",
    wrap(async (req, res) => {
      const input = point.extend({ city }).parse(req.body);
      validateMapArea(input);
      res.json(await reversePlace(input, input.city, config.googleKey));
    }),
  );
}
