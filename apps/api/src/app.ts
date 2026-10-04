import { RuleError } from "@pepo/utils/rules";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { resolve } from "node:path";
import { z } from "zod";
import type { Store } from "./database";
import { registerDriversResource } from "./drivers/resources";
import { registerEarningsResource } from "./earnings/resources";
import { MapsError } from "./maps";
import { registerPaymentsResource } from "./payments/resources";
import { registerPricingResource } from "./pricing/resources";
import { registerRidersResource } from "./riders/resources";
import { registerUsersResource } from "./users/resources";
import { registerVehiclesResource } from "./vehicles/resources";

import { releaseScheduled } from "@pepo/utils/scheduling";

import { register_admin } from "./admin/routes";
import { register_auth } from "./auth/routes";
import { register_documents } from "./documents/routes";
import { register_drivers } from "./drivers/routes";
import { register_map_search } from "./map-search/routes";
import { register_maps } from "./maps/routes";
import { ApiError, createRuntime, type ServerConfig } from "./runtime";
import { register_support } from "./support/routes";
import { register_trips } from "./trips/routes";
import { register_users } from "./users/routes";
export { ApiError } from "./runtime";
export type { ServerConfig } from "./runtime";
export function createApp(store: Store, config: ServerConfig) {
  const ctx = createRuntime(store, config);
  const { app, notify, auth, admin, visibleTrip } = ctx;
  app.get("/health", (_req, res) =>
    res.json({
      ok: true,
      service: "pepo",
      devAuth: config.devAuth,
      maps: !!config.googleKey,
    }),
  );
  app.use(
    "/admin",
    express.static(resolve(process.env.PEPO_API_ADMIN_DIR || "src/admin")),
  );
  register_auth(ctx);
  app.use("/api/admin", admin);
  register_admin(ctx);

  app.use(
    "/api/maps",
    rateLimit({
      windowMs: 60000,
      limit: 40,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: "Trop de recherches. Patientez une minute avant de réessayer.",
      },
    }),
  );
  register_maps(ctx);

  app.use("/api", auth);
  register_users(ctx);
  registerUsersResource(ctx);
  registerRidersResource(ctx);
  registerDriversResource(ctx);
  registerVehiclesResource(ctx);
  registerPricingResource(ctx);
  registerPaymentsResource(ctx);
  registerEarningsResource(ctx);
  register_documents(ctx);
  register_drivers(ctx);
  register_map_search(ctx);
  register_trips(ctx);
  register_support(ctx);
  app.use("/api", (_req, res) =>
    res
      .status(404)
      .json({ error: "Cette fonction n’existe pas sur ce serveur." }),
  );
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: error.issues[0]?.message || "Données invalides." });
      if (error instanceof multer.MulterError)
        return res
          .status(400)
          .json({ error: "Image trop volumineuse (6 Mo maximum)." });
      const expected =
        error instanceof ApiError ||
        error instanceof RuleError ||
        error instanceof MapsError;
      const status =
        error instanceof ApiError
          ? error.status
          : error instanceof MapsError
            ? 503
            : error instanceof RuleError
              ? 400
              : 500;
      res.status(status).json({
        error: expected
          ? error.message
          : "Erreur serveur. Réessayez ou contactez l’équipe Pepo.",
      });
    },
  );
  return {
    app,
    dispatchScheduled: (now = Date.now()) => {
      const changed = store.atomic(() => {
        const trips = store.trips(
          "SELECT data FROM trips WHERE status IN ('scheduled','searching','accepted','arrived','in_progress')",
        );
        const result = releaseScheduled(trips, now);
        result.forEach((trip) => store.saveTrip(trip));
        return result;
      });
      changed.forEach(notify);
      return changed;
    },
    visibleTrip,
    auth,
    setOnChange: ctx.setOnChange,
  };
}
