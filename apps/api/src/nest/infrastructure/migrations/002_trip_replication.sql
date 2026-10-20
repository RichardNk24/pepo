-- Transitional persistence: SQLite remains authoritative until all consumers migrate.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS legacy_sequence bigint NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS trip_replication_source (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  source_id text NOT NULL,
  last_sequence bigint NOT NULL DEFAULT 0,
  synced_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS trips_one_active_rider ON trips(rider_id)
  WHERE status IN ('searching','accepted','arrived','in_progress');
CREATE UNIQUE INDEX IF NOT EXISTS trips_one_active_driver ON trips(driver_id)
  WHERE driver_id IS NOT NULL AND status IN ('accepted','arrived','in_progress');
