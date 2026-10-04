import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../apps/api/src/app";
import { openDatabase, type Store } from "../apps/api/src/database";
let dir: string,
  store: Store,
  app: ReturnType<typeof createApp>["app"],
  token: string;
const options = () => ({
  devAuth: true,
  publicUrl: "http://localhost:4000",
  adminToken: "admin-test",
  dataDir: dir,
  corsOrigins: [],
});
const payload = {
  query: "hotel calme",
  city: "lubumbashi",
  language: "fr",
  allowAi: true,
};
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "pepo-ai-"));
  const file = join(dir, "catalog.json");
  writeFileSync(
    file,
    JSON.stringify([
      {
        id: "hotel",
        name: "Hôtel du Lac",
        city: "lubumbashi",
        address: "Fixture",
        latitude: -11.664,
        longitude: 27.48,
      },
    ]),
  );
  vi.stubEnv("PEPO_LANDMARKS_FILE", file);
  vi.stubEnv("PEPO_AI_PLACES_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "fake-test-key");
  vi.stubEnv("PEPO_AI_DAILY_CALL_LIMIT", "1");
  store = openDatabase(join(dir, "test.sqlite"));
  app = createApp(store, options()).app;
  const phone = "+243812345678";
  const code = (await request(app).post("/api/auth/request").send({ phone }))
    .body.devCode;
  token = (
    await request(app).post("/api/auth/verify").send({
      phone,
      code,
      name: "Test",
      role: "passenger",
      city: "lubumbashi",
    })
  ).body.token;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  store.db.close();
  rmSync(dir, { recursive: true, force: true });
});
describe("Authenticated low-cost place resolver", () => {
  it("requires a session and validates input before invoking providers", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    app = createApp(store, options()).app;
    await request(app).post("/api/places/resolve").send(payload).expect(401);
    await request(app)
      .post("/api/places/resolve")
      .set("Authorization", "Bearer " + token)
      .send({ ...payload, query: "x" })
      .expect(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("persists the shared daily cap across API recreation and does not charge cached calls", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "completed",
            output: [
              {
                type: "message",
                content: [{ type: "output_text", text: '{"ids":["hotel"]}' }],
              },
            ],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    app = createApp(store, options()).app;
    const send = (target: typeof app, query: string) =>
      request(target)
        .post("/api/places/resolve")
        .set("Authorization", "Bearer " + token)
        .send({ ...payload, query })
        .expect(200);
    expect((await send(app, "hotel calme")).body.source).toBe("openai");
    expect((await send(app, "hotel calme")).body.source).toBe("cache");
    const restarted = createApp(store, options()).app;
    expect((await send(restarted, "hotel proche")).body.source).toBe(
      "fallback",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("keeps AI disabled unless the user explicitly requests it", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    app = createApp(store, options()).app;
    const res = await request(app)
      .post("/api/places/resolve")
      .set("Authorization", "Bearer " + token)
      .send({ ...payload, allowAi: false })
      .expect(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
