import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from "@nestjs/common";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { InfrastructureConfig } from "./config";

export const INFRASTRUCTURE_CONFIG = Symbol("PEPO_INFRASTRUCTURE_CONFIG");

export async function applyPostgresMigrations(pool: Pool, migrationsDir: string) {
  const files = (await readdir(migrationsDir))
    .filter((file) => /^\d{3}_[a-z0-9_-]+\.sql$/.test(file))
    .sort();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [728401621]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS pepo_schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const applied = new Map(
      (await client.query<{ version: string; checksum: string }>("SELECT version, checksum FROM pepo_schema_migrations"))
        .rows.map((row) => [row.version, row.checksum]),
    );
    for (const file of files) {
      const version = file.slice(0, 3);
      const sql = await readFile(join(migrationsDir, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const previousChecksum = applied.get(version);
      if (previousChecksum) {
        if (previousChecksum !== checksum) {
          throw new Error(`La migration PostgreSQL ${file} a changé après application.`);
        }
        continue;
      }
      await client.query(sql);
      await client.query("INSERT INTO pepo_schema_migrations(version, checksum) VALUES ($1, $2)", [version, checksum]);
    }
    await client.query("COMMIT");
    return files.filter((file) => !applied.has(file.slice(0, 3)));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

@Injectable()
export class PostgresService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PostgresService.name);
  private pool?: Pool;
  private migrationReady = false;

  constructor(private readonly config: InfrastructureConfig) {}

  get configured() {
    return Boolean(this.config.postgresUrl);
  }

  get ready() {
    return this.migrationReady;
  }

  async onModuleInit() {
    if (!this.config.postgresUrl) {
      if (this.config.requireExternal) throw new Error("DATABASE_URL est requis.");
      this.logger.warn("PostgreSQL non configuré; les routeurs historiques restent sur SQLite.");
      return;
    }

    this.pool = new Pool({
      connectionString: this.config.postgresUrl,
      max: Number(process.env.PG_POOL_MAX || 12),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000),
      idleTimeoutMillis: 30000,
      statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 10000),
      application_name: "pepo-api",
    });
    this.pool.on("error", (error) => this.logger.error(`PostgreSQL pool: ${error.message}`));
    try {
      await this.runMigrations();
    } catch (error) {
      await this.pool.end();
      this.pool = undefined;
      throw error;
    }
    this.migrationReady = true;
    this.logger.log("PostgreSQL connected; migrations are current.");
  }

  async onApplicationShutdown() {
    await this.pool?.end();
  }

  async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    if (!this.pool) throw new Error("PostgreSQL is not configured.");
    return this.pool.query<Row>(text, [...values]);
  }

  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) throw new Error("PostgreSQL is not configured.");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async runMigrations() {
    if (!this.pool) return;
    const migrationsDir = join(__dirname, "migrations");
    const applied = await applyPostgresMigrations(this.pool, migrationsDir);
    applied.forEach((file) => this.logger.log(`Applied PostgreSQL migration ${file}`));
  }
}
