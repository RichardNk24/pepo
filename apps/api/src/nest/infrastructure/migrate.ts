import { Pool } from "pg";
import { resolve } from "node:path";
import { readInfrastructureConfig } from "./config";
import { applyPostgresMigrations } from "./postgres.service";

async function main() {
  const config = readInfrastructureConfig();
  if (!config.postgresUrl) throw new Error("Configurez DATABASE_URL dans apps/api/.env.");
  const pool = new Pool({
    connectionString: config.postgresUrl,
    max: 1,
    connectionTimeoutMillis: 5000,
    application_name: "pepo-migrate",
  });
  try {
    const changes = await applyPostgresMigrations(
      pool,
      resolve(__dirname, "migrations"),
    );
    console.log(changes.length ? `Migrations appliquées : ${changes.join(", ")}` : "Base déjà à jour.");
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error("Échec des migrations PostgreSQL :", error);
  process.exitCode = 1;
});
