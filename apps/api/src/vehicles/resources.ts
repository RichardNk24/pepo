import { wrap, type RouteContext } from "../runtime";
export function registerVehiclesResource({ app, store }: RouteContext) {
  app.get(
    "/api/vehicles/me",
    wrap((req, res) =>
      res.json({ vehicle: store.driverProfile(req.actor.id)?.vehicle || null }),
    ),
  );
}
