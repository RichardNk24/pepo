import { z } from "zod";
import { moneyMethodsIssue } from "@pepo/utils/mobileMoney";

import {
  ApiError,
  city,
  driverSchema,
  phone,
  wrap,
  type RouteContext,
} from "../runtime";
export function register_users(ctx: RouteContext) {
  const { app, store } = ctx;
  app.get(
    "/api/me",
    wrap((req, res) => res.json(req.actor)),
  );
  app.post(
    "/api/logout",
    wrap((req, res) => {
      store.db.prepare("DELETE FROM sessions WHERE hash=?").run(req.tokenHash);
      res.json({ ok: true });
    }),
  );
  app.patch(
    "/api/me",
    wrap((req, res) => {
      const patch = z
        .object({
          name: z.string().trim().min(2).max(80).optional(),
          city: city.optional(),
          role: z.enum(["passenger", "driver"]).optional(),
          emergencyContact: z
            .object({ name: z.string().trim().min(2).max(80), phone })
            .nullable()
            .optional(),
          trustedContacts: z
            .array(
              z
                .object({ name: z.string().trim().min(2).max(80), phone })
                .strict(),
            )
            .max(3)
            .optional(),
          paymentMethods: z
            .array(
              z
                .object({
                  id: z.string().min(1).max(80),
                  provider: z.enum(["airtel", "mpesa", "orange", "afri"]),
                  phone: z.string().regex(/^\+243[89]\d{8}$/),
                })
                .strict(),
            )
            .max(8)
            .optional(),
          driver: driverSchema.optional(),
        })
        .strict()
        .parse(req.body);
      if (
        patch.trustedContacts &&
        new Set(patch.trustedContacts.map((c) => c.phone)).size !==
          patch.trustedContacts.length
      )
        throw new ApiError(400, "Ce contact est déjà enregistré.");
      if (patch.paymentMethods) {
        const issue = moneyMethodsIssue(
          patch.paymentMethods,
          req.actor.paymentMethods || [],
        );
        const messages = {
          moneyDuplicate: "Ce numéro Mobile Money est déjà enregistré.",
          moneyNetworkMismatch:
            "Le réseau ne correspond pas au numéro Mobile Money.",
          moneyTwoNumbers: "Vous pouvez enregistrer deux numéros par réseau.",
          moneyUnknownNetwork:
            "Choisissez un numéro Airtel Money, M-Pesa ou Orange Money.",
        };
        if (issue) throw new ApiError(400, messages[issue]);
      }
      if (patch.trustedContacts)
        patch.emergencyContact = patch.trustedContacts[0] || null;
      if (
        (patch.role || patch.city || patch.driver) &&
        (store.activeFor(req.actor.id).length ||
          store.trips(
            "SELECT data FROM trips WHERE riderId=? AND status='scheduled'",
            req.actor.id,
          ).length)
      )
        throw new ApiError(
          409,
          "Terminez ou annulez votre course avant de changer ces informations.",
        );
      if (patch.role && patch.role !== req.actor.role)
        throw new ApiError(
          400,
          "Connectez-vous dans l’application correspondant à ce rôle.",
        );
      if (patch.driver && req.actor.role !== "driver")
        throw new ApiError(
          403,
          "Utilisez Pepo Driver pour modifier le véhicule.",
        );
      const p = {
        ...req.actor,
        ...patch,
        online:
          patch.role || patch.city || patch.driver ? false : req.actor.online,
      };
      if (
        patch.driver ||
        (patch.role === "driver" && req.actor.role !== "driver")
      )
        p.verification = "pending";
      if (
        patch.name &&
        patch.name !== req.actor.name &&
        p.identityVerification === "verified"
      )
        p.identityVerification = "pending";
      store.saveUser(p);
      res.json(p);
    }),
  );
}
