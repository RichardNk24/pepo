import type { Store } from "../database";
import { ApiError } from "../runtime";
const active = new WeakMap<Store, number>();
export function acquireVoiceSlot(store: Store) {
  const count = active.get(store) || 0;
  if (count >= 2) throw new ApiError(429, "Le service vocal est occupé.");
  active.set(store, count + 1);
  let released = false;
  return () => {
    if (!released) {
      released = true;
      active.set(store, (active.get(store) || 1) - 1);
    }
  };
}
export function reserveVoiceBudget(store: Store, limit: number) {
  store.db.exec(
    "CREATE TABLE IF NOT EXISTS voice_ai_budget(day TEXT PRIMARY KEY,calls INTEGER NOT NULL DEFAULT 0)",
  );
  const day = new Date().toISOString().slice(0, 10);
  store.db.prepare("DELETE FROM voice_ai_budget WHERE day < ?").run(day);
  const allowed = store.db
    .prepare(
      "INSERT INTO voice_ai_budget(day,calls) SELECT ?,1 WHERE ? > 0 ON CONFLICT(day) DO UPDATE SET calls=calls+1 WHERE calls < ? RETURNING calls",
    )
    .get(day, limit, limit);
  if (!allowed) throw new ApiError(429, "Le quota vocal du jour est atteint.");
}
