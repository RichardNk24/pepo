import { randomUUID } from "node:crypto";
import type { Store } from "../../database";

/** The trigger and trip change commit together, including direct SQL writers. */
export function installTripOutbox(store: Store): string {
  store.atomic(() => {
    store.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS trip_one_active_rider ON trips(riderId)
        WHERE status IN ('searching','accepted','arrived','in_progress');
      CREATE UNIQUE INDEX IF NOT EXISTS trip_one_active_driver ON trips(driverId)
        WHERE driverId IS NOT NULL AND status IN ('accepted','arrived','in_progress');
      CREATE TABLE IF NOT EXISTS trip_replication_source (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS trip_replication_queue (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id TEXT NOT NULL, data TEXT NOT NULL
      );
    `);
    const source = store.db.prepare("SELECT id FROM trip_replication_source").get();
    if (!source) {
      store.db.prepare("INSERT INTO trip_replication_source VALUES(?)").run(randomUUID());
      store.db.exec(`INSERT INTO trip_replication_queue(trip_id,data)
        SELECT id,data FROM trips ORDER BY createdAt,id`);
    }
    store.db.exec(`
      CREATE TRIGGER IF NOT EXISTS trip_replication_insert AFTER INSERT ON trips BEGIN
        INSERT INTO trip_replication_queue(trip_id,data) VALUES(NEW.id,NEW.data);
      END;
      CREATE TRIGGER IF NOT EXISTS trip_replication_update AFTER UPDATE OF data ON trips
        WHEN OLD.data <> NEW.data BEGIN
        INSERT INTO trip_replication_queue(trip_id,data) VALUES(NEW.id,NEW.data);
      END;
      CREATE TRIGGER IF NOT EXISTS trip_replication_no_delete BEFORE DELETE ON trips BEGIN
        SELECT RAISE(ABORT,'Trip replication: cancel a trip instead of deleting it');
      END;
    `);
  });
  return (store.db.prepare("SELECT id FROM trip_replication_source").get() as { id: string }).id;
}

export function tripReplicationStatus(store: Store) {
  return store.db.prepare("SELECT COUNT(*) AS pending, MIN(seq) AS firstSequence, MAX(seq) AS lastSequence FROM trip_replication_queue").get();
}
