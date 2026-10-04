import { ApiError, wrap, type RouteContext } from "../runtime";
export function registerDriversResource({ app, store }: RouteContext) {
  app.get(
    "/api/drivers/me",
    wrap((req, res) => {
      const profile = store.driverProfile(req.actor.id);
      if (!profile)
        throw new ApiError(404, "Créez votre dossier dans Pepo Driver.");
      res.json(profile);
    }),
  );
}
