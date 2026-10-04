import type { UserCapability } from "@pepo/types/model";
import { wrap, type RouteContext } from "../runtime";
export function registerUsersResource({ app, store }: RouteContext) {
  app.get(
    "/api/users/me",
    wrap((req, res) => {
      const p = req.actor;
      const rows = store.db
        .prepare("SELECT capability FROM user_capabilities WHERE userId=?")
        .all(p.id) as { capability: UserCapability }[];
      res.json({
        id: p.id,
        name: p.name,
        phone: p.phone,
        phoneVerified: p.phoneVerified,
        city: p.city,
        capabilities: rows.map((r) => r.capability),
      });
    }),
  );
}
