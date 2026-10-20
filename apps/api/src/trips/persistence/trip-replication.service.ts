import { Logger, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import type { Trip } from "@pepo/types/model";
import type { Store } from "../../database";
import type { PostgresService } from "../../nest/infrastructure/postgres.service";
import { installTripOutbox, tripReplicationStatus } from "./trip-outbox";

type Event = { seq: number; trip_id: string; data: string };

/** One authoritative SQLite database; PostgreSQL receives ordered durable snapshots. */
export class TripReplicationService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TripReplicationService.name);
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<number>;
  private stopped = false;
  private sourceId = "";
  private failures = 0;

  constructor(private readonly store: Store, private readonly postgres: PostgresService) {}

  async onApplicationBootstrap() {
    if (!this.postgres.ready) throw new Error("TRIPS_POSTGRES_MIRROR_ENABLED nécessite PostgreSQL prêt.");
    this.sourceId = installTripOutbox(this.store);
    // Fail startup on incompatible destination/schema rather than silently losing data.
    await this.flush();
    this.schedule();
  }

  status() { return tripReplicationStatus(this.store); }

  flush(): Promise<number> {
    if (this.running) return this.running;
    this.running = this.copyBatch().finally(() => { this.running = undefined; });
    return this.running;
  }

  private async copyBatch(): Promise<number> {
    const events = this.store.db.prepare("SELECT seq,trip_id,data FROM trip_replication_queue ORDER BY seq LIMIT 100").all() as Event[];
    await this.postgres.transaction(async (client) => {
      // Serialize mirror workers. This is not a distributed dispatch lock.
      await client.query("SELECT pg_advisory_xact_lock($1)", [728401622]);
      await client.query("INSERT INTO trip_replication_source(singleton,source_id) VALUES(true,$1) ON CONFLICT DO NOTHING", [this.sourceId]);
      const source = await client.query<{ source_id: string; last_sequence: string }>("SELECT source_id,last_sequence FROM trip_replication_source WHERE singleton=true");
      if (source.rows[0]?.source_id !== this.sourceId)
        throw new Error("Source SQLite différente : reprise manuelle requise avant synchronisation.");
      const localSequence = Number(this.store.db.prepare("SELECT seq FROM sqlite_sequence WHERE name='trip_replication_queue'").get()?.seq || 0);
      if (Number(source.rows[0]?.last_sequence || 0) > localSequence)
        throw new Error("SQLite restauré à une version antérieure : réconciliation requise.");
      for (const event of events) {
        const t = JSON.parse(event.data) as Trip;
        if (t.id !== event.trip_id) throw new Error("Identité de course incohérente dans la file.");
        for (const userId of new Set([t.riderId, t.driverId].filter((v): v is string => Boolean(v)))) {
          const user = this.store.db.prepare("SELECT id,phone,data FROM users WHERE id=?").get(userId) as { id: string; phone: string; data: string } | undefined;
          if (!user) throw new Error("Profil lié à une course absent de SQLite.");
          // Existing PostgreSQL auth identities must never be overwritten by the mirror.
          await client.query("INSERT INTO users(id,phone,data) VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO NOTHING", [user.id,user.phone,user.data]);
        }
        await client.query(`INSERT INTO trips(id,rider_id,driver_id,status,city,vehicle,created_at,data,updated_at,legacy_sequence)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
          ON CONFLICT(id) DO UPDATE SET rider_id=excluded.rider_id,driver_id=excluded.driver_id,
            status=excluded.status,city=excluded.city,vehicle=excluded.vehicle,data=excluded.data,
            updated_at=excluded.updated_at,legacy_sequence=excluded.legacy_sequence
          WHERE trips.legacy_sequence < excluded.legacy_sequence`,
          [t.id,t.riderId,t.driverId || null,t.status,t.pickup.city,t.vehicle,new Date(t.createdAt),event.data,new Date(t.updatedAt),event.seq]);
      }
      if (events.length) await client.query(`UPDATE trip_replication_source SET last_sequence=GREATEST(last_sequence,$1),synced_at=now() WHERE singleton=true`, [events.at(-1)!.seq]);
    });
    // A crash before this deletion causes safe replay; no acknowledgement before PG commit.
    if (events.length) this.store.db.prepare("DELETE FROM trip_replication_queue WHERE seq<=?").run(events.at(-1)!.seq);
    return events.length;
  }

  private schedule() {
    if (this.stopped) return;
    this.timer = setTimeout(async () => {
      try {
        await this.flush();
        if (this.failures) this.logger.log("Synchronisation des courses rétablie.");
        this.failures = 0;
      } catch {
        this.failures++;
        // No tokens, phone numbers, PINs or payloads in operational logs.
        this.logger.error("Synchronisation PostgreSQL des courses en attente ; file SQLite conservée. Vérifiez PostgreSQL et les conflits de données.");
      } finally { this.schedule(); }
    }, Math.min(30_000, 1000 * 2 ** Math.min(this.failures, 5)));
    this.timer.unref();
  }

  async onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.running;
  }
}
