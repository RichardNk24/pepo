import type { Profile } from "@pepo/types/model";
import { createDecipheriv } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";

import { ApiError, wrap, type RouteContext } from "../runtime";
export function register_admin(ctx: RouteContext) {
  const { app, store, admin, storageKey } = ctx;
  app.get(
    "/api/admin/drivers",
    wrap((_req, res) => {
      const profiles = (
        store.db.prepare("SELECT data FROM users").all() as { data: string }[]
      ).map((r) => JSON.parse(r.data) as Profile);
      res.json(
        profiles.filter(
          (p) => p.role === "driver" && p.verification === "pending",
        ),
      );
    }),
  );
  app.get(
    "/api/admin/identities",
    wrap((_req, res) =>
      res.json(
        (store.db.prepare("SELECT data FROM users").all() as { data: string }[])
          .map((r) => JSON.parse(r.data) as Profile)
          .filter((p) => p.identityVerification === "pending"),
      ),
    ),
  );
  app.post(
    "/api/admin/identities/:id/review",
    wrap((req, res) => {
      const { approved } = z
        .object({ approved: z.boolean() })
        .strict()
        .parse(req.body);
      const p = store.user(String(req.params.id), "driver");
      if (!p) throw new ApiError(404, "Compte introuvable.");
      if (approved && (!p.documents?.identity || !p.documents?.selfie))
        throw new ApiError(
          400,
          "Examinez la pièce d’identité et le selfie avant de valider.",
        );
      p.identityVerification = approved ? "verified" : "rejected";
      store.saveUser(p);
      res.json(p);
    }),
  );
  app.post(
    "/api/admin/drivers/:id/review",
    wrap((req, res) => {
      const { approved } = z.object({ approved: z.boolean() }).parse(req.body);
      const p = store.user(String(req.params.id), "driver");
      if (!p || p.role !== "driver")
        throw new ApiError(404, "Conducteur introuvable.");
      if (
        approved &&
        (!p.driver ||
          !["identity", "license", "vehicle", "selfie"].every(
            (k) => p.documents?.[k as keyof typeof p.documents],
          ))
      )
        throw new ApiError(
          400,
          "Le dossier doit contenir les quatre documents et le véhicule.",
        );
      p.verification = approved ? "verified" : "rejected";
      p.online = false;
      store.saveUser(p);
      res.json(p);
    }),
  );
  app.get(
    "/api/admin/drivers/:id/documents/:kind",
    wrap((req, res) => {
      const row = store.db
        .prepare(
          "SELECT path,mime FROM documents WHERE userId=? AND kind=? ORDER BY createdAt DESC LIMIT 1",
        )
        .get(String(req.params.id), String(req.params.kind)) as
        | { path: string; mime: string }
        | undefined;
      if (!row) throw new ApiError(404, "Document introuvable.");
      const bytes = readFileSync(row.path);
      const decipher = createDecipheriv(
        "aes-256-gcm",
        storageKey,
        bytes.subarray(0, 12),
      );
      decipher.setAuthTag(bytes.subarray(12, 28));
      res
        .set("Cache-Control", "no-store")
        .type(row.mime)
        .send(
          Buffer.concat([
            decipher.update(bytes.subarray(28)),
            decipher.final(),
          ]),
        );
    }),
  );
  app.get(
    "/api/admin/incidents",
    wrap((_req, res) =>
      res.json(
        store.db
          .prepare("SELECT * FROM incidents ORDER BY createdAt DESC LIMIT 200")
          .all(),
      ),
    ),
  );
}
