import {
  randomUUID,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { CORPUS_CITIES, type CorpusSample } from "@pepo/voice/corpus";
import { evaluateVoiceSamples } from "@pepo/voice/evaluation";
import {
  ApiError,
  wrap,
  type RouteContext,
  type AuthRequest,
} from "../runtime";
import { audioDuration } from "./audio";
import { acquireVoiceSlot, reserveVoiceBudget } from "./budget";
import { openAISpeechProvider, SpeechProviderError } from "./providers";
const metadata = z
  .object({
    city: z.enum(CORPUS_CITIES),
    kind: z.enum(["destination", "place_name", "navigation"]),
    profile: z.literal("sw-CD-katanga"),
    prompt: z.string().trim().min(1).max(300),
    consent: z.literal("true"),
  })
  .strict();
export function registerVoiceCorpus({
  app,
  store,
  dataDir,
  storageKey,
}: RouteContext) {
  const folder = join(dataDir, "voice-corpus");
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  store.db.exec(
    "CREATE TABLE IF NOT EXISTS voice_corpus(id TEXT PRIMARY KEY,owner TEXT NOT NULL,role TEXT NOT NULL,data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS voice_corpus_owner ON voice_corpus(owner,role)",
  );
  const owner = (req: AuthRequest) => [req.actor.id, req.actor.role];
  const get = (req: AuthRequest, id: string): CorpusSample => {
    if (!z.string().uuid().safeParse(id).success)
      throw new ApiError(404, "Exemple introuvable.");
    const row = store.db
      .prepare(
        "SELECT data FROM voice_corpus WHERE id=? AND owner=? AND role=?",
      )
      .get(id, ...owner(req)) as { data: string } | undefined;
    if (!row) throw new ApiError(404, "Exemple introuvable.");
    return JSON.parse(row.data);
  };
  const all = (req: AuthRequest): CorpusSample[] =>
    (
      store.db
        .prepare(
          "SELECT data FROM voice_corpus WHERE owner=? AND role=? ORDER BY rowid DESC",
        )
        .all(...owner(req)) as { data: string }[]
    ).map((r) => JSON.parse(r.data));
  const save = (req: AuthRequest, v: CorpusSample) =>
    store.db
      .prepare(
        "UPDATE voice_corpus SET data=? WHERE id=? AND owner=? AND role=?",
      )
      .run(JSON.stringify(v), v.id, ...owner(req));
  const decrypt = (id: string) => {
    const b = readFileSync(join(folder, id + ".enc"));
    const decipher = createDecipheriv(
      "aes-256-gcm",
      storageKey,
      b.subarray(0, 12),
    );
    decipher.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]);
  };
  app.use("/api/voice/corpus", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (process.env.PEPO_VOICE_CORPUS_ENABLED !== "true") {
      res.status(503).json({
        error: "L’atelier vocal n’est pas activé.",
        code: "VOICE_CORPUS_DISABLED",
      });
      return;
    }
    next();
  });
  app.get("/api/voice/corpus/status", (_req, res) =>
    res.json({
      enabled: true,
      profile: "sw-CD-katanga",
      maxSamples: 200,
      training: false,
    }),
  );
  app.get(
    "/api/voice/corpus",
    wrap((req, res) => {
      res.json({ samples: all(req) });
    }),
  );
  app.get(
    "/api/voice/corpus/export",
    wrap((req, res) => {
      const samples = all(req).filter(
        (v) => v.reviewed && v.test?.revision === v.revision,
      );
      res.type("application/x-ndjson").send(
        samples
          .map((v) =>
            JSON.stringify({
              profile: v.profile,
              expectedText: v.expectedText,
              transcript: v.test!.transcript,
              latencyMs: v.test!.latencyMs,
              city: v.city,
              kind: v.kind,
              sampleId: v.id,
              model: v.test!.model,
            }),
          )
          .join("\n"),
      );
    }),
  );
  app.get(
    "/api/voice/corpus/metrics",
    wrap((req, res) => {
      const samples = all(req);
      const tested = samples.filter(
        (v) => v.reviewed && v.test?.revision === v.revision,
      );
      res.json({
        recorded: samples.length,
        reviewed: samples.filter((v) => v.reviewed).length,
        tested: tested.length,
        metrics: evaluateVoiceSamples(
          tested.map((v) => ({
            profile: v.profile,
            expectedText: v.expectedText,
            transcript: v.test!.transcript,
            latencyMs: v.test!.latencyMs,
          })),
        ),
        generalPopulationValidated: false,
      });
    }),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 1024 * 1024,
      files: 1,
      fields: 6,
      parts: 7,
      fieldSize: 1000,
    },
  }).single("audio");
  app.post(
    "/api/voice/corpus",
    rateLimit({
      windowMs: 60000,
      limit: 20,
      keyGenerator: (req) => (req as AuthRequest).actor.id,
      legacyHeaders: false,
    }),
    (req, res, next) =>
      upload(req, res, (e) => {
        if (e)
          res.status(400).json({ error: "Audio invalide (1 Mo maximum)." });
        else next();
      }),
    wrap((req, res) => {
      try {
        const input = metadata.parse(req.body);
        const audio = req.file && audioDuration(req.file.buffer);
        if (!audio || audio.seconds < 0.35 || audio.seconds > 15)
          throw new ApiError(
            400,
            "Enregistrez une phrase de moins de 15 secondes.",
          );
        const count = store.db
          .prepare(
            "SELECT count(*) n FROM voice_corpus WHERE owner=? AND role=?",
          )
          .get(...owner(req)) as { n: number };
        if (count.n >= 200)
          throw new ApiError(
            429,
            "200 exemples maximum : supprimez un ancien exemple.",
          );
        const id = randomUUID();
        const iv = randomBytes(12);
        const cipher = createCipheriv("aes-256-gcm", storageKey, iv);
        const encrypted = Buffer.concat([
          cipher.update(req.file!.buffer),
          cipher.final(),
        ]);
        const path = join(folder, id + ".enc");
        const sample: CorpusSample = {
          id,
          city: input.city,
          kind: input.kind,
          profile: input.profile,
          prompt: input.prompt,
          expectedText: "",
          reviewed: false,
          revision: 1,
          seconds: audio.seconds,
          createdAt: Date.now(),
        };
        try {
          writeFileSync(
            path,
            Buffer.concat([iv, cipher.getAuthTag(), encrypted]),
            { mode: 0o600 },
          );
          store.db
            .prepare("INSERT INTO voice_corpus VALUES(?,?,?,?)")
            .run(id, ...owner(req), JSON.stringify(sample));
        } catch (e) {
          if (existsSync(path)) unlinkSync(path);
          throw e;
        }
        res.status(201).json({ text: id, sample }); // Shared capture transport returns this upload receipt, not a transcription.
      } finally {
        req.file?.buffer.fill(0);
        delete req.file;
      }
    }),
  );
  app.get(
    "/api/voice/corpus/:id/audio",
    wrap((req, res) => {
      const sample = get(req, z.string().uuid().parse(req.params.id));
      const buffer = decrypt(sample.id);
      const audio = audioDuration(buffer);
      if (!audio) {
        buffer.fill(0);
        throw new ApiError(500, "Audio illisible.");
      }
      res.type(audio.mime);
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="' +
          sample.id +
          audio.name.slice(audio.name.lastIndexOf(".")) +
          '"',
      );
      res.send(buffer);
      res.once("finish", () => buffer.fill(0));
    }),
  );
  app.patch(
    "/api/voice/corpus/:id",
    wrap((req, res) => {
      const v = get(req, z.string().uuid().parse(req.params.id));
      const update = z
        .object({
          expectedText: z.string().trim().min(1).max(300),
          reviewed: z.boolean(),
          revision: z.number().int().positive(),
        })
        .strict()
        .parse(req.body);
      if (update.revision !== v.revision)
        throw new ApiError(409, "Cet exemple a changé. Rechargez-le.");
      v.expectedText = update.expectedText;
      v.reviewed = update.reviewed;
      v.revision++;
      delete v.test;
      save(req, v);
      res.json(v);
    }),
  );
  app.delete(
    "/api/voice/corpus/:id",
    wrap((req, res) => {
      const v = get(req, z.string().uuid().parse(req.params.id));
      const path = join(folder, v.id + ".enc");
      if (existsSync(path)) unlinkSync(path);
      store.db
        .prepare("DELETE FROM voice_corpus WHERE id=? AND owner=? AND role=?")
        .run(v.id, ...owner(req));
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/voice/corpus/:id/test",
    rateLimit({
      windowMs: 60000,
      limit: 6,
      keyGenerator: (req) => (req as AuthRequest).actor.id,
      legacyHeaders: false,
    }),
    wrap(async (req, res) => {
      const v = get(req, z.string().uuid().parse(req.params.id));
      if (!v.reviewed || !v.expectedText)
        throw new ApiError(400, "Vérifiez d’abord le texte exact.");
      const enabled =
          (process.env.PEPO_VOICE_ENABLED ??
            process.env.PEPO_AI_PLACES_ENABLED) === "true",
        key = process.env.OPENAI_API_KEY;
      if (!enabled || !key)
        throw new ApiError(
          503,
          "Le test OpenAI n’est pas activé. La collecte reste disponible.",
        );
      const release = acquireVoiceSlot(store),
        controller = new AbortController();
      let buffer: Buffer | undefined;
      const cancel = () => {
        if (!res.writableEnded) controller.abort();
      };
      res.on("close", cancel);
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        buffer = decrypt(v.id);
        const audio = audioDuration(buffer);
        if (!audio) throw new ApiError(400, "Audio illisible.");
        reserveVoiceBudget(
          store,
          Math.max(
            0,
            Math.min(
              1000,
              Number(process.env.PEPO_VOICE_DAILY_CALL_LIMIT ?? 20) || 0,
            ),
          ),
        );
        const start = Date.now(),
          model = process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-transcribe";
        // Held-out test: never put the reference phrase or the target place name in the prompt.
        const result = await openAISpeechProvider(key, model).transcribe({
          audio: new Uint8Array(buffer),
          mime: audio.mime,
          filename: audio.name,
          language: "sw",
          purpose: "corpus",
          context:
            "Katangese Swahili speech sample, possibly mixed with French.",
          signal: controller.signal,
        });
        if (controller.signal.aborted)
          throw new ApiError(503, "Test interrompu.");
        const current = get(req, v.id);
        if (current.revision !== v.revision)
          throw new ApiError(
            409,
            "Le texte a changé pendant le test. Relancez-le.",
          );
        current.test = {
          transcript: result.text,
          latencyMs: Date.now() - start,
          model,
          revision: v.revision,
        };
        save(req, current);
        res.json(current);
      } catch (e) {
        if (e instanceof SpeechProviderError)
          throw new ApiError(
            e.status === 429 ? 429 : 503,
            "Test vocal indisponible.",
            e.code,
          );
        throw e;
      } finally {
        buffer?.fill(0);
        release();
        clearTimeout(timer);
        res.off("close", cancel);
      }
    }),
  );
}
