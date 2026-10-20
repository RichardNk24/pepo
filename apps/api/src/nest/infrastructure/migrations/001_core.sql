CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  phone text NOT NULL UNIQUE,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('passenger', 'driver')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_expiry ON sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS otp_challenges (
  phone text PRIMARY KEY,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trips (
  id text PRIMARY KEY,
  rider_id text NOT NULL REFERENCES users(id),
  driver_id text REFERENCES users(id),
  status text NOT NULL,
  city text NOT NULL,
  vehicle text NOT NULL,
  created_at timestamptz NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trips_rider_status_recent ON trips(rider_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS trips_driver_status ON trips(driver_id, status);
CREATE INDEX IF NOT EXISTS trips_dispatch_queue ON trips(city, vehicle, status, created_at);

CREATE TABLE IF NOT EXISTS driver_positions (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  city text NOT NULL,
  vehicle text NOT NULL,
  cell text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy double precision NOT NULL CHECK (accuracy >= 0),
  captured_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_positions_cell_fresh ON driver_positions(city, vehicle, cell, captured_at DESC);

CREATE TABLE IF NOT EXISTS dispatch_offers (
  trip_id text NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  driver_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  eta_seconds integer NOT NULL CHECK (eta_seconds >= 0),
  status text NOT NULL CHECK (status IN ('pending', 'offered', 'expired', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (trip_id, driver_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS dispatch_one_pending_per_driver ON dispatch_offers(driver_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS dispatch_pending_trip ON dispatch_offers(trip_id, status, expires_at);

CREATE TABLE IF NOT EXISTS saved_places (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL,
  category text NOT NULL,
  label text NOT NULL,
  note text,
  place_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, id)
);
CREATE INDEX IF NOT EXISTS saved_places_user_updated ON saved_places(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS event_outbox (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS event_outbox_pending ON event_outbox(id) WHERE published_at IS NULL;
