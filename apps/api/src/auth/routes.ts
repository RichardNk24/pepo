import type { Profile } from "@pepo/types/model";
import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";

import {
  ApiError,
  city,
  hash,
  id,
  phone,
  wrap,
  type RouteContext,
} from "../runtime";
export function register_auth(ctx: RouteContext) {
  const { app, store, config, auth } = ctx;
  app.post(
    "/api/auth/request",
    wrap(async (req, res) => {
      const p = phone.parse(req.body.phone);
      const previous = store.db
        .prepare("SELECT createdAt FROM otp WHERE phone=?")
        .get(p) as { createdAt: number } | undefined;
      if (previous && Date.now() - previous.createdAt < 60000)
        throw new ApiError(
          429,
          "Attendez une minute avant de demander un nouveau code.",
        );
      const code = String(randomInt(100000, 1000000));
      if (!config.devAuth && !config.sendSms)
        throw new ApiError(
          503,
          "Le service SMS doit être configuré sur le serveur.",
        );
      if (!config.devAuth)
        await config.sendSms!(
          p,
          `Votre code Pepo : ${code}. Valable 5 minutes. Ne le partagez pas.`,
        );
      store.db
        .prepare(
          "INSERT INTO otp VALUES(?,?,?,0,?) ON CONFLICT(phone) DO UPDATE SET hash=excluded.hash,expiresAt=excluded.expiresAt,attempts=0,createdAt=excluded.createdAt",
        )
        .run(p, hash(p + code), Date.now() + 5 * 60000, Date.now());
      res.json({
        expiresIn: 300,
        ...(config.devAuth ? { devCode: code } : {}),
      });
    }),
  );
  app.post(
    "/api/auth/verify",
    wrap((req, res) => {
      const input = z
        .object({
          phone,
          code: z.string().regex(/^\d{6}$/),
          name: z.string().trim().min(2).max(80),
          role: z.enum(["passenger", "driver"]),
          city,
        })
        .parse(req.body);
      const row = store.db
        .prepare("SELECT * FROM otp WHERE phone=?")
        .get(input.phone) as
        | { hash: string; attempts: number; expiresAt: number }
        | undefined;
      if (!row || row.expiresAt < Date.now() || row.attempts >= 5)
        throw new ApiError(
          400,
          "Code expiré ou bloqué. Demandez un nouveau code.",
        );
      store.db
        .prepare("UPDATE otp SET attempts=attempts+1 WHERE phone=?")
        .run(input.phone);
      if (row.hash !== hash(input.phone + input.code))
        throw new ApiError(400, "Code incorrect.");
      const profile = store.atomic(() => {
        store.db.prepare("DELETE FROM otp WHERE phone=?").run(input.phone);
        const existing = store.byPhone(input.phone, input.role);
        const p: Profile = existing || {
          id: id(),
          name: input.name,
          phone: input.phone,
          role: input.role,
          city: input.city,
          rating: 0,
          trips: 0,
          online: false,
          verification: "unverified",
        };
        p.role = input.role;
        p.phoneVerified = !config.devAuth;
        store.saveUser(p);
        return p;
      });
      const token = randomBytes(32).toString("hex");
      store.db
        .prepare(
          "INSERT INTO sessions(hash,userId,expiresAt,role) VALUES(?,?,?,?)",
        )
        .run(hash(token), profile.id, Date.now() + 30 * 86400000, input.role);
      res.json({ token, profile });
    }),
  );
}
