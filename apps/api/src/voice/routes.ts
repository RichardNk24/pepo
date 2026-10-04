import multer from "multer";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  ApiError,
  city,
  wrap,
  type AuthRequest,
  type RouteContext,
} from "../runtime";
import { localLandmarks } from "../landmarks";
import { withLocalAliases } from "../map-search/aliases";
import { audioDuration } from "./audio";

class VoiceError extends ApiError {
  constructor(
    status: number,
    public code: string,
    message: string,
  ) {
    super(status, message);
  }
}
export function register_voice({ app, store }: RouteContext) {
  const enabled =
    (process.env.PEPO_VOICE_ENABLED ?? process.env.PEPO_AI_PLACES_ENABLED) ===
    "true";
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-transcribe";
  const limit = Math.max(
    0,
    Math.min(1000, Number(process.env.PEPO_VOICE_DAILY_CALL_LIMIT ?? 20) || 0),
  );
  let active = 0;
  // Authenticated preflight; no provider call and no budget consumption.
  app.get("/api/voice/status", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ enabled: enabled && Boolean(key) && limit > 0 });
  });
  store.db.exec(
    "CREATE TABLE IF NOT EXISTS voice_ai_budget(day TEXT PRIMARY KEY,calls INTEGER NOT NULL DEFAULT 0)",
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 1024 * 1024,
      files: 1,
      fields: 2,
      parts: 3,
      fieldSize: 100,
    },
  }).single("audio");
  const traceFor = (req: AuthRequest) => {
    const raw = req.get("X-Pepo-Voice-Trace") || "";
    return /^[a-z0-9-]{1,64}$/.test(raw) ? raw : "untracked";
  };
  const debug = (
    req: AuthRequest,
    stage: string,
    values: Record<string, unknown> = {},
  ) => {
    if (process.env.NODE_ENV !== "production")
      console.info("[pepo-voice]", stage, { trace: traceFor(req), ...values });
  };
  app.post(
    "/api/voice/transcribe",
    (req, res, next) => {
      debug(req as AuthRequest, "VOICE_REQUEST_RECEIVED");
      res.setHeader("Cache-Control", "no-store");
      next();
    },
    rateLimit({
      windowMs: 60000,
      limit: 6,
      keyGenerator: (req) => (req as AuthRequest).actor.id,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Patientez avant de réessayer le micro." },
    }),
    (req, res, next) => {
      res.setHeader("Cache-Control", "no-store");
      if (!enabled || !key) {
        if (process.env.NODE_ENV !== "production")
          console.warn("[pepo-voice] VOICE_DISABLED", {
            enabled,
            hasKey: Boolean(key),
          });
        res.status(503).json({
          code: "VOICE_DISABLED",
          error: "La recherche vocale n’est pas activée.",
        });
        return;
      }
      upload(req, res, (error) => {
        if (error) {
          debug(req as AuthRequest, "VOICE_UPLOAD_INVALID");
          res
            .status(400)
            .json({
              code: "VOICE_AUDIO_INVALID",
              error: "Audio invalide ou trop volumineux (1 Mo maximum).",
            });
        } else next();
      });
    },
    wrap(async (req, res) => {
      let acquired = false;
      const controller = new AbortController();
      const cancel = () => {
        if (!res.writableEnded) controller.abort();
      };
      const timer = setTimeout(() => controller.abort(), 25000);
      res.on("close", cancel);
      try {
        const parsed = z
          .object({ city, language: z.enum(["fr", "en", "sw", "ln"]) })
          .strict()
          .safeParse(req.body);
        if (!parsed.success)
          throw new ApiError(400, "Ville ou langue invalide.");
        const input = parsed.data;
        const file = req.file;
        const audio = file && audioDuration(file.buffer);
        if (!audio || audio.seconds < 0.35 || audio.seconds > 15)
          throw new ApiError(
            400,
            "Enregistrez une phrase de moins de 15 secondes.",
          );
        debug(req, "VOICE_AUDIO_RECEIVED", {
          bytes: file!.size,
          seconds: Math.round(audio.seconds * 10) / 10,
        });
        if (active >= 2)
          throw new ApiError(
            429,
            "Le micro est occupé. Réessayez dans un instant.",
          );
        active++;
        acquired = true;
        const places = withLocalAliases(await localLandmarks(input.city));
        if (controller.signal.aborted) throw new Error("cancelled");
        const day = new Date().toISOString().slice(0, 10);
        store.db.prepare("DELETE FROM voice_ai_budget WHERE day < ?").run(day);
        const allowed = store.db
          .prepare(
            "INSERT INTO voice_ai_budget(day,calls) SELECT ?,1 WHERE ? > 0 ON CONFLICT(day) DO UPDATE SET calls=calls+1 WHERE calls < ? RETURNING calls",
          )
          .get(day, limit, limit);
        if (!allowed)
          throw new ApiError(
            429,
            "Le quota vocal du jour est atteint. Vous pouvez écrire votre destination.",
          );
        const body = new FormData();
        body.append("model", model);
        body.append(
          "file",
          new Blob([new Uint8Array(file!.buffer)], { type: audio.mime }),
          audio.name,
        );
        // Language is a hint, never a translation instruction. Preserve local names.
        // Only official parameters common to the configurable transcription models.
        body.append(
          "prompt",
          `Destination in ${input.city}, Congo. Language hint: ${input.language}. Transcribe only what is spoken; do not invent speech from silence. Local spellings: ${places
            .flatMap((p) => [p.name, ...(p.aliases || []).slice(0, 2)])
            .join(", ")
            .slice(0, 1600)}`,
        );
        debug(req, "VOICE_PROVIDER_STARTED");
        const providerStarted = Date.now();
        const response = await fetch(
          "https://api.openai.com/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body,
            signal: controller.signal,
          },
        );
        debug(req, "VOICE_PROVIDER_RESPONSE", {
          status: response.status,
          elapsedMs: Date.now() - providerStarted,
        });
        if (!response.ok) {
          // Never log the provider body: it may echo submitted audio or prompt data.
          const code =
            response.status === 401 || response.status === 403
              ? "VOICE_PROVIDER_AUTH"
              : response.status === 404
                ? "VOICE_PROVIDER_MODEL"
                : response.status === 429
                  ? "VOICE_PROVIDER_QUOTA"
                  : "VOICE_PROVIDER_ERROR";
          console.warn("[pepo-voice]", code, {
            status: response.status,
            requestId: response.headers.get("x-request-id"),
          });
          throw new VoiceError(
            response.status === 429 ? 429 : 503,
            code,
            "Le service vocal est momentanément indisponible.",
          );
        }
        const result = z
          .object({ text: z.string().trim().min(1).max(300) })
          .safeParse(await response.json());
        if (!result.success)
          throw new VoiceError(
            503,
            "VOICE_EMPTY_TRANSCRIPT",
            "La phrase n’a pas été comprise. Réessayez.",
          );
        if (controller.signal.aborted) throw new Error("timeout");
        res.json({ text: result.data.text });
      } catch (error) {
        if (res.destroyed) return;
        const status = error instanceof ApiError ? error.status : 503;
        const code =
          error instanceof VoiceError
            ? error.code
            : controller.signal.aborted
              ? "VOICE_TIMEOUT"
              : error instanceof ApiError && status === 400
                ? "VOICE_AUDIO_INVALID"
                : error instanceof ApiError && status === 429
                  ? "VOICE_QUOTA"
                  : "VOICE_PROVIDER_ERROR";
        if (process.env.NODE_ENV !== "production")
          console.warn("[pepo-voice]", code, { trace: traceFor(req), status });
        res.status(status).json({
          code,
          error:
            error instanceof ApiError
              ? error.message
              : "La phrase n’a pas pu être transcrite. Réessayez ou écrivez votre destination.",
        });
      } finally {
        if (acquired) active--;
        clearTimeout(timer);
        res.off("close", cancel);
        req.file?.buffer.fill(0);
        delete req.file;
      }
    }),
  );
}
