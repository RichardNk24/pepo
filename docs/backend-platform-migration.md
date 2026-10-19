# Pepo backend platform migration

## Current delivery

NestJS now owns the process lifecycle and exposes liveness/readiness endpoints. PostgreSQL and Redis are managed services with graceful Nest shutdown, health reporting, bounded connections, and configurable strict startup. PostgreSQL schema changes run as ordered, transaction-protected migrations under an advisory lock. The first schema establishes the core identity, trip, driver-location, dispatch-offer, saved-place, and event-outbox tables.

The existing business routes still use the synchronous SQLite `Store`. PostgreSQL is therefore **not yet the source of truth for rider or driver data**. Keep `DATA_DIR` and the SQLite file backed up. Do not set `REQUIRE_EXTERNAL_INFRA=true` as a claim that business data has moved; it only makes configured Postgres/Redis availability mandatory. This compatibility step is intentional because the current API has many synchronous SQL call sites and a direct database swap would break auth, dispatch, safety, and trip transitions.

## Local infrastructure

From the repo root, with Docker Desktop running:

```powershell
docker compose -f docker-compose.backend.yml up -d
if (-not (Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
npm run db:migrate -w @pepo/api
npm run api
```

If `apps/api/.env` already exists, keep it and add or verify only `DATABASE_URL` and `REDIS_URL`; do not overwrite the file.

Set these values in `apps/api/.env` for local services:

```dotenv
DATABASE_URL=postgresql://pepo:pepo_local_dev@127.0.0.1:5432/pepo
REDIS_URL=redis://:pepo_local_dev@127.0.0.1:6379
REQUIRE_EXTERNAL_INFRA=false
```

Then inspect `http://localhost:4000/health`, `/health/live`, and `/health/ready`. The `/health` response preserves the old fields and identifies the current storage mode. Health endpoints intentionally do not reveal connection strings or credentials.

## Migration sequence

1. Add the schema and repositories for auth/session/OTP; export and import SQLite data with counts and checksums before switching reads.
2. Move rider/driver profiles, saved places, and trip writes behind async repositories; use transactions for trip state changes and outbox insertion.
3. Move dispatch locations/offers to PostgreSQL transactions and use Redis only for expiring presence, locks, rate-limit buckets, and fanout coordination. PostgreSQL remains authoritative.
4. Port safety, payment, voice, and admin operations, then remove the Express compatibility bridge and `node:sqlite`.
5. Run shadow comparisons, rehearse restore/rollback, then make Postgres mandatory in production. Keep Redis rebuildable from durable state.

The initial schema is additive and has no automatic import of the local SQLite file. Backups and a verified data migration are required before cutover.
