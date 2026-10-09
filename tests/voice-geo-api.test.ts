import { beforeEach, afterEach, it, expect, vi } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { openDatabase } from "../apps/api/src/database";
import { createApp } from "../apps/api/src/app";
import { PLACES } from "@pepo/utils/cities";
import type { Profile, Trip } from "@pepo/types/model";
import { navigationFixture } from "@pepo/voice/fixtures";
let dir: string,
  store: ReturnType<typeof openDatabase>,
  app: ReturnType<typeof createApp>["app"];
function user(id: string, role: Profile["role"]) {
  const p: Profile = {
    id,
    name: "Fixture",
    phone: (
      {
        rider: "+243812345678",
        driver: "+243812345679",
        stranger: "+243812345680",
      } as Record<string, string>
    )[id],
    role,
    city: "lubumbashi",
    verification: "verified",
    rating: 5,
    trips: 0,
    online: true,
  };
  store.saveUser(p);
  store.db
    .prepare("INSERT INTO sessions VALUES(?,?,?,?)")
    .run(
      createHash("sha256").update(id).digest("hex"),
      id,
      Date.now() + 3600000,
      role,
    );
}
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pepo-voicegeo-"));
  store = openDatabase(join(dir, "db.sqlite"));
  app = createApp(store, {
    devAuth: true,
    publicUrl: "http://localhost:4000",
    adminToken: "fixture-admin",
    dataDir: dir,
    corsOrigins: [],
    googleKey: "fixture",
  }).app;
  user("rider", "passenger");
  user("driver", "driver");
  user("stranger", "driver");
});
afterEach(() => {
  store.db.close();
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const input = () => ({
  latitude: PLACES[0].latitude,
  longitude: PLACES[0].longitude,
  city: "lubumbashi",
  name: "Fixture station",
  kind: "fuel",
  source: "Fixture field form",
  aliases: [],
});
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
it("keeps contributed landmarks pending, private admin review, and excludes guessed/unreviewed data from navigation", async () => {
  await request(app).get("/api/voice/landmarks?city=lubumbashi").expect(401);
  const add = await request(app)
    .post("/api/voice/landmarks/contributions")
    .set(auth("rider"))
    .send(input())
    .expect(201);
  expect(add.body.status).toBe("pending");
  expect(
    (
      await request(app)
        .get("/api/voice/landmarks?city=lubumbashi")
        .set(auth("rider"))
    ).body,
  ).toEqual([]);
  await request(app)
    .get("/api/admin/voice-landmarks")
    .set(auth("rider"))
    .expect(403);
  await request(app)
    .post(`/api/admin/voice-landmarks/${add.body.id}/review`)
    .set(auth("fixture-admin"))
    .send({ approve: true, fieldChecked: false })
    .expect(400);
  await request(app)
    .post(`/api/admin/voice-landmarks/${add.body.id}/review`)
    .set(auth("fixture-admin"))
    .send({
      approve: true,
      fieldChecked: true,
      visibility: { day: true, night: false, bearing: 0, tolerance: 15 },
    })
    .expect(200);
  const landmarks = (
    await request(app)
      .get("/api/voice/landmarks?city=lubumbashi")
      .set(auth("driver"))
  ).body;
  expect(landmarks).toHaveLength(1);
  expect(landmarks[0]).toMatchObject({
    reliability: "verified",
    name: "Fixture station",
  });
});
it("refuses client self-validation, off-city points and individually approved parcel counting", async () => {
  await request(app)
    .post("/api/voice/landmarks/contributions")
    .set(auth("rider"))
    .send({ ...input(), reliability: "verified" })
    .expect(400);
  await request(app)
    .post("/api/voice/landmarks/contributions")
    .set(auth("rider"))
    .send({ ...input(), city: "kinshasa" })
    .expect(400);
  const added = await request(app)
    .post("/api/voice/landmarks/contributions")
    .set(auth("rider"))
    .send({ ...input(), kind: "parcel" })
    .expect(201);
  await request(app)
    .post(`/api/admin/voice-landmarks/${added.body.id}/review`)
    .set(auth("fixture-admin"))
    .send({
      approve: true,
      fieldChecked: true,
      visibility: { day: true, night: true, bearing: 0, tolerance: 10 },
    })
    .expect(400);
});
function saveTrip(steps = true) {
  const f = navigationFixture("A", Date.now());
  const t: Trip = {
    id: "fixture-trip",
    riderId: "rider",
    riderName: "Fixture rider",
    riderVerification: "verified",
    driverId: "driver",
    pickup: PLACES[0],
    destination: PLACES[1],
    vehicle: "taxi",
    status: "in_progress",
    proposedPrice: 5000,
    offers: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payment: "cash",
    route: {
      points: f.plan.points,
      source: "google",
      distanceKm: 1,
      durationMin: 3,
      navigationSteps: steps ? f.plan.steps.slice(0, 2) : undefined,
      navigationVersion: "fixture",
    },
  };
  store.saveTrip(t);
  return t;
}
const fix = () => ({
  latitude: PLACES[0].latitude,
  longitude: PLACES[0].longitude,
  accuracy: 5,
  timestamp: Date.now(),
});
it("restricts live navigation to the assigned driver and an active trip, with no provider call for an existing route", async () => {
  saveTrip();
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await request(app)
    .post("/api/trips/fixture-trip/voice-navigation")
    .set(auth("rider"))
    .send(fix())
    .expect(403);
  await request(app)
    .post("/api/trips/fixture-trip/voice-navigation")
    .set(auth("stranger"))
    .send(fix())
    .expect(403);
  const result = await request(app)
    .post("/api/trips/fixture-trip/voice-navigation")
    .set(auth("driver"))
    .send(fix())
    .expect(200);
  expect(result.body.plan.source).toBe("google");
  expect(fetcher).not.toHaveBeenCalled();
});
it("refuses poor/stale GPS and old routes without steps rather than inventing directions", async () => {
  saveTrip(false);
  await request(app)
    .post("/api/trips/fixture-trip/voice-navigation")
    .set(auth("driver"))
    .send({ ...fix(), accuracy: 100 })
    .expect(400);
  await request(app)
    .post("/api/trips/fixture-trip/voice-navigation")
    .set(auth("driver"))
    .send({ ...fix(), timestamp: Date.now() - 30000 })
    .expect(400);
  await request(app)
    .post("/api/trips/fixture-trip/voice-navigation")
    .set(auth("driver"))
    .send(fix())
    .expect(409);
});
it("advertises experimental/planned language state without pretending a measured voice quality", async () => {
  const c = await request(app)
    .get("/api/voice/capabilities")
    .set(auth("rider"))
    .expect(200);
  expect(c.body.streaming).toBe(false);
  expect(
    c.body.profiles.find((p: { id: string }) => p.id === "lua-CD"),
  ).toMatchObject({
    navigation: "planned",
    qualityMeasured: false,
    transcriptionEnabled: false,
  });
});
