import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../apps/api/src/app";
import { openDatabase, type Store } from "../apps/api/src/database";
import { PLACES } from "@pepo/utils/cities";

let store: Store;
let app: ReturnType<typeof createApp>["app"];
let dir: string;
let nextPhone = 20;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function passenger(name: string) {
  const phone = `+2438${String(nextPhone++).padStart(8, "0")}`;
  const code = (await request(app).post("/api/auth/request").send({ phone }).expect(200)).body.devCode;
  return (await request(app).post("/api/auth/verify").send({ phone, code, name, role: "passenger", city: "lubumbashi" }).expect(200)).body as { token: string };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pepo-live-activity-"));
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

describe("iOS Live Activity token ownership", () => {
  it("stores a rider's token only for their active trip and lets them revoke it", async () => {
    const rider = await passenger("Rider One");
    const other = await passenger("Rider Two");
    const trip = (await request(app)
      .post("/api/trips")
      .set(auth(rider.token))
      .send({ pickup: PLACES[0], destination: PLACES[2], vehicle: "moto", proposedPrice: 5000 })
      .expect(201)).body as { id: string };
    const input = {
      activityId: "activity-identifier-01",
      pushToken: "ab".repeat(32),
      language: "fr",
    };
    await request(app).put(`/api/trips/${trip.id}/live-activity-token`).send(input).expect(401);
    await request(app).put(`/api/trips/${trip.id}/live-activity-token`).set(auth(other.token)).send(input).expect(403);
    await request(app).put(`/api/trips/${trip.id}/live-activity-token`).set(auth(rider.token)).send(input).expect(204);
    const row = store.db.prepare("SELECT riderId,pushToken,language FROM live_activity_tokens WHERE tripId=?").get(trip.id) as { riderId: string; pushToken: string; language: string };
    expect(row).toMatchObject({ pushToken: input.pushToken, language: "fr" });

    await request(app).delete(`/api/trips/${trip.id}/live-activity-token/${input.activityId}`).set(auth(rider.token)).expect(204);
    expect(store.db.prepare("SELECT 1 FROM live_activity_tokens WHERE tripId=?").get(trip.id)).toBeUndefined();
  });

  it("rejects malformed tokens and unsupported language values", async () => {
    const rider = await passenger("Rider Three");
    const trip = (await request(app)
      .post("/api/trips")
      .set(auth(rider.token))
      .send({ pickup: PLACES[0], destination: PLACES[2], vehicle: "moto", proposedPrice: 5000 })
      .expect(201)).body as { id: string };
    await request(app).put(`/api/trips/${trip.id}/live-activity-token`).set(auth(rider.token)).send({
      activityId: "activity-identifier-02", pushToken: "not-a-token", language: "fr",
    }).expect(400);
    await request(app).put(`/api/trips/${trip.id}/live-activity-token`).set(auth(rider.token)).send({
      activityId: "activity-identifier-02", pushToken: "cd".repeat(32), language: "xx",
    }).expect(400);
  });
});
