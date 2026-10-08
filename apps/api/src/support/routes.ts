import { z } from "zod";

import { hash, id, wrap, type RouteContext } from "../runtime";
export function register_support(ctx: RouteContext) {
  const { app, store, requiredTrip, participant } = ctx;
  app.post(
    "/api/incidents",
    wrap((req, res) => {
      const input = z
        .object({
          tripId: z.string().optional(),
          category: z.string().min(2).max(80),
          detail: z.string().trim().min(5).max(2000),
        })
        .parse(req.body);
      if (input.tripId) participant(requiredTrip(input.tripId), req.actor);
      const item = { id: id(), ...input, createdAt: Date.now() };
      store.db
        .prepare("INSERT INTO incidents VALUES(?,?,?,?,?,?)")
        .run(
          item.id,
          req.actor.id,
          item.tripId || null,
          item.category,
          item.detail,
          item.createdAt,
        );
      res.status(201).json(item);
    }),
  );
  app.get("/track/:token", (req, res) => {
    const row = store.db
      .prepare("SELECT tripId FROM shares WHERE hash=? AND expiresAt>?")
      .get(hash(String(req.params.token)), Date.now()) as
      | { tripId: string }
      | undefined;
    const t = row && store.trip(row.tripId);
    res.set("Cache-Control", "no-store");
    if (!t) return res.status(404).send("Ce lien de suivi a expiré.");
    const escape = (s: string) =>
      s.replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c]!,
      );
    const active = ["accepted", "arrived", "in_progress"].includes(t.status);
    const p = t.driverLocationAt ? t.driverLocation : undefined;
    res
      .type("html")
      .send(
        `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${active ? '<meta http-equiv="refresh" content="15">' : ""}<title>Suivi Pepo</title><body><main><h1>Pepo · Suivi de course</h1><p>${active ? "Course en cours" : "Course terminée ou annulée — suivi désactivé."}</p>${active ? `<p>${escape(t.pickup.name)} → ${escape(t.destination.name)}</p><p>Conducteur : ${escape(t.driver?.name.split(" ")[0] || "")} · ${escape(t.driver?.driver.plate || "")}</p>${p ? `<p><a rel="noreferrer" href="https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}">Voir la dernière position reçue sur Google Maps</a></p><p>Dernière position : ${escape(new Date(t.driverLocationAt!).toLocaleTimeString("fr-FR"))}</p>` : "<p>En attente de la position du conducteur.</p>"}<p>Le suivi fonctionne quand l’application du conducteur est ouverte. Actualisation toutes les 15 secondes.</p>` : ""}</main></body></html>`,
      );
  });
}
