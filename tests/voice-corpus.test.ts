import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../apps/api/src/app";
import { openDatabase, type Store } from "../apps/api/src/database";
import { acquireVoiceSlot } from "../apps/api/src/voice/budget";
let dir: string,
  store: Store,
  app: ReturnType<typeof createApp>["app"],
  token: string,
  other: string;
function wav() {
  const b = Buffer.alloc(32044);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(b.length - 44, 40);
  return b;
}
const auth = () => ({ Authorization: "Bearer " + token });
async function login(phone: string) {
  const code = (await request(app).post("/api/auth/request").send({ phone }))
    .body.devCode;
  return (
    await request(app).post("/api/auth/verify").send({
      phone,
      code,
      name: "Test",
      role: "passenger",
      city: "lubumbashi",
    })
  ).body.token;
}
function record(audio = wav(), consent = "true", city = "likasi") {
  return request(app)
    .post("/api/voice/corpus")
    .set(auth())
    .field("city", city)
    .field("kind", "destination")
    .field("profile", "sw-CD-katanga")
    .field("prompt", "Dis ta destination")
    .field("consent", consent)
    .attach("audio", audio, "sample.wav");
}
async function reviewed() {
  const v = (await record().expect(201)).body.sample;
  return (
    await request(app)
      .patch("/api/voice/corpus/" + v.id)
      .set(auth())
      .send({
        expectedText: "Nataka kwenda Madini",
        reviewed: true,
        revision: v.revision,
      })
      .expect(200)
  ).body;
}
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "pepo-corpus-"));
  vi.stubEnv("PEPO_VOICE_CORPUS_ENABLED", "true");
  vi.stubEnv("PEPO_VOICE_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "fixture-key");
  vi.stubEnv("PEPO_VOICE_DAILY_CALL_LIMIT", "2");
  store = openDatabase(join(dir, "db.sqlite"));
  app = createApp(store, {
    devAuth: true,
    publicUrl: "http://localhost:4000",
    adminToken: "fixture",
    dataDir: dir,
    corsOrigins: [],
  }).app;
  token = await login("+243812345678");
  other = await login("+243812345679");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  store.db.close();
  rmSync(dir, { recursive: true, force: true });
});
describe("private Katanga corpus", () => {
  it("requires a server opt-in, authentication, consent and real bounded audio", async () => {
    await request(app).get("/api/voice/corpus").expect(401);
    await record(wav(), "false").expect(400);
    await record(Buffer.from("not audio")).expect(400);
    await record(Buffer.alloc(1024 * 1024 + 1)).expect(400);
    await record(wav(), "true", "unknown").expect(400);
    vi.stubEnv("PEPO_VOICE_CORPUS_ENABLED", "false");
    await request(app).get("/api/voice/corpus/status").set(auth()).expect(503);
    expect(readdirSync(join(dir, "voice-corpus"))).toHaveLength(0);
  });
  it("collects without a provider key, encrypts audio and permits only the owner to replay", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv("OPENAI_API_KEY", "");
    const v = (await record().expect(201)).body.sample;
    expect(v.reviewed).toBe(false);
    expect(
      readFileSync(join(dir, "voice-corpus", v.id + ".enc")).includes(
        Buffer.from("RIFF"),
      ),
    ).toBe(false);
    const replay = await request(app)
      .get(`/api/voice/corpus/${v.id}/audio`)
      .set(auth())
      .expect(200);
    expect(replay.headers["cache-control"]).toBe("no-store");
    expect(replay.body).toEqual(wav());
    await request(app)
      .get(`/api/voice/corpus/${v.id}/audio`)
      .set("Authorization", "Bearer " + other)
      .expect(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("isolates lists and mutation from other accounts", async () => {
    const v = (await record().expect(201)).body.sample;
    expect(
      (
        await request(app)
          .get("/api/voice/corpus")
          .set("Authorization", "Bearer " + other)
      ).body.samples,
    ).toEqual([]);
    await request(app)
      .patch(`/api/voice/corpus/${v.id}`)
      .set("Authorization", "Bearer " + other)
      .send({ expectedText: "test", reviewed: true, revision: 1 })
      .expect(404);
    await request(app)
      .delete(`/api/voice/corpus/${v.id}`)
      .set("Authorization", "Bearer " + other)
      .expect(404);
  });
  it("requires human review, keeps reference out of provider prompt and measures the actual result", async () => {
    const v = (await record().expect(201)).body.sample;
    await request(app)
      .post(`/api/voice/corpus/${v.id}/test`)
      .set(auth())
      .expect(400);
    await request(app)
      .patch(`/api/voice/corpus/${v.id}`)
      .set(auth())
      .send({
        expectedText: "Nataka kwenda Madini",
        reviewed: true,
        revision: 1,
      })
      .expect(200);
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ text: "Nataka kwenda Madini" })),
    );
    vi.stubGlobal("fetch", fetcher);
    const tested = await request(app)
      .post(`/api/voice/corpus/${v.id}/test`)
      .set(auth())
      .expect(200);
    expect(tested.body.test.transcript).toBe("Nataka kwenda Madini");
    const body = fetcher.mock.calls[0][1].body as FormData;
    expect(body.get("prompt")).not.toContain("Madini");
    expect(body.get("prompt")).not.toContain(token);
    const stats = (
      await request(app).get("/api/voice/corpus/metrics").set(auth())
    ).body;
    expect(stats.tested).toBe(1);
    expect(stats.metrics[0].wer).toBe(0);
    expect(stats.generalPopulationValidated).toBe(false);
  });
  it("shares the persisted daily budget with normal destination transcription", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ text: "Madini" }))),
    );
    const v = await reviewed();
    await request(app)
      .post(`/api/voice/corpus/${v.id}/test`)
      .set(auth())
      .expect(200);
    await request(app)
      .post("/api/voice/transcribe")
      .set(auth())
      .field("city", "lubumbashi")
      .field("language", "sw")
      .attach("audio", wav(), "sample.wav")
      .expect(200);
    await request(app)
      .post(`/api/voice/corpus/${v.id}/test`)
      .set(auth())
      .expect(429);
    expect(store.db.prepare("SELECT calls FROM voice_ai_budget").get()).toEqual(
      { calls: 2 },
    );
  });
  it("shares concurrency slots and releases them exactly once", () => {
    const a = acquireVoiceSlot(store),
      b = acquireVoiceSlot(store);
    expect(() => acquireVoiceSlot(store)).toThrow();
    a();
    a();
    const c = acquireVoiceSlot(store);
    expect(() => acquireVoiceSlot(store)).toThrow();
    b();
    c();
    const d = acquireVoiceSlot(store);
    d();
  });
  it("rejects stale edits and clears measurements when the reference changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ text: "Madini" }))),
    );
    const v = await reviewed();
    await request(app)
      .post(`/api/voice/corpus/${v.id}/test`)
      .set(auth())
      .expect(200);
    await request(app)
      .patch(`/api/voice/corpus/${v.id}`)
      .set(auth())
      .send({ expectedText: "new", reviewed: true, revision: 1 })
      .expect(409);
    const updated = await request(app)
      .patch(`/api/voice/corpus/${v.id}`)
      .set(auth())
      .send({ expectedText: "Nataka Madini", reviewed: true, revision: 2 })
      .expect(200);
    expect(updated.body.test).toBeUndefined();
    expect(
      (await request(app).get("/api/voice/corpus/metrics").set(auth())).body
        .tested,
    ).toBe(0);
  });
  it("does not save a late provider result over a revised reference", async () => {
    const v = await reviewed();
    let finish: (r: Response) => void = () => {};
    let started: () => void = () => {};
    const began = new Promise<void>((r) => (started = r));
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        started();
        return new Promise<Response>((r) => (finish = r));
      }),
    );
    const pending = request(app)
      .post(`/api/voice/corpus/${v.id}/test`)
      .set(auth())
      .then((r) => r);
    await began;
    await request(app)
      .patch(`/api/voice/corpus/${v.id}`)
      .set(auth())
      .send({ expectedText: "Changed", reviewed: true, revision: 2 })
      .expect(200);
    finish(new Response(JSON.stringify({ text: "old" })));
    expect((await pending).status).toBe(409);
  });
  it("exports real owner audio through the CLI without overwriting an existing folder", async () => {
    await reviewed();
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address() as { port: number };
    const output = join(dir, "export");
    const args = [
      "--import",
      "tsx",
      "scripts/export-voice-corpus.ts",
      "--url=http://127.0.0.1:" + address.port,
      "--output=" + output,
    ];
    try {
      const result = await promisify(execFile)(process.execPath, args, {
        cwd: process.cwd(),
        env: { ...process.env, PEPO_CORPUS_TOKEN: token },
      });
      expect(result.stdout).toContain("1 exemples");
      const manifest = JSON.parse(
        readFileSync(join(output, "manifest.json"), "utf8"),
      );
      expect(readFileSync(join(output, manifest.samples[0].audioFile))).toEqual(
        wav(),
      );
      expect(JSON.stringify(manifest)).not.toContain(token);
      await expect(
        promisify(execFile)(process.execPath, args, {
          cwd: process.cwd(),
          env: { ...process.env, PEPO_CORPUS_TOKEN: token },
        }),
      ).rejects.toThrow();
      expect(readFileSync(join(output, manifest.samples[0].audioFile))).toEqual(
        wav(),
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      );
    }
  });
  it("exports only reviewed current tests and deletes the owner's encrypted file", async () => {
    const v = await reviewed();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ text: "Nataka kwenda Madini" })),
      ),
    );
    await request(app)
      .post(`/api/voice/corpus/${v.id}/test`)
      .set(auth())
      .expect(200);
    const exported = await request(app)
      .get("/api/voice/corpus/export")
      .set(auth())
      .expect(200);
    expect(JSON.parse(exported.text).city).toBe("likasi");
    expect(exported.text).not.toContain(token);
    await request(app)
      .delete(`/api/voice/corpus/${v.id}`)
      .set(auth())
      .expect(200);
    expect(readdirSync(join(dir, "voice-corpus"))).toHaveLength(0);
    await request(app)
      .get(`/api/voice/corpus/${v.id}/audio`)
      .set(auth())
      .expect(404);
  });
});
