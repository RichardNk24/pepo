import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import { ApiError, id, wrap, type RouteContext } from "../runtime";
export function register_documents(ctx: RouteContext) {
  const { app, store, dataDir, storageKey, upload } = ctx;
  app.get(
    "/api/drivers/:id/avatar",
    wrap((req, res) => {
      const driverId = String(req.params.id),
        driver = store.user(driverId, "driver");
      if (!driver || driver.verification !== "verified")
        throw new ApiError(404, "Photo indisponible.");
      const allowed =
        driverId === req.actor.id ||
        store
          .trips(
            "SELECT data FROM trips WHERE riderId=? ORDER BY createdAt DESC LIMIT 100",
            req.actor.id,
          )
          .some(
            (t) =>
              t.driverId === driverId ||
              t.offers.some((o) => o.driver.id === driverId),
          );
      if (!allowed) throw new ApiError(403, "Cette photo est privée.");
      const row = store.db
        .prepare(
          "SELECT path,mime FROM documents WHERE userId=? AND kind='selfie' ORDER BY createdAt DESC LIMIT 1",
        )
        .get(driverId) as { path: string; mime: string } | undefined;
      if (!row) throw new ApiError(404, "Photo indisponible.");
      const bytes = readFileSync(row.path),
        decipher = createDecipheriv(
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
    "/api/me/avatar",
    wrap((req, res) => {
      const row = store.db
        .prepare(
          "SELECT path,mime FROM documents WHERE userId=? AND kind='avatar' ORDER BY createdAt DESC LIMIT 1",
        )
        .get(req.actor.id) as { path: string; mime: string } | undefined;
      if (!row) throw new ApiError(404, "Ajoutez une photo de profil.");
      const bytes = readFileSync(row.path);
      const decipher = createDecipheriv(
        "aes-256-gcm",
        storageKey,
        bytes.subarray(0, 12),
      );
      decipher.setAuthTag(bytes.subarray(12, 28));
      const clear = Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]);
      res.set("Cache-Control", "no-store").json({
        dataUri: `data:${row.mime};base64,${clear.toString("base64")}`,
      });
    }),
  );
  app.post(
    "/api/me/documents/:kind",
    upload.single("document"),
    wrap((req, res) => {
      const kind = z
        .enum(["identity", "license", "vehicle", "selfie", "avatar"])
        .parse(req.params.kind);
      if (!req.file)
        throw new ApiError(
          400,
          "Choisissez une image JPEG, PNG ou WebP de moins de 6 Mo.",
        );
      if (req.actor.role !== "driver" && ["license", "vehicle"].includes(kind))
        throw new ApiError(403, "Ce document concerne les conducteurs.");
      if (store.activeFor(req.actor.id).length)
        throw new ApiError(
          409,
          "Terminez votre course avant de modifier vos documents.",
        );
      const b = req.file.buffer;
      const jpeg = b.length > 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
      const png =
        b.length > 8 &&
        b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const webp =
        b.length > 12 &&
        b.subarray(0, 4).toString() === "RIFF" &&
        b.subarray(8, 12).toString() === "WEBP";
      if (!jpeg && !png && !webp)
        throw new ApiError(400, "Le fichier doit être une image valide.");
      const documentId = id(),
        iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", storageKey, iv);
      const encrypted = Buffer.concat([cipher.update(b), cipher.final()]);
      const path = join(dataDir, documentId + ".enc");
      writeFileSync(path, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), {
        mode: 0o600,
      });
      store.db
        .prepare("INSERT INTO documents VALUES(?,?,?,?,?,?)")
        .run(
          documentId,
          req.actor.id,
          kind,
          path,
          jpeg ? "image/jpeg" : png ? "image/png" : "image/webp",
          Date.now(),
        );
      req.actor.documents = {
        ...req.actor.documents,
        [kind]: { name: kind + ".image", submittedAt: Date.now() },
      };
      if (
        kind === "identity" ||
        kind === "selfie" ||
        (kind === "avatar" && req.actor.identityVerification === "verified")
      )
        req.actor.identityVerification = "pending";
      if (kind !== "avatar" && req.actor.role === "driver") {
        req.actor.verification = "pending";
        req.actor.online = false;
      }
      store.saveUser(req.actor);
      res.json(req.actor);
    }),
  );
}
