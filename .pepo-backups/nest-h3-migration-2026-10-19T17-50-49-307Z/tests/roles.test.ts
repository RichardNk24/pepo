import { afterEach, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openDatabase, type Store } from "../apps/api/src/database";
import { createApp } from "../apps/api/src/app";
import { availableDriverIds } from "../apps/api/src/dispatch/availableDrivers";
import { PLACES } from "@pepo/utils/cities";
import type { Profile, Trip, Role } from "@pepo/types/model";
let store: Store, dir: string, app: ReturnType<typeof createApp>["app"];
const auth = (token: string) => ({ Authorization: "Bearer " + token });
const phone = "+243842123456";
async function login(role: Role, p = phone) {
  const r = await request(app)
    .post("/api/auth/request")
    .send({ phone: p })
    .expect(200);
  return (
    await request(app)
      .post("/api/auth/verify")
      .send({
        phone: p,
        code: r.body.devCode,
        name: "Amina Test",
        role,
        city: "lubumbashi",
      })
      .expect(200)
  ).body as { token: string; profile: Profile };
}
describe("One identity with independent Rider and Driver sessions", () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pepo-roles-"));
    store = openDatabase(":memory:");
    app = createApp(store, {
      safety: { enabled: false },
      devAuth: true,
      dataDir: dir,
      publicUrl: "https://pepo.test",
      corsOrigins: [],
    }).app;
  });
  afterEach(() => {
    store.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  it("preserves the driver profile when the same person signs in and edits the Rider account", async () => {
    const d = await login("driver");
    store.saveUser({
      ...d.profile,
      online: true,
      verification: "verified",
      trips: 7,
      rating: 4.5,
      driver: {
        vehicle: "moto",
        model: "Haojue HJ125",
        plate: "LSH TEST 12",
        helmet: true,
      },
    });
    const r = await login("passenger");
    expect(r.profile.id).toBe(d.profile.id);
    expect(r.profile.driver).toBeUndefined();
    expect(r.profile.online).toBe(false);
    await request(app)
      .patch("/api/me")
      .set(auth(r.token))
      .send({
        name: "Amina Nouveau",
        trustedContacts: [{ name: "Maman", phone: "+243912345678" }],
      })
      .expect(200);
    const driver = (
      await request(app).get("/api/me").set(auth(d.token)).expect(200)
    ).body;
    expect(driver.role).toBe("driver");
    expect(driver.name).toBe("Amina Nouveau");
    expect(driver.online).toBe(true);
    expect(driver.verification).toBe("verified");
    expect(driver.driver.plate).toBe("LSH TEST 12");
    expect(driver.trips).toBe(7);
    const row = store.db
      .prepare("SELECT data FROM users WHERE id=?")
      .get(d.profile.id) as { data: string };
    expect(JSON.parse(row.data).driver).toBeUndefined();
    const central = (
      await request(app).get("/api/users/me").set(auth(r.token)).expect(200)
    ).body;
    expect(central.capabilities.sort()).toEqual(["DRIVER", "RIDER"]);
    await request(app).get("/api/requests").set(auth(r.token)).expect(403);
    await request(app)
      .patch("/api/me")
      .set(auth(r.token))
      .send({ role: "driver" })
      .expect(400);
    await request(app)
      .post("/api/trips")
      .set(auth(d.token))
      .send({
        pickup: PLACES[0],
        destination: PLACES[2],
        vehicle: "moto",
        proposedPrice: 5000,
      })
      .expect(403);
    await request(app).post("/api/logout").set(auth(r.token)).expect(200);
    await request(app).get("/api/me").set(auth(d.token)).expect(200);
  });
  it("dispatches to the Driver profile after a later Rider login and reports gross earnings without invented commissions", async () => {
    const d = await login("driver");
    store.saveUser({
      ...d.profile,
      verification: "verified",
      online: true,
      driver: {
        vehicle: "moto",
        model: "Haojue",
        plate: "LSH TEST 12",
        helmet: true,
      },
    });
    await login("passenger");
    const r = await login("passenger", "+243812345678");
    const created = (
      await request(app)
        .post("/api/trips")
        .set(auth(r.token))
        .send({
          pickup: PLACES[0],
          destination: PLACES[2],
          vehicle: "moto",
          proposedPrice: 5000,
        })
        .expect(201)
    ).body as Trip;
    expect(availableDriverIds(store, created)).toContain(d.profile.id);
    expect(
      (
        await request(app).get("/api/requests").set(auth(d.token)).expect(200)
      ).body.map((t: Trip) => t.id),
    ).toContain(created.id);
    const offer = (
      await request(app)
        .post(`/api/trips/${created.id}/offers`)
        .set(auth(d.token))
        .send({ price: 5500, eta: 3 })
        .expect(200)
    ).body.offers[0];
    const assigned = (
      await request(app)
        .post(`/api/trips/${created.id}/accept`)
        .set(auth(r.token))
        .send({ offerId: offer.id })
        .expect(200)
    ).body;
    await request(app)
      .post(`/api/trips/${created.id}/status`)
      .set(auth(d.token))
      .send({ status: "arrived" })
      .expect(200);
    await request(app)
      .post(`/api/trips/${created.id}/status`)
      .set(auth(d.token))
      .send({ status: "in_progress", pin: assigned.pickupPin })
      .expect(200);
    await request(app)
      .post(`/api/trips/${created.id}/status`)
      .set(auth(d.token))
      .send({ status: "completed" })
      .expect(200);
    expect(store.driverProfile(d.profile.id)?.trips).toBe(1);
    const earnings = (
      await request(app)
        .get("/api/earnings/summary")
        .set(auth(d.token))
        .expect(200)
    ).body;
    expect(earnings).toMatchObject({
      completedTrips: 1,
      grossAmount: 5500,
      commissionAmount: null,
      netAmount: null,
      currency: "CDF",
    });
    await request(app)
      .get("/api/earnings/summary")
      .set(auth(r.token))
      .expect(403);
    const payments = (
      await request(app)
        .get("/api/payments/methods")
        .set(auth(r.token))
        .expect(200)
    ).body;
    expect(payments.cash.enabled).toBe(true);
    expect(payments.mobileMoney.enabled).toBe(false);
    expect(payments.card.enabled).toBe(false);
  });
  it("migrates a legacy database twice without resetting documents, sessions or driver availability", () => {
    const path = join(dir, "legacy.sqlite");
    const legacy = new DatabaseSync(path);
    legacy.exec(
      "CREATE TABLE users(id TEXT PRIMARY KEY,phone TEXT UNIQUE NOT NULL,data TEXT NOT NULL);CREATE TABLE sessions(hash TEXT PRIMARY KEY,userId TEXT NOT NULL,expiresAt INTEGER NOT NULL);",
    );
    const profile: Profile = {
      id: "old-user",
      name: "Patrick",
      phone,
      role: "driver",
      city: "lubumbashi",
      verification: "verified",
      online: true,
      rating: 4.7,
      trips: 24,
      driver: {
        vehicle: "taxi",
        model: "Toyota",
        plate: "LSH 123",
        helmet: false,
      },
      documents: {
        license: { submittedAt: 100, mime: "image/jpeg", bytes: 123 },
      },
    };
    legacy
      .prepare("INSERT INTO users VALUES(?,?,?)")
      .run(profile.id, phone, JSON.stringify(profile));
    legacy
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run("old-session", profile.id, Date.now() + 10000);
    legacy.close();
    for (let i = 0; i < 2; i++) {
      const db = openDatabase(path);
      expect(db.user(profile.id, "driver")).toMatchObject(profile);
      expect(db.user(profile.id, "passenger")?.driver).toBeUndefined();
      expect(db.db.prepare("SELECT role FROM sessions").get()).toEqual(
        expect.objectContaining({ role: "driver" }),
      );
      db.db.close();
    }
  });
});
