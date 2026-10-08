import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Profile, Trip } from "@pepo/types/model";
import { PLACES } from "@pepo/utils/cities";
import { createApp } from "../apps/api/src/app";
import { openDatabase } from "../apps/api/src/database";
import { createSafety } from "../apps/api/src/safety/service";
import {
  distanceFromRouteM,
  nightPolicy,
  SAFETY,
} from "../apps/api/src/safety/policy";
import { safetyText } from "@pepo/i18n/safety";
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
let db: ReturnType<typeof openDatabase>,
  service: ReturnType<typeof createApp>,
  dir: string,
  now: number;
const fix = (p = PLACES[0], accuracy = 10) => ({
  latitude: p.latitude,
  longitude: p.longitude,
  accuracy,
  capturedAt: now,
});
function user(id: string, role: Profile["role"]): Profile {
  const p: Profile = {
    id,
    name: id + " Test",
    phone: `+24381${id === "rider" ? "1111111" : id === "driver" ? "2222222" : "3333333"}`,
    role,
    city: "lubumbashi",
    verification: "verified",
    identityVerification: "verified",
    phoneVerified: true,
    online: role === "driver",
    rating: 5,
    trips: 0,
    ...(role === "driver"
      ? {
          driver: {
            vehicle: "moto",
            model: "Moto Test",
            plate: "LSH TEST",
            helmet: true,
          },
          documents: Object.fromEntries(
            ["identity", "selfie", "license", "vehicle"].map((k) => [
              k,
              { name: k, submittedAt: now },
            ]),
          ),
        }
      : {}),
  };
  db.saveUser(p);
  db.db
    .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
    .run(
      createHash("sha256").update(id).digest("hex"),
      id,
      Date.now() + 86400000,
      role,
    );
  return p;
}
function trip(status: Trip["status"] = "searching") {
  const t: Trip = {
    id: "ride",
    riderId: "rider",
    riderName: "rider Test",
    riderVerification: "verified",
    pickup: PLACES[0],
    destination: PLACES[2],
    vehicle: "moto",
    proposedPrice: 5000,
    status,
    pickupPin: "1234",
    createdAt: now,
    updatedAt: now,
    offers: [],
    payment: "cash",
    route: {
      source: "google",
      points: [PLACES[0], PLACES[2]],
      distanceKm: 5,
      durationMin: 15,
    },
  };
  if (status !== "searching") {
    t.driverId = "driver";
    t.driver = {
      id: "driver",
      name: "Driver",
      verification: "verified",
      rating: 5,
      trips: 0,
      driver: db.user("driver", "driver")!.driver!,
    };
  }
  if (status === "in_progress") t.startedAt = now;
  db.saveTrip(t);
  return t;
}
async function approve() {
  await request(service.app)
    .post("/api/admin/safety/drivers/driver")
    .set(auth("admin"))
    .send({ approved: true })
    .expect(204);
}
async function location(p = PLACES[0], accuracy = 10) {
  return request(service.app)
    .post("/api/trips/ride/location")
    .set(auth("driver"))
    .send(fix(p, accuracy))
    .expect(200);
}
async function safetyState(token = "rider") {
  return (
    await request(service.app)
      .get("/api/trips/ride/safety")
      .set(auth(token))
      .expect(200)
  ).body;
}
beforeEach(() => {
  now = Date.parse("2026-10-07T20:00:00Z");
  dir = mkdtempSync(join(tmpdir(), "pepo-safety-"));
  db = openDatabase(":memory:");
  service = createApp(db, {
    devAuth: true,
    publicUrl: "https://pepo.test",
    adminToken: "admin",
    dataDir: dir,
    corsOrigins: [],
    safety: { now: () => now },
  });
  user("rider", "passenger");
  user("driver", "driver");
  user("outsider", "passenger");
});
afterEach(() => {
  db.db.close();
  rmSync(dir, { recursive: true, force: true });
});
describe("Pepo night policy and departure", () => {
  it("uses city timezones at the exact day/night/late boundaries", () => {
    expect(
      nightPolicy("lubumbashi", Date.parse("2026-10-07T16:00Z")).tier,
    ).toBe("night");
    expect(nightPolicy("kinshasa", Date.parse("2026-10-07T16:00Z")).tier).toBe(
      "day",
    );
    expect(nightPolicy("kolwezi", now).tier).toBe("late");
    expect(
      nightPolicy("lubumbashi", Date.parse("2026-10-08T03:00Z")).tier,
    ).toBe("night");
    expect(
      nightPolicy("lubumbashi", Date.parse("2026-10-08T04:00Z")).tier,
    ).toBe("day");
  });
  it("rejects unauthorized night offers, then requires accurate and recent GPS", async () => {
    trip();
    const offer = () =>
      request(service.app)
        .post("/api/trips/ride/offers")
        .set(auth("driver"))
        .send({ price: 5000, eta: 3 });
    expect((await offer()).body.code).toBe("NIGHT_REVIEW_REQUIRED");
    await approve();
    expect((await offer()).body.code).toBe("SAFETY_GPS_REQUIRED");
    await request(service.app)
      .post("/api/me/safety/location")
      .set(auth("driver"))
      .send(fix(PLACES[0], 200))
      .expect(204);
    expect((await offer()).status).toBe(409);
    now += 1000;
    await request(service.app)
      .post("/api/me/safety/location")
      .set(auth("driver"))
      .send(fix())
      .expect(204);
    const o = await offer();
    expect(o.status).toBe(200);
    expect(o.body.offers).toHaveLength(1);
    now += SAFETY.fixMaxAgeMs + 1;
    expect((await offer()).body.code).toBe("SAFETY_GPS_REQUIRED");
  });
  it("rechecks approval at assignment, invalidates changed documents and expiry", async () => {
    trip();
    await approve();
    await request(service.app)
      .post("/api/me/safety/location")
      .set(auth("driver"))
      .send(fix())
      .expect(204);
    const o = (
      await request(service.app)
        .post("/api/trips/ride/offers")
        .set(auth("driver"))
        .send({ price: 5000, eta: 3 })
        .expect(200)
    ).body.offers[0];
    const p = db.user("driver", "driver")!;
    p.driver!.plate = "NEW PLATE";
    db.saveUser(p);
    await request(service.app)
      .post("/api/trips/ride/accept")
      .set(auth("rider"))
      .send({ offerId: o.id })
      .expect(403);
    await approve();
    await request(service.app)
      .post("/api/trips/ride/accept")
      .set(auth("rider"))
      .send({ offerId: o.id })
      .expect(200);
    db.db.prepare("UPDATE safety_driver_approval SET expiresAt=?").run(now);
    expect(
      createSafety(db, {
        devAuth: true,
        publicUrl: "",
        adminToken: "",
        dataDir: dir,
        corsOrigins: [],
        safety: { now: () => now },
      }).approvalValid(p),
    ).toBe(false);
  });
  it("requires proximity and freshness at night while retaining server PIN protection", async () => {
    trip("accepted");
    await approve();
    await location(PLACES[2]);
    const status = (s: string, pin?: string) =>
      request(service.app)
        .post("/api/trips/ride/status")
        .set(auth("driver"))
        .send({ status: s, pin });
    expect((await status("arrived")).body.code).toBe("SAFETY_PICKUP_DISTANCE");
    now += 1000;
    await location();
    await status("arrived").expect(200);
    await status("in_progress", "0000").expect(400);
    now += 46000;
    expect((await status("in_progress", "1234")).body.code).toBe(
      "SAFETY_GPS_REQUIRED",
    );
    await location();
    await status("in_progress", "1234").expect(200);
    const driverTrips = (
      await request(service.app).get("/api/trips").set(auth("driver"))
    ).body;
    expect(driverTrips[0].pickupPin).toBeUndefined();
    expect(JSON.stringify(await safetyState())).not.toContain("1234");
  });
  it("does not impose night approval during the day", async () => {
    now = Date.parse("2026-10-07T10:00Z");
    trip();
    await request(service.app)
      .post("/api/trips/ride/offers")
      .set(auth("driver"))
      .send({ price: 5000, eta: 3 })
      .expect(200);
  });
});
describe("Monitoring and private assistance", () => {
  it("detects sustained off-route movement, ignores a single bad fix and estimated geometry", async () => {
    const t = trip("in_progress");
    await location();
    const remote = { ...PLACES[0], longitude: PLACES[0].longitude + 0.01 };
    // A teleport is ignored as evidence; continuous observations are required afterwards.
    for (let i = 0; i < 8; i++) {
      now += 20000;
      await location(remote);
    }
    const state = await safetyState();
    expect(state.check.reason).toBe("deviation");
    expect(
      distanceFromRouteM(remote, { ...t.route, source: "estimate" }),
    ).toBeNull();
    expect(distanceFromRouteM(remote, { ...t.route, points: [] })).toBeNull();
  });
  it("detects a sustained stop away from a scheduled stop and keeps responses private", async () => {
    const t = trip("in_progress");
    await location();
    for (let i = 0; i < 17; i++) {
      now += 20000;
      await location();
    }
    const rider = await safetyState(),
      driver = await safetyState("driver");
    expect(rider.check.reason).toBe("stop");
    expect(driver.check.id).not.toBe(rider.check.id);
    await request(service.app)
      .post(`/api/trips/ride/safety/check/${driver.check.id}`)
      .set(auth("rider"))
      .send({ answer: "ok" })
      .expect(404);
    await request(service.app)
      .post(`/api/trips/ride/safety/check/${rider.check.id}`)
      .set(auth("rider"))
      .send({ answer: "ok" })
      .expect(204);
    expect((await safetyState()).check).toBeUndefined();
    expect((await safetyState("driver")).check).toBeDefined();
    t.stops = [PLACES[0]];
    db.saveTrip({ ...db.trip("ride")!, stops: t.stops });
    const count = db.db
      .prepare("SELECT COUNT(*) AS n FROM safety_checks")
      .get() as { n: number };
    now += SAFETY.checkCooldownMs;
    await location();
    expect(
      (
        db.db.prepare("SELECT COUNT(*) AS n FROM safety_checks").get() as {
          n: number;
        }
      ).n,
    ).toBe(count.n);
  });
  it("flags lost GPS honestly without converting loss of connectivity alone into an emergency", async () => {
    trip("accepted");
    await location();
    now += SAFETY.staleMs + 1000;
    service.safetyTick();
    const s = await safetyState();
    expect(s.locationQuality).toBe("stale");
    expect(s.check.reason).toBe("gps_unavailable");
    now += SAFETY.checkGraceMs + 1000;
    service.safetyTick();
    expect(
      (
        await request(service.app)
          .get("/api/admin/safety/queue")
          .set(auth("admin"))
      ).body,
    ).toHaveLength(0);
  });
  it("creates independent idempotent help tickets, with honest queued/acknowledged states", async () => {
    trip("accepted");
    const send = (token = "rider") =>
      request(service.app).post("/api/trips/ride/safety/help").set(auth(token));
    await send("outsider").expect(403);
    const replies = await Promise.all([send(), send()]);
    expect(replies[0].body.id).toBe(replies[1].body.id);
    expect(replies[0].body.status).toBe("queued");
    expect((await safetyState("driver")).help).toBeUndefined();
    const ticket = replies[0].body.id;
    await request(service.app)
      .get("/api/admin/safety/queue")
      .set(auth("rider"))
      .expect(403);
    await request(service.app)
      .post(`/api/admin/safety/queue/${ticket}`)
      .set(auth("admin"))
      .send({ action: "resolve" })
      .expect(409);
    await request(service.app)
      .post(`/api/admin/safety/queue/${ticket}`)
      .set(auth("admin"))
      .send({ action: "acknowledge" })
      .expect(204);
    expect((await safetyState()).help.status).toBe("acknowledged");
    expect((await safetyState("driver")).help).toBeUndefined();
    await request(service.app)
      .post(`/api/admin/safety/queue/${ticket}`)
      .set(auth("admin"))
      .send({ action: "resolve" })
      .expect(204);
    expect((await safetyState()).help.status).toBe("resolved");
  });
  it("escalates sustained-stop checks without response, retains open help after completion", async () => {
    trip("in_progress");
    await location();
    for (let i = 0; i < 17; i++) {
      now += 20000;
      await location();
    }
    now += SAFETY.checkGraceMs + 1;
    service.safetyTick();
    service.safetyTick();
    const queue = (
      await request(service.app)
        .get("/api/admin/safety/queue")
        .set(auth("admin"))
    ).body;
    expect(queue).toHaveLength(2);
    expect(queue[0].source).toBe("check_unanswered");
    // A reason is context for the reviewer and never disables observation.
    await request(service.app)
      .post("/api/trips/ride/safety/stop")
      .set(auth("driver"))
      .send({ reason: "checkpoint" })
      .expect(204);
    await request(service.app)
      .post("/api/trips/ride/status")
      .set(auth("driver"))
      .send({ status: "completed" })
      .expect(200);
    service.safetyTick();
    expect(
      (
        await request(service.app)
          .get("/api/admin/safety/queue")
          .set(auth("admin"))
      ).body,
    ).toHaveLength(2);
    expect(
      db.db.prepare("SELECT * FROM safety_observation").all(),
    ).toHaveLength(0);
  });
  it("rejects out-of-order/future fixes and never freshens GPS on a chat/status update", async () => {
    trip("accepted");
    await location();
    const at = now;
    now += 1000;
    await request(service.app)
      .post("/api/trips/ride/location")
      .set(auth("driver"))
      .send({ ...fix(), capturedAt: now + 60000 })
      .expect(400);
    await request(service.app)
      .post("/api/trips/ride/location")
      .set(auth("driver"))
      .send({ ...fix(), capturedAt: at })
      .expect(200);
    await request(service.app)
      .post("/api/trips/ride/messages")
      .set(auth("rider"))
      .send({ text: "Hello" })
      .expect(201);
    expect((await safetyState()).lastLocationAt).toBe(at);
  });
  it("revokes only the sharing links created by that participant", async () => {
    trip("accepted");
    const r = (
      await request(service.app)
        .post("/api/trips/ride/share")
        .set(auth("rider"))
        .expect(200)
    ).body.url;
    const d = (
      await request(service.app)
        .post("/api/trips/ride/share")
        .set(auth("driver"))
        .expect(200)
    ).body.url;
    await request(service.app)
      .delete("/api/trips/ride/share")
      .set(auth("outsider"))
      .expect(403);
    await request(service.app)
      .delete("/api/trips/ride/share")
      .set(auth("rider"))
      .expect(204);
    await request(service.app).get(new URL(r).pathname).expect(404);
    await request(service.app).get(new URL(d).pathname).expect(200);
  });
  it("retains closed tickets for 30 days and purges expired GPS, without deleting open requests", async () => {
    trip("accepted");
    await location();
    const ticket = (
      await request(service.app)
        .post("/api/trips/ride/safety/help")
        .set(auth("rider"))
    ).body.id;
    await request(service.app)
      .post(`/api/admin/safety/queue/${ticket}`)
      .set(auth("admin"))
      .send({ action: "acknowledge" });
    await request(service.app)
      .post(`/api/admin/safety/queue/${ticket}`)
      .set(auth("admin"))
      .send({ action: "resolve" });
    await request(service.app)
      .post("/api/trips/ride/safety/help")
      .set(auth("driver"));
    now += SAFETY.retentionMs + 1;
    service.safetyCleanup();
    expect(db.db.prepare("SELECT * FROM safety_driver_fix").all()).toHaveLength(
      0,
    );
    expect(db.db.prepare("SELECT * FROM safety_help").all()).toHaveLength(1);
  });
  it("keeps stricter checks across midnight and a service restart", async () => {
    const t = trip("accepted");
    await approve();
    await location();
    // Assignment records the server's tier; no client clock can downgrade it.
    const safety = createSafety(db, {
      devAuth: true,
      publicUrl: "",
      adminToken: "",
      dataDir: dir,
      corsOrigins: [],
      safety: { now: () => now },
    });
    safety.assigned(t);
    db.saveTrip(t);
    now = Date.parse("2026-10-08T06:00Z");
    const restarted = createSafety(db, {
      devAuth: true,
      publicUrl: "",
      adminToken: "",
      dataDir: dir,
      corsOrigins: [],
      safety: { now: () => now },
    });
    expect(restarted.policy(db.trip("ride")!).tier).toBe("late");
    expect(() => restarted.requirePickup(db.trip("ride")!)).toThrow();
  });
  it("does not alert from a brief detour or an imprecise GPS sample", async () => {
    trip("in_progress");
    await location();
    now += 20000;
    const remote = { ...PLACES[0], longitude: PLACES[0].longitude + 0.01 };
    await location(remote, 300);
    now += 20000;
    await location();
    expect((await safetyState()).check).toBeUndefined();
  });
  it("refuses safety access from the wrong role of the same account", async () => {
    trip("accepted");
    db.db
      .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
      .run(
        createHash("sha256").update("driver-passenger").digest("hex"),
        "driver",
        Date.now() + 86400000,
        "passenger",
      );
    await request(service.app)
      .get("/api/trips/ride/safety")
      .set(auth("driver-passenger"))
      .expect(403);
    await request(service.app)
      .post("/api/trips/ride/location")
      .set(auth("driver-passenger"))
      .send(fix())
      .expect(403);
    await request(service.app)
      .post("/api/trips/ride/share")
      .set(auth("driver-passenger"))
      .expect(403);
  });
  it("never allows an expired or non-admin session to approve night work", async () => {
    trip();
    await request(service.app)
      .post("/api/admin/safety/drivers/driver")
      .set(auth("driver"))
      .send({ approved: true })
      .expect(403);
    await request(service.app).get("/api/trips/ride/safety").expect(401);
    db.db.prepare("UPDATE sessions SET expiresAt=0 WHERE userId='rider'").run();
    await request(service.app)
      .post("/api/trips/ride/safety/help")
      .set(auth("rider"))
      .expect(401);
  });
  it("has safety copy in all four languages", () => {
    for (const language of ["fr", "en", "sw", "ln"] as const)
      for (const key of [
        "help",
        "night",
        "queued",
        "error",
        "SAFETY_GPS_REQUIRED",
      ] as const)
        expect(safetyText(language, key).length).toBeGreaterThan(5);
  });
});
