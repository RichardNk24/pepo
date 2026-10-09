/** Owner-authenticated export. Audio is never exposed through a public link. */
import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import type { CorpusSample } from "../packages/voice/src/corpus";
async function main() {
  const arg = (name: string) =>
    process.argv
      .slice(2)
      .find((v) => v.startsWith("--" + name + "="))
      ?.slice(name.length + 3);
  const url = new URL(arg("url") || "http://localhost:4000"),
    output = resolve(arg("output") || "voice-corpus-export");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Adresse API invalide.");
  const token = process.env.PEPO_CORPUS_TOKEN;
  if (!token)
    throw new Error(
      "Définissez PEPO_CORPUS_TOKEN avec le jeton de votre propre compte.",
    );
  if (existsSync(output))
    throw new Error(
      "Le dossier de sortie existe déjà : choisissez un nouveau nom.",
    );
  const get = async (path: string) => {
    const response = await fetch(new URL("/api/voice/corpus" + path, url), {
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(
        "Export refusé ou serveur inaccessible (" + response.status + ").",
      );
    return response;
  };
  const response = await get("");
  const value = (await response.json()) as { samples: CorpusSample[] };
  if (!Array.isArray(value.samples) || value.samples.length > 200)
    throw new Error("Liste de corpus invalide.");
  const samples = value.samples.filter((v) => v.reviewed && v.expectedText);
  mkdirSync(output, { recursive: false, mode: 0o700 });
  try {
    const manifest = [];
    for (const sample of samples) {
      if (!/^[a-f0-9-]{36}$/.test(sample.id))
        throw new Error("Identifiant invalide.");
      const response = await get("/" + sample.id + "/audio");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 1024 * 1024) throw new Error("Audio trop volumineux.");
      const extension = response.headers.get("content-type")?.includes("wav")
        ? "wav"
        : "m4a";
      const file = sample.id + "." + extension;
      writeFileSync(join(output, file), bytes, { mode: 0o600 });
      manifest.push({ ...sample, audioFile: file });
    }
    writeFileSync(
      join(output, "manifest.json"),
      JSON.stringify(
        {
          profile: "sw-CD-katanga",
          scope:
            "Owner-reviewed corpus; no automatic training or population validation",
          samples: manifest,
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
    const pairs = manifest
      .filter((v) => v.test?.revision === v.revision)
      .map((v) => ({
        profile: v.profile,
        expectedText: v.expectedText,
        transcript: v.test!.transcript,
        latencyMs: v.test!.latencyMs,
        city: v.city,
        kind: v.kind,
        sampleId: v.id,
      }));
    writeFileSync(
      join(output, "evaluation.jsonl"),
      pairs.map((v) => JSON.stringify(v)).join("\n"),
      { mode: 0o600 },
    );
    console.log(
      `${manifest.length} exemples vérifiés exportés ; ${pairs.length} paires évaluables. Dossier : ${output}`,
    );
  } catch (error) {
    rmSync(output, { recursive: true, force: true });
    throw error;
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Export impossible.");
  process.exitCode = 1;
});
