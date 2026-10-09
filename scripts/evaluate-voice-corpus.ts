import { readFileSync, statSync } from "node:fs";
import {
  evaluateVoiceSamples,
  type VoiceSample,
} from "../packages/voice/src/evaluation";
const file = process.argv[2];
if (!file)
  throw new Error(
    'Usage: node --import tsx scripts/evaluate-voice-corpus.ts "C:\\chemin\\corpus.jsonl"',
  );
if (statSync(file).size > 10 * 1024 * 1024)
  throw new Error("Corpus limité à 10 Mo par évaluation");
const rows = readFileSync(file, "utf8")
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .filter((s) => s.trim())
  .map((s) => JSON.parse(s) as VoiceSample);
if (rows.length > 10000) throw new Error("Corpus limité à 10 000 échantillons");
console.log(
  JSON.stringify(
    {
      scope: "corpus fourni uniquement, aucune mesure de terrain implicite",
      results: evaluateVoiceSamples(rows),
    },
    null,
    2,
  ),
);
