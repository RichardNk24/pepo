import { wrap, type RouteContext } from "../runtime";
export function registerRidersResource({ app, store }: RouteContext) {
  app.get(
    "/api/riders/me",
    wrap((req, res) =>
      res.json({
        userId: req.actor.id,
        trustedContacts: req.actor.trustedContacts || [],
        paymentMethods: req.actor.paymentMethods || [],
      }),
    ),
  );
}
