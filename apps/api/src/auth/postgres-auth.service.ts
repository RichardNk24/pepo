import {
  Injectable,
  Inject,
} from "@nestjs/common";
import type { Profile } from "@pepo/types/model";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import type { ServerConfig } from "../runtime";
import { hash, id } from "../runtime";
import type { Store } from "../database";
import { PostgresService } from "../nest/infrastructure/postgres.service";
import { AUTH_CONFIG, AUTH_LEGACY_STORE } from "./postgres-auth.module";

type AuthRole = "passenger" | "driver";
type AuthInput = {
  phone: string;
  code: string;
  name: string;
  role: AuthRole;
  city: Profile["city"];
};

@Injectable()
export class PostgresAuthService {
  constructor(
    private readonly postgres: PostgresService,
    @Inject(AUTH_LEGACY_STORE) private readonly store: Store,
    @Inject(AUTH_CONFIG) private readonly config: ServerConfig,
  ) {}

  async requestCode(phone: string) {
    if (!this.config.devAuth && !this.config.sendSms)
      throw new AuthFailure(503, "Le service SMS doit être configuré sur le serveur.");

    const code = String(randomInt(100000, 1000000));
    const codeHash = hash(phone + code);
    const result = await this.postgres.query(
      `INSERT INTO otp_challenges(phone, code_hash, expires_at, attempts, created_at)
       VALUES ($1, $2, $3, 0, now())
       ON CONFLICT(phone) DO UPDATE SET
         code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at,
         attempts = 0,
         created_at = now()
       WHERE otp_challenges.created_at <= now() - interval '60 seconds'
       RETURNING phone`,
      [phone, codeHash, new Date(Date.now() + 5 * 60_000)],
    );
    if (!result.rowCount)
      throw new AuthFailure(429, "Attendez une minute avant de demander un nouveau code.");

    if (!this.config.devAuth) {
      try {
        await this.config.sendSms!(
          phone,
          `Votre code Pepo : ${code}. Valable 5 minutes. Ne le partagez pas.`,
        );
      } catch {
        await this.postgres.query(
          "DELETE FROM otp_challenges WHERE phone=$1 AND code_hash=$2",
          [phone, codeHash],
        );
        throw new AuthFailure(503, "L’envoi SMS a échoué. Vérifiez le fournisseur et réessayez.");
      }
    }

    return { expiresIn: 300, ...(this.config.devAuth ? { devCode: code } : {}) };
  }

  async verify(input: AuthInput) {
    const token = randomBytes(32).toString("hex");
    const tokenHash = hash(token);
    const expiresAt = Date.now() + 30 * 86_400_000;
    let legacySessionWritten = false;

    try {
      const result = await this.postgres.transaction(async (client) => {
        const challenge = await client.query<{
          code_hash: string;
          attempts: number;
          expires_at: Date;
        }>(
          "SELECT code_hash, attempts, expires_at FROM otp_challenges WHERE phone=$1 FOR UPDATE",
          [input.phone],
        );
        const row = challenge.rows[0];
        if (!row || row.expires_at.getTime() < Date.now() || row.attempts >= 5)
          return { error: "expired" as const };

        if (!secureHashEqual(row.code_hash, hash(input.phone + input.code))) {
          await client.query(
            "UPDATE otp_challenges SET attempts=attempts+1 WHERE phone=$1",
            [input.phone],
          );
          return { error: "wrong" as const };
        }
        await client.query(
          "UPDATE otp_challenges SET attempts=attempts+1 WHERE phone=$1",
          [input.phone],
        );

        const pgUser = await client.query<{ id: string; data: Profile }>(
          "SELECT id, data FROM users WHERE phone=$1 FOR UPDATE",
          [input.phone],
        );
        const legacyProfile = this.store.byPhone(input.phone, input.role);
        const storedProfile = pgUser.rows[0]?.data;
        if (
          pgUser.rows[0] &&
          legacyProfile &&
          pgUser.rows[0].id !== legacyProfile.id
        )
          throw new AuthFailure(
            409,
            "Les profils SQLite et PostgreSQL ne correspondent pas. Relancez la reprise des données avant le basculement.",
          );

        const profile: Profile = legacyProfile || storedProfile || {
          id: id(),
          name: input.name,
          phone: input.phone,
          role: input.role,
          city: input.city,
          rating: 0,
          trips: 0,
          online: false,
          verification: "unverified",
        };
        profile.role = input.role;
        profile.phoneVerified = !this.config.devAuth;

        this.store.atomic(() => {
          this.store.saveUser(profile);
          this.store.db
            .prepare(
              "INSERT INTO sessions(hash,userId,expiresAt,role) VALUES(?,?,?,?)",
            )
            .run(tokenHash, profile.id, expiresAt, input.role);
          legacySessionWritten = true;
        });

        await client.query(
          `INSERT INTO users(id, phone, data)
           VALUES ($1, $2, $3::jsonb)
           ON CONFLICT(phone) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`,
          [profile.id, profile.phone, JSON.stringify(profile)],
        );
        await client.query(
          `INSERT INTO sessions(token_hash, user_id, role, expires_at)
           VALUES ($1, $2, $3, $4)`,
          [tokenHash, profile.id, input.role, new Date(expiresAt)],
        );
        await client.query("DELETE FROM otp_challenges WHERE phone=$1", [input.phone]);
        return { profile };
      });

      if ("error" in result) {
        if (result.error === "wrong")
          throw new AuthFailure(400, "Code incorrect.");
        throw new AuthFailure(400, "Code expiré ou bloqué. Demandez un nouveau code.");
      }
      return { token, profile: result.profile };
    } catch (error) {
      if (legacySessionWritten) {
        this.store.db.prepare("DELETE FROM sessions WHERE hash=?").run(tokenHash);
      }
      throw error;
    }
  }
}

export class AuthFailure extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function secureHashEqual(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function lookupPostgresSession(
  postgres: PostgresService,
  tokenHash: string,
) {
  const result = await postgres.query<{
    user_id: string;
    role: AuthRole;
  }>(
    "SELECT user_id, role FROM sessions WHERE token_hash=$1 AND expires_at>now()",
    [tokenHash],
  );
  const row = result.rows[0];
  return row ? { userId: row.user_id, role: row.role } : undefined;
}

