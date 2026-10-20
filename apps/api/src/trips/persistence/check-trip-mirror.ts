import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { Pool } from "pg";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL absent.");
  const db = new DatabaseSync(resolve(process.env.DATA_DIR || "data", "pepo.sqlite"), { readOnly: true });
  const pool = new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:5000});
  try {
    const installed = db.prepare("SELECT name FROM sqlite_master WHERE name='trip_replication_queue'").get();
    if (!installed) throw new Error("Miroir non initialisé : activez le flag et démarrez l’API.");
    console.log("SQLite", db.prepare("SELECT COUNT(*) AS trips FROM trips").get());
    console.log("File", db.prepare("SELECT COUNT(*) AS pending FROM trip_replication_queue").get());
    console.log("PostgreSQL", (await pool.query("SELECT COUNT(*) AS trips FROM trips")).rows[0]);
    console.log("Dernière synchronisation", (await pool.query("SELECT last_sequence,synced_at FROM trip_replication_source")).rows[0]);
    console.log("Les nombres seuls ne valident pas le parcours mobile complet.");
  } finally { db.close();await pool.end(); }
}
void main().catch(() => {console.error("Vérification impossible : contrôlez le flag, DATA_DIR, PostgreSQL et la migration 002. Aucun secret affiché.");process.exitCode=1;});
