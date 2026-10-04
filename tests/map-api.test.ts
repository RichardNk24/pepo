import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase, type Store } from "../apps/api/src/database";
import { createApp } from "../apps/api/src/app";
import { PLACES } from "@pepo/utils/cities";
let dir: string, store: Store, app: ReturnType<typeof createApp>["app"];
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pepo-map-"));
  store = openDatabase(join(dir, "test.sqlite"));
  app = createApp(store, {
    devAuth: true,
    publicUrl: "http://localhost:4000",
    adminToken: "test-admin",
    googleWebKey: "public-display-key",
    dataDir: dir,
    corsOrigins: ["http://localhost:8081"],
  }).app;
});
afterEach(() => {
  store.db.close();
  rmSync(dir, { recursive: true, force: true });
});
describe("Bounded public planning without signing into demo bookings", () => {
  it("returns provider status and preserves exact pin coordinates without authentication", async () => {
    expect(
      (await request(app).get("/api/maps/config").expect(200)).body,
    ).toEqual({ googleMap: true, googleRoutes: false, googlePlaces: false });
    const point = {
      latitude: -11.66421,
      longitude: 27.48341,
      city: "lubumbashi",
    };
    const result = await request(app)
      .post("/api/maps/reverse")
      .send(point)
      .expect(200);
    expect(result.body).toMatchObject(point);
    await request(app).get("/api/trips").expect(401);
  });
  it("rejects invalid, remote, cross-city and indistinguishable endpoints", async () => {
    await request(app)
      .post("/api/maps/reverse")
      .send({ latitude: 91, longitude: 27, city: "lubumbashi" })
      .expect(400);
    await request(app)
      .post("/api/maps/reverse")
      .send({ latitude: 48, longitude: 2, city: "lubumbashi" })
      .expect(400);
    await request(app)
      .post("/api/maps/routes")
      .send({
        pickup: PLACES[0],
        destination: { ...PLACES[2], city: "kinshasa" },
      })
      .expect(400);
    await request(app)
      .post("/api/maps/routes")
      .send({ pickup: PLACES[0], destination: PLACES[0] })
      .expect(400);
    expect(
      (
        await request(app)
          .post("/api/maps/routes")
          .send({ pickup: PLACES[0], destination: PLACES[2] })
          .expect(200)
      ).body.source,
    ).toBe("estimate");
  });
  it("routes through stops and rejects too many or out-of-city stops", async () => {
    const payload = {
      pickup: PLACES[0],
      destination: PLACES[2],
      stops: [PLACES[1]],
    };
    const result = await request(app)
      .post("/api/maps/routes")
      .send(payload)
      .expect(200);
    expect(result.body.points).toContainEqual(
      expect.objectContaining({
        latitude: PLACES[1].latitude,
        longitude: PLACES[1].longitude,
      }),
    );
    await request(app)
      .post("/api/maps/routes")
      .send({ ...payload, stops: Array(4).fill(PLACES[1]) })
      .expect(400);
    await request(app)
      .post("/api/maps/routes")
      .send({ ...payload, stops: [{ ...PLACES[1], city: "kinshasa" }] })
      .expect(400);
    await request(app)
      .post("/api/maps/routes")
      .send({ ...payload, stops: [{ ...PLACES[1], latitude: 48 }] })
      .expect(400);
  });
  it("serves a Google renderer with a scoped CSP and only a display key", async () => {
    const result = await request(app).get("/maps/mobile").expect(200);
    expect(result.text).toContain("public-display-key");
    expect(result.text).not.toContain("test-admin");
    expect(result.headers["content-security-policy"]).toContain(
      "https://*.googleapis.com",
    );
    expect(result.headers["content-security-policy"]).toContain(
      "frame-ancestors 'self' http://localhost:8081",
    );
    expect(result.headers["cache-control"]).toBe("no-store");
    expect(result.headers["x-frame-options"]).toBeUndefined();
  });
});
