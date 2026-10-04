import { wrap, type RouteContext } from "../runtime";
export function registerPaymentsResource({ app, store }: RouteContext) {
  app.get(
    "/api/payments/methods",
    wrap((req, res) =>
      res.json({
        cash: { enabled: true },
        mobileMoney: {
          enabled: false,
          savedNumbers: req.actor.paymentMethods || [],
        },
        card: { enabled: false },
      }),
    ),
  );
}
