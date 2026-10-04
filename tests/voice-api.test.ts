import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import request from "supertest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../apps/api/src/app";
import { openDatabase, type Store } from "../apps/api/src/database";
import { audioDuration } from "../apps/api/src/voice/audio";
let dir: string,
  store: Store,
  app: ReturnType<typeof createApp>["app"],
  token: string;
const options = () => ({
  devAuth: true,
  publicUrl: "http://localhost:4000",
  adminToken: "fixture",
  dataDir: dir,
  corsOrigins: [],
});
function wav(seconds = 1) {
  const b = Buffer.alloc(44 + 32000 * seconds);
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
function mp4(seconds = 2) {
  const box = (tag: string, body: Buffer) => {
    const b = Buffer.alloc(8 + body.length);
    b.writeUInt32BE(b.length);
    b.write(tag, 4);
    body.copy(b, 8);
    return b;
  };
  const header = Buffer.alloc(24);
  header.writeUInt32BE(1000, 12);
  header.writeUInt32BE(seconds * 1000, 16);
  return Buffer.concat([
    box("ftyp", Buffer.from("M4A \x00\x00\x00\x00")),
    box("moov", box("mvhd", header)),
    box("mdat", Buffer.alloc(8)),
  ]);
}
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "pepo-voice-"));
  vi.stubEnv("PEPO_VOICE_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "fixture-only");
  vi.stubEnv("PEPO_VOICE_DAILY_CALL_LIMIT", "2");
  store = openDatabase(join(dir, "db.sqlite"));
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
function send(data = wav(), target = app) {
  return request(target)
    .post("/api/voice/transcribe")
    .set("Authorization", "Bearer " + token)
    .field("city", "lubumbashi")
    .field("language", "fr")
    .attach("audio", data, "speech.wav");
}
describe("authenticated ephemeral voice transcription", () => {
  it("rejects unauthenticated, disabled, malformed, long and oversized audio before any provider call", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await request(app).post("/api/voice/transcribe").expect(401);
    await send(Buffer.from("not audio")).expect(400);
    await send(wav(16)).expect(400);
    await send(Buffer.alloc(1024 * 1024 + 1)).expect(400);
    vi.stubEnv("PEPO_VOICE_ENABLED", "false");
    await send(wav(), createApp(store, options()).app).expect(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("validates PCM and M4A metadata without trusting the filename", () => {
    expect(audioDuration(wav())?.seconds).toBe(1);
    expect(audioDuration(mp4())?.seconds).toBe(2);
    const broken = mp4();
    broken.writeUInt32BE(0xffffffff);
    expect(audioDuration(broken)).toBeNull();
  });
  it("returns only text, keeps the daily budget after restart, and does not log audio into SQLite", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ text: "Je vais à Karavia", other: "ignored" }),
        ),
    );
    vi.stubGlobal("fetch", fetcher);
    const response = await send().expect(200);
    expect(response.body).toEqual({ text: "Je vais à Karavia" });
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = fetcher.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("model")).toBe("gpt-transcribe");
    expect(body.get("file")).toBeInstanceOf(Blob);
    expect(body.get("prompt")).not.toContain(token);
    await send().expect(200);
    await send(wav(), createApp(store, options()).app).expect(429);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      store.db.prepare("SELECT calls FROM voice_ai_budget").get(),
    ).toMatchObject({ calls: 2 });
  });
  it("does not retry failures, and rejects empty or excessively long transcripts", async () => {
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ text: "" })),
    );
    vi.stubGlobal("fetch", fetcher);
    await send().expect(503);
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockImplementation(async () => new Response("", { status: 429 }));
    const limited = await send().expect(429);
    expect(limited.body.code).toBe("VOICE_PROVIDER_QUOTA");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("checks availability without sending audio or consuming a call", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await request(app).get("/api/voice/status").expect(401);
    const ready = await request(app)
      .get("/api/voice/status")
      .set("Authorization", "Bearer " + token)
      .expect(200);
    expect(ready.body).toEqual({ enabled: true });
    expect(
      store.db.prepare("SELECT count(*) n FROM voice_ai_budget").get(),
    ).toEqual({ n: 0 });
    vi.stubEnv("OPENAI_API_KEY", "");
    const offline = createApp(store, options()).app;
    const response = await request(offline)
      .get("/api/voice/status")
      .set("Authorization", "Bearer " + token)
      .expect(200);
    expect(response.body).toEqual({ enabled: false });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("distinguishes provider credentials from empty speech without exposing provider content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response("sensitive provider body", { status: 401 }),
      ),
    );
    const failed = await send().expect(503);
    expect(failed.body.code).toBe("VOICE_PROVIDER_AUTH");
    expect(JSON.stringify(failed.body)).not.toContain("sensitive");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ text: "" }))),
    );
    const empty = await send().expect(503);
    expect(empty.body.code).toBe("VOICE_EMPTY_TRANSCRIPT");
  });
  it("reports transfer stages without audio, transcripts or credentials in diagnostic logs", async () => {
    const logs = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ text: "private spoken destination" })),
      ),
    );
    await request(app)
      .post("/api/voice/transcribe")
      .set("Authorization", "Bearer " + token)
      .set("X-Pepo-Voice-Trace", "fixture-trace")
      .field("city", "lubumbashi")
      .field("language", "fr")
      .attach("audio", mp4(), "destination.m4a")
      .expect(200);
    const output = JSON.stringify(logs.mock.calls);
    expect(output).toContain("VOICE_REQUEST_RECEIVED");
    expect(output).toContain("VOICE_AUDIO_RECEIVED");
    expect(output).toContain("VOICE_PROVIDER_STARTED");
    expect(output).toContain("VOICE_PROVIDER_RESPONSE");
    expect(output).toContain("fixture-trace");
    expect(output).not.toContain("private spoken destination");
    expect(output).not.toContain(token);
    expect(output).not.toContain("fixture-only");
    logs.mockRestore();
  });
});
