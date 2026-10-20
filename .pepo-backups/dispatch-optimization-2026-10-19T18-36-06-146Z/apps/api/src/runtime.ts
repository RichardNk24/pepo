import type { Profile, PublicDriver, Trip } from "@pepo/types/model";
import { CITIES } from "@pepo/utils/cities";
import { canDrive, haversine } from "@pepo/utils/rules";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import type { Store } from "./database";
import { createSafety } from "./safety/service";
import { sendTripActivityUpdate } from "./live-activities/apns";

export type ServerConfig = {
  devAuth: boolean;
  publicUrl: string;
  googleKey?: string;
  googleWebKey?: string;
  adminToken: string;
  storageKey?: string;
  dataDir: string;
  corsOrigins: string[];
  sendSms?: (phone: string, text: string) => Promise<void>;
  safety?: { enabled?: boolean; supportPhone?: string; now?: () => number };
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const id = () => randomBytes(16).toString("hex");
export const phone = z
  .string()
  .regex(
    /^\+[1-9]\d{7,14}$/,
    "Utilisez le format international, par exemple +243812345678.",
  );
export const city = z.enum(["lubumbashi", "kinshasa", "kolwezi"]);
export const point = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export const place = point.extend({
  id: z.string().min(1).max(300),
  name: z.string().min(1).max(200),
  address: z.string().max(500),
  city,
});
export const vehicle = z.enum([
  "moto",
  "motoSend",
  "taxi",
  "suv",
  "minibus",
  "tricycle",
  "truck",
  "pickupTruck",
]);
export const price = z.number().int().min(500).max(500000);
export const driverSchema = z.object({
  vehicle,
  model: z.string().min(2).max(80),
  plate: z.string().min(4).max(25),
  helmet: z.boolean(),
});

export function isLocalExpoWebOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (
      url.protocol !== "http:" ||
      !/^8\d{3}$/.test(url.port) ||
      Number(url.port) < 8081 ||
      Number(url.port) > 8090
    )
      return false;

    const octets = url.hostname.split(".").map(Number);
    if (
      octets.length !== 4 ||
      octets.some(
        (octet) => !Number.isInteger(octet) || octet < 0 || octet > 255,
      )
    )
      return false;

    return (
      octets[0] === 10 ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    );
  } catch {
    return false;
  }
}

export type AuthRequest = Request & { actor: Profile; tokenHash: string };
export const wrap =
  (f: (req: AuthRequest, res: Response) => unknown) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve()
      .then(() => f(req as AuthRequest, res))
      .catch(next);

export function createRuntime(store: Store, config: ServerConfig) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          imgSrc: ["'self'", "data:", "blob:"],
          upgradeInsecureRequests: config.publicUrl.startsWith("https://")
            ? []
            : null,
        },
      },
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) =>
        cb(
          null,
          !origin ||
            config.corsOrigins.includes(origin) ||
            (process.env.NODE_ENV !== "production" &&
              isLocalExpoWebOrigin(origin)),
        ),
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 240,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  const safety = createSafety(store, config);
  let onChange: (trip: Trip) => void = () => {};
  const notify = (t: Trip) => {
    onChange(t);
    sendTripActivityUpdate(store.db, t);
    return t;
  };
  const publicDriver = (p: Profile): PublicDriver => ({
    id: p.id,
    name: p.name,
    verification: p.verification,
    rating: p.rating,
    trips: p.trips,
    driver: p.driver!,
    ...(p.documents?.selfie ? { avatarPath: `/drivers/${p.id}/avatar` } : {}),
  });
  const visibleTrip = (t: Trip, actor: Profile) => {
    const result: Trip = JSON.parse(JSON.stringify(t));
    if (result.guest) {
      result.riderVerification = "unverified";
      result.riderPhoneVerified = false;
    }
    if (actor.id !== t.riderId) delete result.pickupPin;
    if (actor.id !== t.riderId && actor.id !== t.driverId) {
      delete result.riderPhone;
      if (result.guest) delete result.guest.phone;
      delete result.driverLocation;
      delete result.driverLocationAt;
      delete result.driverLocationAccuracy;
    }
    if (actor.id !== t.riderId)
      result.offers = result.offers.filter((o) => o.driver.id === actor.id);
    if (t.driver && actor.id === t.riderId && t.driverId)
      result.driver = {
        ...result.driver!,
        phone: store.user(t.driverId, "driver")?.phone,
      };
    if (actor.id === t.driverId)
      result.riderPhone = t.guest?.phone || store.user(t.riderId)?.phone;
    return result;
  };
  const auth = (req: Request, _res: Response, next: NextFunction) => {
    const tokenHash = hash(
      req.headers.authorization?.replace(/^Bearer /, "") || "",
    );
    const session = store.db
      .prepare("SELECT userId,role FROM sessions WHERE hash=? AND expiresAt>?")
      .get(tokenHash, Date.now()) as
      | { userId: string; role: "passenger" | "driver" }
      | undefined;
    const actor = session && store.user(session.userId, session.role);
    if (!actor)
      return next(
        new ApiError(401, "Votre session a expiré. Reconnectez-vous."),
      );
    Object.assign(req, { actor, tokenHash });
    next();
  };
  const requiredTrip = (tripId: string) => {
    const t = store.trip(tripId);
    if (!t) throw new ApiError(404, "Course introuvable.");
    return t;
  };
  const participant = (t: Trip, actor: Profile) => {
    if (![t.riderId, t.driverId].includes(actor.id))
      throw new ApiError(403, "Cette course est privée.");
  };
  const requireDriver = (actor: Profile) => {
    if (!canDrive(actor) || actor.verification === "demo")
      throw new ApiError(403, "Votre dossier conducteur doit être approuvé.");
  };
  const admin = (req: Request, _res: Response, next: NextFunction) => {
    if (
      !config.adminToken ||
      hash(req.headers.authorization || "") !==
        hash(`Bearer ${config.adminToken}`)
    )
      return next(new ApiError(403, "Accès administrateur refusé."));
    next();
  };
  const dataDir = resolve(config.dataDir);
  mkdirSync(dataDir, { recursive: true });
  const keyPath = join(dataDir, "storage.key");
  if (!config.storageKey && !existsSync(keyPath))
    writeFileSync(keyPath, randomBytes(32), { mode: 0o600 });
  const storageKey = config.storageKey
    ? Buffer.from(config.storageKey, "hex")
    : readFileSync(keyPath);
  if (storageKey.length !== 32)
    throw new Error("STORAGE_KEY doit contenir 64 caractères hexadécimaux.");
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 6 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) =>
      cb(
        null,
        ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype),
      ),
  });
  const validateMapArea = (p: {
    latitude: number;
    longitude: number;
    city: keyof typeof CITIES;
  }) => {
    if (haversine(p, CITIES[p.city].center) > 60)
      throw new ApiError(400, "Ce lieu est en dehors de la ville choisie.");
  };
  return {
    safety,
    validateMapArea,
    app,
    store,
    config,
    notify,
    publicDriver,
    visibleTrip,
    auth,
    requiredTrip,
    participant,
    requireDriver,
    admin,
    dataDir,
    storageKey,
    upload,
    setOnChange: (fn: typeof onChange) => {
      onChange = fn;
    },
  };
}
export type RouteContext = ReturnType<typeof createRuntime>;
