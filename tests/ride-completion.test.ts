import { afterEach, beforeEach, describe, it, expect } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type Store } from "../apps/api/src/database";
import { createApp } from "../apps/api/src/app";
import { PLACES } from "@pepo/utils/cities";
import type { Profile } from "@pepo/types/model";
import { installTripOutbox } from "../apps/api/src/trips/persistence/trip-outbox";
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

describe("Complete ride and cash receipt", () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pepo-full-ride-"));
    store = openDatabase(":memory:");
    installTripOutbox(store);
    app = createApp(store, {
      safety: { now: () => Date.UTC(2026, 9, 20, 10) },
      devAuth: true, publicUrl: "https://pepo.test", adminToken: "admin-test",
      dataDir: dir, corsOrigins: [],
    }).app;
  });
  afterEach(() => { store.db.close(); rmSync(dir, {recursive:true,force:true}); });

  async function accepted() {
    const b=await booking();
    const accept=()=>request(app).post(`/api/trips/${b.trip.id}/accept`).set(auth(b.rider.token)).send({offerId:b.offer.id});
    await accept().expect(200);await accept().expect(200);
    return b;
  }
  async function completed() {
    const b=await accepted();
    const status=(next:string,pin?:string)=>request(app).post(`/api/trips/${b.trip.id}/status`).set(auth(b.d.token)).send({status:next,pin});
    await status("arrived").expect(200);await status("arrived").expect(200);
    const pin=store.trip(b.trip.id)!.pickupPin!;
    await status("in_progress",pin==="0000"?"1111":"0000").expect(400);
    await status("in_progress",pin).expect(200);await status("in_progress",pin).expect(200);
    await status("completed").expect(200);await status("completed").expect(200);
    return b;
  }
  it("completes the HTTP flow once, keeps PIN private and records cash separately", async()=>{
    const b=await completed();
    expect(store.user(b.d.profile.id,"driver")!.trips).toBe(1);
    expect(store.user(b.rider.profile.id,"passenger")!.trips).toBe(1);
    const t=store.trip(b.trip.id)!;expect(t.arrivedAt).toBeTypeOf("number");expect(t.startedAt).toBeTypeOf("number");expect(t.completedAt).toBeTypeOf("number");expect(t.cashCollectedAt).toBeUndefined();
    const receipt=await request(app).get(`/api/trips/${t.id}/receipt`).set(auth(b.d.token)).expect(200);
    expect(receipt.body.pickupPin).toBeUndefined();expect(receipt.body.agreedPrice).toBe(5500);
    const collect=()=>request(app).post(`/api/trips/${t.id}/cash-collected`).set(auth(b.d.token)).send({});
    const first=await collect().expect(200), again=await collect().expect(200);
    expect(again.body.cashCollectedAt).toBe(first.body.cashCollectedAt);
    const riderReceipt=await request(app).get(`/api/trips/${t.id}/receipt`).set(auth(b.rider.token)).expect(200);
    expect(riderReceipt.body.cashCollectedAt).toBe(first.body.cashCollectedAt);
    await request(app).post(`/api/trips/${t.id}/rating`).set(auth(b.rider.token)).send({rating:5}).expect(200);
    const earnings=await request(app).get('/api/earnings/summary').set(auth(b.d.token)).expect(200);
    expect(earnings.body.completedTrips).toBe(1);expect(earnings.body.grossAmount).toBe(5500);
    expect(Number(store.db.prepare("SELECT COUNT(*) AS n FROM trip_replication_queue").get()!.n)).toBeGreaterThan(5);
  });
  it("prevents a passenger or outsider declaring receipt of cash",async()=>{
    const b=await completed(), outsider=await user();
    for (const u of [b.rider,outsider]) await request(app).post(`/api/trips/${b.trip.id}/cash-collected`).set(auth(u.token)).send({}).expect(403);
    await request(app).get(`/api/trips/${b.trip.id}/receipt`).set(auth(outsider.token)).expect(403);
  });
  it("does not allow receipt or cash collection before completion",async()=>{
    const b=await accepted();
    await request(app).get(`/api/trips/${b.trip.id}/receipt`).set(auth(b.rider.token)).expect(409);
    await request(app).post(`/api/trips/${b.trip.id}/cash-collected`).set(auth(b.d.token)).send({}).expect(409);
  });
  it("does not let rider replay driver transitions or finish early",async()=>{
    const b=await accepted();
    await request(app).post(`/api/trips/${b.trip.id}/status`).set(auth(b.d.token)).send({status:"completed"}).expect(400);
    await request(app).post(`/api/trips/${b.trip.id}/status`).set(auth(b.d.token)).send({status:"arrived"}).expect(200);
    await request(app).post(`/api/trips/${b.trip.id}/status`).set(auth(b.rider.token)).send({status:"arrived"}).expect(403);
  });
  it("rechecks vehicle type when accepting an old offer",async()=>{
    const b=await booking();const d=store.user(b.d.profile.id,"driver")!;
    d.driver!.vehicle="taxi";store.saveUser(d);
    await request(app).post(`/api/trips/${b.trip.id}/accept`).set(auth(b.rider.token)).send({offerId:b.offer.id}).expect(409);
    expect(store.trip(b.trip.id)!.status).toBe("searching");
  });
  it("retries cancellation safely and never creates completed earnings",async()=>{
    const b=await accepted();
    for(let i=0;i<2;i++) await request(app).post(`/api/trips/${b.trip.id}/status`).set(auth(b.rider.token)).send({status:"cancelled"}).expect(200);
    expect(store.trip(b.trip.id)!.cancelledAt).toBeTypeOf("number");
    await request(app).post(`/api/trips/${b.trip.id}/cash-collected`).set(auth(b.d.token)).send({}).expect(409);
    expect(store.user(b.d.profile.id,"driver")!.trips).toBe(0);
  });
});
