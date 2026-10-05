import { haversine } from "@pepo/utils/rules";
import { randomBytes } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { computeRoute, reversePlace, searchPlaces } from "../maps";

import { googleMapDocument } from "@pepo/maps/googleDocument";
import {
  LEGACY_MAP_ASSETS,
  VEHICLE_MAP_ASSET_CANDIDATES,
} from "@pepo/maps/vehicleMapAssets";
import type { VehicleKind } from "@pepo/types/model";

import {
  ApiError,
  city,
  place,
  point,
  wrap,
  type RouteContext,
} from "../runtime";
function mapAssetsDir() {
  if (process.env.PEPO_MAP_ASSETS_DIR)
    return resolve(process.env.PEPO_MAP_ASSETS_DIR);
  const candidates = [
    resolve("packages/maps/assets/vehicles"),
    resolve("../../packages/maps/assets/vehicles"),
    resolve("apps/api/dist/map-assets"),
    resolve("dist/map-assets"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
}
export function register_maps(ctx: RouteContext) {
  const { validateMapArea, app, store, config } = ctx;
  app.get("/maps/assets/:name", (req, res) => {
    const name = req.params.name;
    const assetRoot = mapAssetsDir();
    if (
      LEGACY_MAP_ASSETS.includes(name as (typeof LEGACY_MAP_ASSETS)[number])
    ) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(resolve(assetRoot, name));
    }
    const candidates = Object.hasOwn(VEHICLE_MAP_ASSET_CANDIDATES, name)
      ? VEHICLE_MAP_ASSET_CANDIDATES[name as VehicleKind]
      : undefined;
    const relative = candidates?.find((candidate) =>
      existsSync(resolve(assetRoot, candidate)),
    );
    if (!relative) return res.sendStatus(404);
    res.setHeader("Cache-Control", "no-cache");
    return res.sendFile(resolve(assetRoot, relative));
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
    const assetUrl = (kind: VehicleKind) => {
      const root = mapAssetsDir();
      const relative = VEHICLE_MAP_ASSET_CANDIDATES[kind].find((candidate) =>
        existsSync(resolve(root, candidate)),
      );
      const path = relative ? resolve(root, relative) : "";
      const version = path && existsSync(path) ? statSync(path).mtimeMs : 0;
      return `/maps/assets/${kind}?v=${version}`;
    };
    const images = Object.fromEntries(
      Object.keys(VEHICLE_MAP_ASSET_CANDIDATES).map((kind) => [
        kind,
        assetUrl(kind as VehicleKind),
      ]),
    ) as Record<VehicleKind, string>;
    res
      .type("html")
      .send(googleMapDocument(config.googleWebKey, nonce, images));
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
