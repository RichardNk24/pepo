import { HttpException } from "@nestjs/common";
import type { Profile } from "@pepo/types/model";
import type { Store } from "../database";
import type { PostgresService } from "../nest/infrastructure/postgres.service";

export function hasPremium(
  row?: { expires_at: Date | string; revoked_at?: Date | string | null },
  now = Date.now(),
) {
  return Boolean(
    row && !row.revoked_at && new Date(row.expires_at).getTime() > now,
  );
}
export class PremiumService {
  constructor(
    private pg: PostgresService,
    private store: Store,
    private dev: boolean,
  ) {}
  private check(actor?: Profile): asserts actor is Profile {
    if (!actor) throw new HttpException({ error: "Reconnectez-vous." }, 401);
    if (actor.role !== "passenger")
      throw new HttpException({ error: "Utilisez Pepo passager." }, 403);
    if (!this.pg.ready)
      throw new HttpException(
        { error: "Premium momentanément indisponible." },
        503,
      );
  }
  async status(actor: Profile) {
    this.check(actor);
    const result = await this.pg.query<{
      expires_at: Date;
      revoked_at: Date | null;
      source: string;
      theme: string;
    }>(
      `SELECT a.expires_at,a.revoked_at,a.source,p.theme FROM premium_access a LEFT JOIN premium_preferences p ON p.user_id=a.user_id WHERE a.user_id=$1`,
      [actor.id],
    );
    const row = result.rows[0],
      active = hasPremium(row) && (row?.source !== "development" || this.dev);
    return {
      active,
      theme: active ? row?.theme || "purple" : "classic",
      expiresAt: active ? new Date(row.expires_at).getTime() : null,
      developmentPreview: this.dev,
      billingAvailable: false,
      source: active ? row.source : null,
      pricing: {
        currency: "USD",
        monthly: 1,
        annual: 11.88,
        annualMonthlyEquivalent: 0.99,
      },
    };
  }
  async theme(actor: Profile, value: unknown) {
    this.check(actor);
    if (!["purple", "mono", "classic"].includes(String(value)))
      throw new HttpException({ error: "Thème invalide." }, 400);
    const status = await this.status(actor);
    if (!status.active)
      throw new HttpException(
        { error: "Un accès Premium actif est nécessaire." },
        403,
      );
    await this.pg.query(
      `INSERT INTO premium_preferences(user_id,theme) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET theme=excluded.theme,updated_at=now()`,
      [actor.id, value],
    );
    return this.status(actor);
  }
  async preview(actor: Profile) {
    this.check(actor);
    if (!this.dev)
      throw new HttpException({ error: "Fonction indisponible." }, 404);
    const current = await this.status(actor);
    if (current.active && current.source !== "development") return current;
    await this.pg.transaction(async (c) => {
      // Supports the legacy auth bridge without overwriting PostgreSQL identities.
      await c.query(
        "INSERT INTO users(id,phone,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO NOTHING",
        [actor.id, actor.phone, JSON.stringify(actor)],
      );
      await c.query(
        `INSERT INTO premium_access(user_id,source,expires_at) VALUES($1,'development',now()+interval '1 hour')
        ON CONFLICT(user_id) DO UPDATE SET source='development',expires_at=excluded.expires_at,revoked_at=NULL,updated_at=now()
        WHERE premium_access.source='development'`,
        [actor.id],
      );
    });
    return this.status(actor);
  }
  async endPreview(actor: Profile) {
    this.check(actor);
    if (!this.dev)
      throw new HttpException({ error: "Fonction indisponible." }, 404);
    await this.pg.query(
      "UPDATE premium_access SET revoked_at=now(),updated_at=now() WHERE user_id=$1 AND source='development'",
      [actor.id],
    );
    return this.status(actor);
  }
  async summary(actor: Profile) {
    if (!(await this.status(actor)).active)
      throw new HttpException(
        { error: "Un accès Premium actif est nécessaire." },
        403,
      );
    const offset = actor.city === "kinshasa" ? 1 : 2;
    const local = new Date(Date.now() + offset * 3600000);
    const start =
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) -
      offset * 3600000;
    const end =
      Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1) -
      offset * 3600000;
    const trips = this.store
      .trips(
        "SELECT data FROM trips WHERE riderId=? AND status='completed'",
        actor.id,
      )
      .filter(
        (t) => (t.completedAt || 0) >= start && (t.completedAt || 0) < end,
      );
    return {
      month: `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`,
      currency: "CDF",
      trips: trips.length,
      distanceKm:
        Math.round(trips.reduce((n, t) => n + t.route.distanceKm, 0) * 10) / 10,
      agreedAmount: trips.reduce((n, t) => n + (t.agreedPrice || 0), 0),
      cashConfirmedAmount: trips
        .filter((t) => t.cashCollectedAt)
        .reduce((n, t) => n + (t.agreedPrice || 0), 0),
    };
  }
}
