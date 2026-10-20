import { Pool } from "pg";
import { resolve } from "node:path";
import { openDatabase } from "../database";
import { readInfrastructureConfig } from "../nest/infrastructure/config";

type LegacyUser = { id: string; phone: string; data: string };
type LegacySession = {
  hash: string;
  userId: string;
  role: "passenger" | "driver";
  expiresAt: number;
};
type LegacyOtp = {
  phone: string;
  hash: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
};

async function main() {
  const config = readInfrastructureConfig();
  if (!config.postgresUrl)
    throw new Error("Configurez DATABASE_URL dans apps/api/.env.");

  const dataDir = resolve(process.env.DATA_DIR || "data");
  const store = openDatabase(resolve(dataDir, "pepo.sqlite"));
  const pool = new Pool({
    connectionString: config.postgresUrl,
    max: 1,
    connectionTimeoutMillis: 5000,
    application_name: "pepo-auth-backfill",
  });

  try {
    const users = store.db.prepare("SELECT id, phone, data FROM users").all() as LegacyUser[];
    const sessions = store.db
      .prepare("SELECT hash, userId, role, expiresAt FROM sessions")
      .all() as LegacySession[];
    const otp = store.db
      .prepare("SELECT phone, hash, expiresAt, attempts, createdAt FROM otp")
      .all() as LegacyOtp[];

    for (const user of users) {
      const profile = JSON.parse(user.data) as { id?: string; phone?: string };
      if (profile.id !== user.id || profile.phone !== user.phone)
        throw new Error("Une ligne de profil SQLite est incohérente; aucune donnée n’a été importée.");
    }

    const dryRun = process.argv.includes("--dry-run");
    if (dryRun) {
      await pool.query("SELECT 1");
      console.log(
        `Vérification terminée (sans écriture) : ${users.length} profils, ${sessions.length} sessions, ${otp.length} codes temporaires.`,
      );
      return;
    }

    const client = await pool.connect();
    let importedUsers = 0;
    let importedSessions = 0;
    let importedOtp = 0;
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)", [728401622]);

      for (const user of users) {
        const result = await client.query(
          `INSERT INTO users(id, phone, data)
           VALUES ($1, $2, $3::jsonb)
           ON CONFLICT(phone) DO UPDATE SET data=EXCLUDED.data, updated_at=now()
           WHERE users.id=EXCLUDED.id
           RETURNING id`,
          [user.id, user.phone, user.data],
        );
        if (!result.rowCount)
          throw new Error("Un numéro de téléphone a des identifiants SQLite/PostgreSQL différents.");
        importedUsers += result.rowCount;
      }

      for (const session of sessions) {
        const result = await client.query(
          `INSERT INTO sessions(token_hash, user_id, role, expires_at)
           VALUES ($1, $2, $3, $4) ON CONFLICT(token_hash) DO NOTHING RETURNING token_hash`,
          [session.hash, session.userId, session.role, new Date(session.expiresAt)],
        );
        importedSessions += result.rowCount || 0;
      }

      for (const challenge of otp) {
        const result = await client.query(
          `INSERT INTO otp_challenges(phone, code_hash, expires_at, attempts, created_at)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT(phone) DO NOTHING RETURNING phone`,
          [
            challenge.phone,
            challenge.hash,
            new Date(challenge.expiresAt),
            challenge.attempts,
            new Date(challenge.createdAt),
          ],
        );
        importedOtp += result.rowCount || 0;
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    console.log(
      `Reprise terminée : ${importedUsers} profils, ${importedSessions} sessions, ${importedOtp} codes temporaires importés.`,
    );
  } finally {
    store.db.close();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error("Échec de la reprise Auth SQLite → PostgreSQL :", error);
  process.exitCode = 1;
});
