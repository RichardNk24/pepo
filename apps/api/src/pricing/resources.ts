import { VEHICLES } from "@pepo/utils/cities";
import { wrap, type RouteContext } from "../runtime";
export function registerPricingResource({ app, store }: RouteContext) {
  app.get(
    "/api/pricing/categories",
    wrap((_req, res) =>
      res.json({ currency: "CDF", mode: "negotiated", categories: VEHICLES }),
    ),
  );
}
