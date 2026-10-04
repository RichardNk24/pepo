import { haversine } from "@pepo/utils/rules";
import { randomBytes } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { computeRoute, reversePlace, searchPlaces } from "../maps";

import { googleMapDocument } from "@pepo/maps/googleDocument";

import {
  ApiError,
  city,
  place,
  point,
  wrap,
  type RouteContext,
} from "../runtime";
export function register_maps(ctx: RouteContext) {
  const { validateMapArea, app, store, config } = ctx;
  app.get("/maps/assets/:name", (req, res) => {
    const name = req.params.name;
    if (name !== "car-top.png" && name !== "moto-top.png")
      return res.sendStatus(404);
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(
      resolve(
        process.env.PEPO_MAP_ASSETS_DIR ||
          "../../packages/maps/assets/vehicles",
        name,
      ),
    );
  });
  app.get("/maps/mobile", (_req, res) => {
    if (!config.googleWebKey)
      return res
        .status(503)
        .type("text/plain")
        .send("Configurez GOOGLE_MAPS_WEB_KEY dans apps/api/.env.");
    const nonce = randomBytes(18).toString("base64");
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        `script-src 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-eval' blob:`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com data: blob:",
        "connect-src 'self' https://*.googleapis.com https://*.google.com https://*.gstatic.com data: blob:",
        "font-src https://fonts.gstatic.com",
        "frame-src https://*.google.com",
        "worker-src blob:",
        `frame-ancestors 'self' ${config.corsOrigins.join(" ")}`,
      ].join("; "),
    );
    res.setHeader("Cache-Control", "no-store");
    res.removeHeader("X-Frame-Options");
    const assetUrl = (name: string) => {
      const path = resolve(
        process.env.PEPO_MAP_ASSETS_DIR ||
          "../../packages/maps/assets/vehicles",
        name,
      );
      const version = existsSync(path) ? statSync(path).mtimeMs : 0;
      return `/maps/assets/${name}?v=${version}`;
    };
    res.type("html").send(
      googleMapDocument(config.googleWebKey, nonce, {
        taxi: assetUrl("car-top.png"),
        moto: assetUrl("moto-top.png"),
      }),
    );
  });
  app.get("/api/maps/config", (_req, res) =>
    res.json({
      googleMap: !!config.googleWebKey,
      googleRoutes: !!config.googleKey,
      googlePlaces: !!config.googleKey,
    }),
  );
  app.get(
    "/api/maps/places",
    wrap(async (req, res) => {
      const q = z.string().min(2).max(100).parse(req.query.q),
        c = city.parse(req.query.city);
      res.json(await searchPlaces(q, c, config.googleKey));
    }),
  );
  app.post(
    "/api/maps/reverse",
    wrap(async (req, res) => {
      const input = point.extend({ city }).parse(req.body);
      validateMapArea(input);
      res.json(await reversePlace(input, input.city, config.googleKey));
    }),
  );
  app.post(
    "/api/maps/routes",
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
      if (haversine(input.pickup, input.destination) < 0.05)
        throw new ApiError(
          400,
          "Choisissez une destination à au moins 50 mètres du départ.",
        );
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
}
