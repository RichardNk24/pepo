import type { DriverProfile, Profile, Role, Trip } from "@pepo/types/model";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(path: string) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, phone TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), expiresAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS otp (phone TEXT PRIMARY KEY, hash TEXT NOT NULL, expiresAt INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, createdAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY, riderId TEXT NOT NULL, driverId TEXT, status TEXT NOT NULL, city TEXT NOT NULL, vehicle TEXT NOT NULL, createdAt INTEGER NOT NULL, data TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS trip_rider ON trips(riderId, status);
    CREATE INDEX IF NOT EXISTS trip_rider_completed_recent ON trips(riderId, city, status, createdAt DESC);
    CREATE INDEX IF NOT EXISTS trip_driver ON trips(driverId, status);
    CREATE INDEX IF NOT EXISTS trip_dispatch ON trips(city, vehicle, status);
    CREATE INDEX IF NOT EXISTS trip_status ON trips(status);
    CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, tripId TEXT NOT NULL REFERENCES trips(id), senderId TEXT NOT NULL, text TEXT NOT NULL, createdAt INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS message_trip ON messages(tripId, createdAt);
    CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, userId TEXT NOT NULL, tripId TEXT, category TEXT NOT NULL, detail TEXT NOT NULL, createdAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS shares (hash TEXT PRIMARY KEY, tripId TEXT NOT NULL REFERENCES trips(id), expiresAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, userId TEXT NOT NULL, kind TEXT NOT NULL, path TEXT NOT NULL, mime TEXT NOT NULL, createdAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS pin_attempts (tripId TEXT PRIMARY KEY, attempts INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS driver_profiles (userId TEXT PRIMARY KEY REFERENCES users(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rider_profiles (userId TEXT PRIMARY KEY REFERENCES users(id), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS saved_places (userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, id TEXT NOT NULL, category TEXT NOT NULL, label TEXT NOT NULL, note TEXT, placeData TEXT NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, PRIMARY KEY(userId,id));
    CREATE INDEX IF NOT EXISTS saved_places_user_updated ON saved_places(userId, updatedAt DESC);
    CREATE TABLE IF NOT EXISTS place_preferences (userId TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, suggestionsEnabled INTEGER NOT NULL DEFAULT 1 CHECK(suggestionsEnabled IN (0,1)), updatedAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS live_activity_tokens (tripId TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, riderId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, activityId TEXT NOT NULL, pushToken TEXT NOT NULL, language TEXT NOT NULL CHECK(language IN ('fr','en','sw','ln')), updatedAt INTEGER NOT NULL, PRIMARY KEY(tripId,activityId));
    CREATE INDEX IF NOT EXISTS live_activity_trip ON live_activity_tokens(tripId);
    CREATE TABLE IF NOT EXISTS user_capabilities (userId TEXT NOT NULL REFERENCES users(id), capability TEXT NOT NULL CHECK(capability IN ('RIDER','DRIVER','ADMIN','SUPPORT')), PRIMARY KEY(userId,capability));
  `);
  db.exec(
    `CREATE INDEX IF NOT EXISTS driver_available ON driver_profiles(json_extract(data,'$.online'),json_extract(data,'$.verification'),json_extract(data,'$.vehicle.vehicle')); CREATE INDEX IF NOT EXISTS user_city ON users(json_extract(data,'$.city'));`,
  );
  const sessionColumns = db.prepare("PRAGMA table_info(sessions)").all() as {
    name: string;
  }[];
  if (!sessionColumns.some((c) => c.name === "role")) {
    db.exec(
      "ALTER TABLE sessions ADD COLUMN role TEXT NOT NULL DEFAULT 'passenger'",
    );
    db.exec(
      "UPDATE sessions SET role=COALESCE((SELECT json_extract(data,'$.role') FROM users WHERE users.id=sessions.userId),'passenger')",
    );
  }
  const driverProfile = (id: string): DriverProfile | undefined => {
    const row = db
      .prepare("SELECT data FROM driver_profiles WHERE userId=?")
      .get(id) as { data: string } | undefined;
    return row && JSON.parse(row.data);
  };
  const user = (id: string, role?: Role): Profile | undefined => {
    const row = db.prepare("SELECT data FROM users WHERE id=?").get(id) as
      | { data: string }
      | undefined;
    if (!row) return undefined;
    const p: Profile = JSON.parse(row.data);
    p.role = role || p.role;
    if (p.role === "driver") {
      const d = driverProfile(id);
      if (d)
        Object.assign(p, {
          driver: d.vehicle,
          online: d.online,
          verification: d.verification,
          rating: d.rating,
          trips: d.trips,
          documents: { ...p.documents, ...d.documents },
        });
      else
        Object.assign(p, {
          driver: undefined,
          online: false,
          verification: "unverified",
          rating: 0,
          trips: 0,
        });
    } else {
      delete p.driver;
      p.online = false;
    }
    return p;
  };
  const byPhone = (phone: string, role?: Role): Profile | undefined => {
    const row = db
      .prepare("SELECT data FROM users WHERE phone=?")
      .get(phone) as { data: string } | undefined;
    return row && user(JSON.parse(row.data).id, role);
  };
  const saveUser = (p: Profile) => {
    const previous = db
      .prepare("SELECT data FROM users WHERE id=?")
      .get(p.id) as { data: string } | undefined;
    const old: Partial<Profile> = previous ? JSON.parse(previous.data) : {};
    const central: Profile = {
      ...p,
      online: false,
      verification:
        p.role === "driver" ? old.verification || "unverified" : p.verification,
      documents: {
        ...old.documents,
        ...Object.fromEntries(
          Object.entries(p.documents || {}).filter(([k]) =>
            ["identity", "selfie", "avatar"].includes(k),
          ),
        ),
      },
    };
    delete central.driver;
    db.prepare(
      "INSERT INTO users(id,phone,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    ).run(p.id, p.phone, JSON.stringify(central));
    db.prepare("INSERT OR IGNORE INTO user_capabilities VALUES(?,'RIDER')").run(
      p.id,
    );
    db.prepare(
      "INSERT INTO rider_profiles VALUES(?,?) ON CONFLICT(userId) DO UPDATE SET data=excluded.data",
    ).run(
      p.id,
      JSON.stringify({
        userId: p.id,
        trustedContacts: p.trustedContacts || [],
        paymentMethods: p.paymentMethods || [],
      }),
    );
    if (p.role === "driver") {
      db.prepare(
        "INSERT OR IGNORE INTO user_capabilities VALUES(?,'DRIVER')",
      ).run(p.id);
      db.prepare(
        "INSERT INTO driver_profiles VALUES(?,?) ON CONFLICT(userId) DO UPDATE SET data=excluded.data",
      ).run(
        p.id,
        JSON.stringify({
          userId: p.id,
          verification: p.verification,
          online: p.online,
          vehicle: p.driver,
          documents: p.documents,
          rating: p.rating,
          trips: p.trips,
        } satisfies DriverProfile),
      );
    }
  };
  // Idempotent migration: legacy driver data is split once; existing profiles are never reset.
  for (const row of db.prepare("SELECT data FROM users").all() as {
    data: string;
  }[]) {
    const p: Profile = JSON.parse(row.data);
    if (
      !db.prepare("SELECT userId FROM rider_profiles WHERE userId=?").get(p.id)
    )
      saveUser(p);
  }
  const trip = (id: string): Trip | undefined => {
    const row = db.prepare("SELECT data FROM trips WHERE id=?").get(id) as
      | { data: string }
      | undefined;
    return row && JSON.parse(row.data);
  };
  const saveTrip = (t: Trip) =>
    db
      .prepare(
        "INSERT INTO trips VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET driverId=excluded.driverId,status=excluded.status,data=excluded.data",
      )
      .run(
        t.id,
        t.riderId,
        t.driverId || null,
        t.status,
        t.pickup.city,
        t.vehicle,
        t.createdAt,
        JSON.stringify(t),
      );
  const trips = (sql: string, ...params: (string | number)[]): Trip[] =>
    (db.prepare(sql).all(...params) as { data: string }[]).map((r) =>
      JSON.parse(r.data),
    );
  const atomic = <T>(work: () => T): T => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const activeFor = (id: string) =>
    trips(
      "SELECT data FROM trips WHERE (riderId=? OR driverId=?) AND status IN ('searching','accepted','arrived','in_progress')",
      id,
      id,
    );
  return {
    db,
    user,
    byPhone,
    saveUser,
    trip,
    saveTrip,
    trips,
    atomic,
    activeFor,
    driverProfile,
  };
}
export type Store = ReturnType<typeof openDatabase>;
