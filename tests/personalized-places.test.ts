import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Place, Trip } from "@pepo/types/model";
import { rankPersonalDestinations } from "../apps/api/src/personalization/places";
import { createApp } from "../apps/api/src/app";
import { openDatabase, type Store } from "../apps/api/src/database";

let store: Store;
let app: ReturnType<typeof createApp>["app"];
let dir: string;
let nextPhone = 1;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createPassenger() {
  const phone = `+2438${String(nextPhone++).padStart(8, "0")}`;
  const code = (
    await request(app).post("/api/auth/request").send({ phone }).expect(200)
  ).body.devCode;
  return (
    await request(app)
      .post("/api/auth/verify")
      .send({
        phone,
        code,
        name: "Test Rider",
        role: "passenger",
        city: "lubumbashi",
      })
      .expect(200)
  ).body as { token: string; profile: { id: string } };
}

const place = (id: string, name: string, latitude: number, longitude: number): Place => ({
  id,
  name,
  address: `${name}, Lubumbashi`,
  latitude,
  longitude,
  city: "lubumbashi",
});

function completedTrip(
  id: string,
  riderId: string,
  destination: Place,
  completedAt: number,
): Trip {
  const pickup = place("pickup", "Départ", -11.66, 27.48);
  return {
    id,
    riderId,
    riderName: "Test Rider",
    riderVerification: "unverified",
    pickup,
    destination,
    vehicle: "moto",
    proposedPrice: 5000,
    status: "completed",
    offers: [],
    route: {
      points: [pickup, destination],
      distanceKm: 1,
      durationMin: 5,
      source: "estimate",
    },
    createdAt: completedAt - 600_000,
    updatedAt: completedAt,
    completedAt,
    payment: "cash",
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pepo-personal-places-"));
  store = openDatabase(":memory:");
  app = createApp(store, {
    devAuth: true,
    publicUrl: "http://localhost:4000",
    adminToken: "test-admin",
    dataDir: dir,
    corsOrigins: [],
  }).app;
});

afterEach(() => {
  store.db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("private saved places and destination personalization", () => {
  it("keeps saved places private and PUT retries update the same record", async () => {
    const rider = await createPassenger();
    const other = await createPassenger();
    const input = {
      category: "home",
      label: "Chez moi",
      note: "Entrée côté avenue",
      place: place("pin--11.664000-27.480000", "Lieu choisi sur la carte", -11.664, 27.48),
    };
    await request(app)
      .put("/api/me/saved-places/rider-home-0001")
      .send(input)
      .expect(401);
    await request(app)
      .put("/api/me/saved-places/rider-home-0001")
      .set(auth(rider.token))
      .send(input)
      .expect(200);
    await request(app)
      .put("/api/me/saved-places/rider-home-0001")
      .set(auth(rider.token))
      .send({ ...input, label: "Maison" })
      .expect(200);

    const own = await request(app)
      .get("/api/me/saved-places")
      .set(auth(rider.token))
      .expect(200);
    const notShared = await request(app)
      .get("/api/me/saved-places")
      .set(auth(other.token))
      .expect(200);
    expect(own.body).toHaveLength(1);
    expect(own.body[0].label).toBe("Maison");
    expect(own.body[0].note).toBe(input.note);
    expect(notShared.body).toEqual([]);

    await request(app)
      .delete("/api/me/saved-places/rider-home-0001")
      .set(auth(rider.token))
      .expect(204);
    expect(
      (await request(app)
        .get("/api/me/saved-places")
        .set(auth(rider.token))
        .expect(200)).body,
    ).toEqual([]);
  });

  it("ranks repeated destinations using Lubumbashi local hour and weekday", () => {
    const now = new Date("2026-10-05T10:00:00+02:00").getTime();
    const weekdayPlace = place("google-home", "École", -11.66, 27.48);
    const eveningPlace = place("google-shop", "Marché", -11.67, 27.49);
    const trips = [
      completedTrip("a1", "rider", weekdayPlace, new Date("2026-09-28T10:00:00+02:00").getTime()),
      completedTrip("a2", "rider", weekdayPlace, new Date("2026-09-21T10:00:00+02:00").getTime()),
      completedTrip("b1", "rider", eveningPlace, new Date("2026-10-03T21:00:00+02:00").getTime()),
      completedTrip("b2", "rider", eveningPlace, new Date("2026-09-26T21:00:00+02:00").getTime()),
      completedTrip("b3", "rider", eveningPlace, new Date("2026-09-19T21:00:00+02:00").getTime()),
    ];
    const ranked = rankPersonalDestinations(trips, "lubumbashi", now);
    expect(ranked.suggestions[0]?.place.id).toBe("google-home");
    expect(ranked.suggestions[0]?.reason).toBe("usual_time");
    expect(ranked.suggestions[0]?.visitCount).toBe(2);
  });

  it("provides recent places early and never merges distinct named branches", () => {
    const now = new Date("2026-10-05T10:00:00+02:00").getTime();
    const one = place("google-branch-1", "Hôtel Pullman", -11.66, 27.48);
    const two = place("google-branch-2", "Hôtel Pullman", -11.6601, 27.4801);
    const result = rankPersonalDestinations(
      [
        completedTrip("a", "rider", one, now - 60_000),
        completedTrip("b", "rider", two, now - 30_000),
      ],
      "lubumbashi",
      now,
    );
    expect(result.suggestions).toEqual([]);
    expect(result.recent.map((item) => item.place.id)).toEqual([
      "google-branch-2",
      "google-branch-1",
    ]);
  });

  it("serves learned suggestions only from the signed-in rider and supports opt-out", async () => {
    const rider = await createPassenger();
    const other = await createPassenger();
    const destination = place("google-destination", "Université", -11.66, 27.48);
    const now = Date.now();
    store.saveTrip(
      completedTrip("r1", rider.profile.id, destination, now - 3 * 86_400_000),
    );
    store.saveTrip(
      completedTrip("r2", rider.profile.id, destination, now - 10 * 86_400_000),
    );
    store.saveTrip(
      completedTrip("other-trip", other.profile.id, destination, now - 1_000),
    );
    const suggestions = await request(app)
      .get("/api/places/suggestions?city=lubumbashi")
      .set(auth(rider.token))
      .expect(200);
    expect(suggestions.body.suggestions).toHaveLength(1);
    expect(suggestions.body.completedTripsAnalyzed).toBe(2);
    expect(suggestions.headers["cache-control"]).toContain("no-store");

    await request(app)
      .put("/api/me/place-preferences")
      .set(auth(rider.token))
      .send({ personalizedSuggestions: false })
      .expect(200);
    const optedOut = await request(app)
      .get("/api/places/suggestions")
      .set(auth(rider.token))
      .expect(200);
    expect(optedOut.body.personalizationEnabled).toBe(false);
    expect(optedOut.body.suggestions).toEqual([]);
    expect(optedOut.body.recent).toEqual([]);
    expect(optedOut.body.completedTripsAnalyzed).toBe(0);
  });
});
