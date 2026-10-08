import { afterEach, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type Store } from "../apps/api/src/database";
import { createApp } from "../apps/api/src/app";
import { PLACES } from "@pepo/utils/cities";
import type { Profile } from "@pepo/types/model";
let store: Store,
  app: ReturnType<typeof createApp>["app"],
  dir: string,
  n = 0;
const input = {
  pickup: PLACES[0],
  destination: PLACES[2],
  vehicle: "moto",
  proposedPrice: 5000,
};
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4VIAAAAASUVORK5CYII=",
  "base64",
);
const auth = (token: string) => ({ Authorization: "Bearer " + token });
async function user(role: "passenger" | "driver" = "passenger") {
  const phone = "+2438" + String(++n).padStart(8, "0");
  const code = (
    await request(app).post("/api/auth/request").send({ phone }).expect(200)
  ).body.devCode;
  const result = await request(app)
    .post("/api/auth/verify")
    .send({ phone, code, name: role + " Test", role, city: "lubumbashi" })
    .expect(200);
  return result.body as { token: string; profile: Profile };
}
async function driver() {
  const d = await user("driver");
  await request(app)
    .patch("/api/me")
    .set(auth(d.token))
    .send({
      driver: {
        vehicle: "moto",
        model: "Haojue HJ125",
        plate: "LSH TEST 12",
        helmet: true,
      },
    })
    .expect(200);
  for (const kind of ["identity", "license", "vehicle", "selfie"])
    await request(app)
      .post("/api/me/documents/" + kind)
      .set(auth(d.token))
      .attach("document", png, {
        filename: "test.png",
        contentType: "image/png",
      })
      .expect(200);
  await request(app)
    .post(`/api/admin/drivers/${d.profile.id}/review`)
    .set(auth("admin-test"))
    .send({ approved: true })
    .expect(200);
  await request(app)
    .post("/api/me/online")
    .set(auth(d.token))
    .send({ online: true })
    .expect(200);
  return d;
}
async function booking(guest?: { name: string; phone: string }) {
  const rider = await user(),
    d = await driver();
  const trip = (
    await request(app)
      .post("/api/trips")
      .set(auth(rider.token))
      .send({ ...input, ...(guest ? { guest } : {}) })
      .expect(201)
  ).body;
  const offered = (
    await request(app)
      .post(`/api/trips/${trip.id}/offers`)
      .set(auth(d.token))
      .send({ price: 5500, eta: 3 })
      .expect(200)
  ).body;
  return { rider, d, trip, offer: offered.offers[0] };
}
describe("Pepo API with real persistence and authorization", () => {
  it("persists ordered stops for a new pickup truck booking", async () => {
    const rider = await user();
    const stops = [PLACES[1], PLACES[3]];
    const created = await request(app)
      .post("/api/trips")
      .set(auth(rider.token))
      .send({ ...input, vehicle: "pickupTruck", stops })
      .expect(201);
    expect(created.body.stops).toEqual(stops);
    const trips = await request(app)
      .get("/api/trips")
      .set(auth(rider.token))
      .expect(200);
    expect(
      trips.body.find((t: { id: string }) => t.id === created.body.id).stops,
    ).toEqual(stops);
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pepo-test-"));
    store = openDatabase(":memory:");
    app = createApp(store, {
      safety: { enabled: false },
      devAuth: true,
      publicUrl: "https://pepo.test",
      adminToken: "admin-test",
      dataDir: dir,
      corsOrigins: [],
    }).app;
  });
  afterEach(() => {
    store.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  it("stores, reschedules, releases and cancels scheduled rides with ownership checks", async () => {
    const rider = await user(),
      outsider = await user(),
      d = await driver();
    const scheduledAt = Date.now() + 7200000;
    const trip = (
      await request(app)
        .post("/api/trips")
        .set(auth(rider.token))
        .send({ ...input, scheduledAt })
        .expect(201)
    ).body;
    expect(trip.status).toBe("scheduled");
    expect(store.trip(trip.id)?.scheduledAt).toBe(scheduledAt);
    expect(
      (await request(app).get("/api/requests").set(auth(d.token)).expect(200))
        .body,
    ).toHaveLength(0);
    await request(app)
      .post(`/api/trips/${trip.id}/offers`)
      .set(auth(d.token))
      .send({ price: 5000, eta: 3 })
      .expect(409);
    await request(app)
      .patch(`/api/trips/${trip.id}/schedule`)
      .set(auth(outsider.token))
      .send({ scheduledAt: scheduledAt + 3600000 })
      .expect(403);
    await request(app)
      .patch(`/api/trips/${trip.id}/schedule`)
      .set(auth(rider.token))
      .send({ scheduledAt: scheduledAt + 3600000 })
      .expect(200);
    const service = createApp(store, {
      safety: { enabled: false },
      devAuth: true,
      publicUrl: "https://pepo.test",
      adminToken: "admin-test",
      dataDir: dir,
      corsOrigins: [],
    });
    service.dispatchScheduled(scheduledAt + 3600000 - 900000);
    expect(
      (await request(app).get("/api/requests").set(auth(d.token)).expect(200))
        .body[0].id,
    ).toBe(trip.id);
    await request(app)
      .patch(`/api/trips/${trip.id}/schedule`)
      .set(auth(rider.token))
      .send({ scheduledAt: scheduledAt + 7200000 })
      .expect(409);
    await request(app)
      .post(`/api/trips/${trip.id}/status`)
      .set(auth(rider.token))
      .send({ status: "cancelled" })
      .expect(200);
    expect(store.trip(trip.id)?.status).toBe("cancelled");
  });
  it("accepts active vehicle bookings and rejects retired choices, rejects invalid dates and overlapping slots", async () => {
    const rider = await user();
    for (const scheduledAt of [
      Date.now() - 1000,
      Date.now() + 60000,
      Date.now() + 31 * 86400000,
    ])
      await request(app)
        .post("/api/trips")
        .set(auth(rider.token))
        .send({ ...input, scheduledAt })
        .expect(400);
    await request(app)
      .post("/api/trips")
      .set(auth(rider.token))
      .send({
        ...input,
        vehicle: "fourByFour",
        scheduledAt: Date.now() + 7200000,
      })
      .expect(400);
    const scheduledAt = Date.now() + 7200000;
    for (const [i, vehicle] of ["suv", "motoSend", "minibus"].entries()) {
      const result = await request(app)
        .post("/api/trips")
        .set(auth(rider.token))
        .send({ ...input, vehicle, scheduledAt: scheduledAt + i * 7200000 })
        .expect(201);
      expect(result.body.vehicle).toBe(vehicle);
    }
    await request(app)
      .post("/api/trips")
      .set(auth(rider.token))
      .send({ ...input, scheduledAt: scheduledAt + 60000 })
      .expect(409);
    await request(app)
      .patch("/api/me")
      .set(auth(rider.token))
      .send({ city: "kinshasa" })
      .expect(409);
  });
  it("keeps guest contact private until a driver is assigned and keeps booking ownership", async () => {
    const guest = { name: "Passager invité", phone: "+243890000099" };
    const { rider, d, trip, offer } = await booking(guest);
    expect(trip.guest).toEqual(guest);
    expect(trip.riderId).toBe(rider.profile.id);
    const pending = await request(app)
      .get("/api/requests")
      .set(auth(d.token))
      .expect(200);
    expect(JSON.stringify(pending.body)).not.toContain(guest.phone);
    await request(app)
      .post(`/api/trips/${trip.id}/accept`)
      .set(auth(rider.token))
      .send({ offerId: offer.id })
      .expect(200);
    const assigned = await request(app)
      .get("/api/trips")
      .set(auth(d.token))
      .expect(200);
    const result = assigned.body.find((t: any) => t.id === trip.id);
    expect(result.guest.phone).toBe(guest.phone);
    expect(result.riderPhone).toBe(guest.phone);
    expect(result.riderPhoneVerified).toBe(false);
    expect(result.pickupPin).toBeUndefined();
    expect(store.trip(trip.id)?.guest).toEqual(guest);
  });
  it("requires a valid session and accepts only the issued OTP once", async () => {
    await request(app).get("/api/me").expect(401);
    const phone = "+243812345678";
    const code = (await request(app).post("/api/auth/request").send({ phone }))
      .body.devCode;
    const body = {
      phone,
      code,
      name: "Amina Ilunga",
      role: "passenger",
      city: "lubumbashi",
    };
    await request(app)
      .post("/api/auth/verify")
      .send({ ...body, code: "000000" })
      .expect(400);
    const login = await request(app)
      .post("/api/auth/verify")
      .send(body)
      .expect(200);
    expect(login.body.profile.phoneVerified).toBe(false);
    await request(app).post("/api/auth/verify").send(body).expect(400);
    await request(app).get("/api/me").set(auth(login.body.token)).expect(200);
  });
  it("expires an OTP and blocks it after five failures", async () => {
    const phone = "+243812345678";
    const code = (await request(app).post("/api/auth/request").send({ phone }))
      .body.devCode;
    const body = {
      phone,
      code: "000000",
      name: "Amina",
      role: "passenger",
      city: "lubumbashi",
    };
    for (let i = 0; i < 5; i++)
      await request(app).post("/api/auth/verify").send(body).expect(400);
    await request(app)
      .post("/api/auth/verify")
      .send({ ...body, code })
      .expect(400);
    store.db.prepare("UPDATE otp SET attempts=0,expiresAt=0").run();
    await request(app)
      .post("/api/auth/verify")
      .send({ ...body, code })
      .expect(400);
  });
  it("does not let a user self-approve or drive before a complete review", async () => {
    const d = await user("driver");
    await request(app)
      .patch("/api/me")
      .set(auth(d.token))
      .send({ verification: "verified" })
      .expect(400);
    await request(app)
      .post("/api/me/online")
      .set(auth(d.token))
      .send({ online: true })
      .expect(403);
    await request(app)
      .post(`/api/admin/drivers/${d.profile.id}/review`)
      .set(auth(d.token))
      .send({ approved: true })
      .expect(403);
    await request(app)
      .post(`/api/admin/drivers/${d.profile.id}/review`)
      .set(auth("admin-test"))
      .send({ approved: true })
      .expect(400);
  });
  it("never returns a pickup PIN to the driver", async () => {
    const { d, rider, trip, offer } = await booking();
    expect(trip.pickupPin).toMatch(/^\d{4}$/);
    const requests = await request(app)
      .get("/api/requests")
      .set(auth(d.token))
      .expect(200);
    expect(requests.body[0].pickupPin).toBeUndefined();
    await request(app)
      .post(`/api/trips/${trip.id}/accept`)
      .set(auth(rider.token))
      .send({ offerId: offer.id })
      .expect(200);
    const own = await request(app)
      .get("/api/trips")
      .set(auth(d.token))
      .expect(200);
    expect(own.body[0].pickupPin).toBeUndefined();
  });
  it("round-trips a price counteroffer before the rider selects the driver", async () => {
    const { d, rider, trip, offer } = await booking();
    await request(app)
      .post(`/api/trips/${trip.id}/offers/${offer.id}/counter`)
      .set(auth(rider.token))
      .send({ price: 5000 })
      .expect(200);
    await request(app)
      .post(`/api/trips/${trip.id}/accept`)
      .set(auth(rider.token))
      .send({ offerId: offer.id })
      .expect(409);
    await request(app)
      .post(`/api/trips/${trip.id}/offers/${offer.id}/accept-counter`)
      .set(auth(d.token))
      .expect(200);
    const result = await request(app)
      .post(`/api/trips/${trip.id}/accept`)
      .set(auth(rider.token))
      .send({ offerId: offer.id })
      .expect(200);
    expect(result.body.agreedPrice).toBe(5000);
  });
  it("enforces the PIN and completes/rates exactly one course", async () => {
    const { d, rider, trip, offer } = await booking();
    await request(app)
      .post(`/api/trips/${trip.id}/accept`)
      .set(auth(rider.token))
      .send({ offerId: offer.id })
      .expect(200);
    await request(app)
      .post(`/api/trips/${trip.id}/status`)
      .set(auth(rider.token))
      .send({ status: "arrived" })
      .expect(400);
    await request(app)
      .post(`/api/trips/${trip.id}/status`)
      .set(auth(d.token))
      .send({ status: "arrived" })
      .expect(200);
    await request(app)
      .post(`/api/trips/${trip.id}/status`)
      .set(auth(d.token))
      .send({ status: "in_progress", pin: "0000" })
      .expect(400);
    await request(app)
      .post(`/api/trips/${trip.id}/status`)
      .set(auth(d.token))
      .send({ status: "in_progress", pin: trip.pickupPin })
      .expect(200);
    await request(app)
      .post(`/api/trips/${trip.id}/status`)
      .set(auth(d.token))
      .send({ status: "completed" })
      .expect(200);
    await request(app)
      .post(`/api/trips/${trip.id}/rating`)
      .set(auth(rider.token))
      .send({ rating: 5 })
      .expect(200);
    await request(app)
      .post(`/api/trips/${trip.id}/rating`)
      .set(auth(rider.token))
      .send({ rating: 1 })
      .expect(409);
    expect(store.user(d.profile.id)?.rating).toBe(5);
    expect(store.user(d.profile.id)?.trips).toBe(1);
  });
  it("locks departure after five wrong PIN guesses", async () => {
    const { d, rider, trip, offer } = await booking();
    await request(app)
      .post(`/api/trips/${trip.id}/accept`)
      .set(auth(rider.token))
      .send({ offerId: offer.id });
    await request(app)
      .post(`/api/trips/${trip.id}/status`)
      .set(auth(d.token))
      .send({ status: "arrived" });
    for (let i = 0; i < 5; i++)
      await request(app)
        .post(`/api/trips/${trip.id}/status`)
        .set(auth(d.token))
        .send({ status: "in_progress", pin: "0000" })
        .expect(400);
    await request(app)
      .post(`/api/trips/${trip.id}/status`)
      .set(auth(d.token))
      .send({ status: "in_progress", pin: trip.pickupPin })
      .expect(429);
  });
  it("prevents duplicate active bookings and assignment of one driver to two riders", async () => {
    const { d, rider, trip, offer } = await booking();
    await request(app)
      .post("/api/trips")
      .set(auth(rider.token))
      .send(input)
      .expect(409);
    const r2 = await user();
    const t2 = (
      await request(app).post("/api/trips").set(auth(r2.token)).send(input)
    ).body;
    const o2 = (
      await request(app)
        .post(`/api/trips/${t2.id}/offers`)
        .set(auth(d.token))
        .send({ price: 5000, eta: 3 })
    ).body.offers[0];
    const results = await Promise.all([
      request(app)
        .post(`/api/trips/${trip.id}/accept`)
        .set(auth(rider.token))
        .send({ offerId: offer.id }),
      request(app)
        .post(`/api/trips/${t2.id}/accept`)
        .set(auth(r2.token))
        .send({ offerId: o2.id }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(store.activeFor(d.profile.id)).toHaveLength(1);
  });
  it("keeps chat, incidents, cancellation and position private", async () => {
    const { d, rider, trip, offer } = await booking(),
      outsider = await user();
    await request(app)
      .post(`/api/trips/${trip.id}/accept`)
      .set(auth(rider.token))
      .send({ offerId: offer.id });
    await request(app)
      .get(`/api/trips/${trip.id}/messages`)
      .set(auth(outsider.token))
      .expect(403);
    await request(app)
      .post(`/api/trips/${trip.id}/messages`)
      .set(auth(outsider.token))
      .send({ text: "Spy" })
      .expect(403);
    await request(app)
      .post(`/api/trips/${trip.id}/location`)
      .set(auth(outsider.token))
      .send({ latitude: -11.66, longitude: 27.48 })
      .expect(403);
    await request(app)
      .post(`/api/trips/${trip.id}/status`)
      .set(auth(outsider.token))
      .send({ status: "cancelled" })
      .expect(403);
    await request(app)
      .post("/api/incidents")
      .set(auth(outsider.token))
      .send({ tripId: trip.id, category: "Safety", detail: "Not my trip" })
      .expect(403);
    await request(app)
      .post(`/api/trips/${trip.id}/messages`)
      .set(auth(rider.token))
      .send({ text: "Je suis ici." })
      .expect(201);
    expect(
      (
        await request(app)
          .get(`/api/trips/${trip.id}/messages`)
          .set(auth(d.token))
      ).body[0].text,
    ).toBe("Je suis ici.");
  });
  it("expires sharing and exposes neither phone numbers nor PINs publicly", async () => {
    const { d, rider, trip, offer } = await booking();
    await request(app)
      .post(`/api/trips/${trip.id}/accept`)
      .set(auth(rider.token))
      .send({ offerId: offer.id });
    const shared = (
      await request(app)
        .post(`/api/trips/${trip.id}/share`)
        .set(auth(rider.token))
        .expect(200)
    ).body.url;
    const path = new URL(shared).pathname;
    const page = await request(app).get(path).expect(200);
    expect(page.text).not.toContain(trip.pickupPin);
    expect(page.text).not.toContain(rider.profile.phone);
    expect(page.text).not.toContain(d.profile.phone);
    store.db.prepare("UPDATE shares SET expiresAt=0").run();
    await request(app).get(path).expect(404);
  });
  it("serves encrypted documents only to an administrator", async () => {
    const d = await driver();
    await request(app)
      .get(`/api/admin/drivers/${d.profile.id}/documents/identity`)
      .set(auth(d.token))
      .expect(403);
    const doc = await request(app)
      .get(`/api/admin/drivers/${d.profile.id}/documents/identity`)
      .set(auth("admin-test"))
      .expect(200);
    expect(doc.headers["content-type"]).toContain("image/png");
  });
  it("shows the approved face only to riders receiving that driver’s offer", async () => {
    const { d, rider, trip, offer } = await booking(),
      outsider = await user();
    expect(offer.driver.avatarPath).toBe(`/drivers/${d.profile.id}/avatar`);
    await request(app)
      .get(`/api/drivers/${d.profile.id}/avatar`)
      .set(auth(rider.token))
      .expect(200);
    await request(app)
      .get(`/api/drivers/${d.profile.id}/avatar`)
      .set(auth(outsider.token))
      .expect(403);
  });
  it("invalidates a session on logout", async () => {
    const u = await user();
    await request(app).post("/api/logout").set(auth(u.token)).expect(200);
    await request(app).get("/api/me").set(auth(u.token)).expect(401);
  });
});
