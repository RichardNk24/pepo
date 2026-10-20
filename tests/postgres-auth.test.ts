import { describe, expect, it } from "vitest";
import { openDatabase } from "../apps/api/src/database";
import { AuthFailure, PostgresAuthService } from "../apps/api/src/auth/postgres-auth.service";
import { hash, type ServerConfig } from "../apps/api/src/runtime";

class FakePostgres {
  challenge?: {
    phone: string;
    code_hash: string;
    attempts: number;
    expires_at: Date;
    created_at: number;
  };
  users = new Map<string, { id: string; data: Record<string, unknown> }>();
  sessions = new Map<string, { user_id: string; role: string; expires_at: Date }>();

  async query(sql: string, values: readonly unknown[] = []) {
    if (sql.startsWith("INSERT INTO otp_challenges")) {
      const [phone, code_hash, expires_at] = values as [string, string, Date];
      if (
        this.challenge &&
        Date.now() - this.challenge.created_at < 60_000
      )
        return { rowCount: 0, rows: [] };
      this.challenge = {
        phone,
        code_hash,
        expires_at,
        attempts: 0,
        created_at: Date.now(),
      };
      return { rowCount: 1, rows: [{ phone }] };
    }
    if (sql.startsWith("DELETE FROM otp_challenges")) {
      const [phone, code_hash] = values as [string, string];
      if (this.challenge?.phone === phone && this.challenge.code_hash === code_hash)
        this.challenge = undefined;
      return { rowCount: 1, rows: [] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  }

  async transaction<T>(work: (client: { query: (...args: any[]) => Promise<any> }) => Promise<T>) {
    const client = {
      query: async (sql: string, values: readonly unknown[] = []) => {
        if (sql.startsWith("SELECT code_hash"))
          return {
            rows: this.challenge ? [{
              code_hash: this.challenge.code_hash,
              attempts: this.challenge.attempts,
              expires_at: this.challenge.expires_at,
            }] : [],
          };
        if (sql.startsWith("UPDATE otp_challenges SET attempts")) {
          if (this.challenge) this.challenge.attempts += 1;
          return { rowCount: 1, rows: [] };
        }
        if (sql.startsWith("SELECT id, data FROM users")) {
          const user = this.users.get(String(values[0]));
          return { rows: user ? [{ id: user.id, data: user.data }] : [] };
        }
        if (sql.startsWith("INSERT INTO users")) {
          const [id, phone, json] = values as [string, string, string];
          this.users.set(phone, { id, data: JSON.parse(json) });
          return { rowCount: 1, rows: [] };
        }
        if (sql.startsWith("INSERT INTO sessions")) {
          const [token_hash, user_id, role, expires_at] = values as [string, string, string, Date];
          this.sessions.set(token_hash, { user_id, role, expires_at });
          return { rowCount: 1, rows: [] };
        }
        if (sql.startsWith("DELETE FROM otp_challenges")) {
          this.challenge = undefined;
          return { rowCount: 1, rows: [] };
        }
        throw new Error(`Unexpected transaction query: ${sql}`);
      },
    };
    return work(client);
  }
}

function setup() {
  const postgres = new FakePostgres();
  const store = openDatabase(":memory:");
  const config: ServerConfig = {
    devAuth: true,
    publicUrl: "http://localhost:4000",
    adminToken: "",
    dataDir: ".",
    corsOrigins: [],
  };
  const service = new PostgresAuthService(
    postgres as never,
    store,
    config,
  );
  return { postgres, store, service };
}

describe("Nest/PostgreSQL authentication cutover", () => {
  it("keeps the current OTP response and mirrors a successful session", async () => {
    const { postgres, store, service } = setup();
    const requested = await service.requestCode("+243999999999");
    expect(requested.expiresIn).toBe(300);
    expect(requested.devCode).toMatch(/^\d{6}$/);

    const result = await service.verify({
      phone: "+243999999999",
      code: requested.devCode!,
      name: "Richard",
      role: "passenger",
      city: "lubumbashi",
    });

    expect(result.profile.name).toBe("Richard");
    expect(postgres.sessions.size).toBe(1);
    expect(store.db.prepare("SELECT hash FROM sessions").all()).toHaveLength(1);
    expect(postgres.challenge).toBeUndefined();
  });

  it("counts a wrong code without creating either session", async () => {
    const { postgres, service, store } = setup();
    await service.requestCode("+243999999999");
    await expect(service.verify({
      phone: "+243999999999",
      code: "000000",
      name: "Richard",
      role: "passenger",
      city: "lubumbashi",
    })).rejects.toMatchObject<AuthFailure>({ status: 400, message: "Code incorrect." });
    expect(postgres.challenge?.attempts).toBe(1);
    expect(postgres.sessions.size).toBe(0);
    expect(store.db.prepare("SELECT hash FROM sessions").all()).toHaveLength(0);
  });

  it("enforces the resend interval and expires old codes", async () => {
    const { postgres, service } = setup();
    const requested = await service.requestCode("+243999999999");
    await expect(service.requestCode("+243999999999"))
      .rejects.toMatchObject({ status: 429 });
    postgres.challenge!.expires_at = new Date(Date.now() - 1);
    await expect(service.verify({
      phone: "+243999999999",
      code: requested.devCode!,
      name: "Richard",
      role: "passenger",
      city: "lubumbashi",
    })).rejects.toMatchObject({ status: 400 });
  });

  it("stores only a token hash and supports the same profile on repeat login", async () => {
    const { postgres, service } = setup();
    const firstCode = await service.requestCode("+243999999999");
    const first = await service.verify({
      phone: "+243999999999",
      code: firstCode.devCode!,
      name: "Richard",
      role: "passenger",
      city: "lubumbashi",
    });
    expect([...postgres.sessions.keys()][0]).toBe(hash(first.token));
    expect([...postgres.sessions.keys()][0]).not.toBe(first.token);

    if (postgres.challenge) postgres.challenge.created_at = Date.now() - 61_000;
    const secondCode = await service.requestCode("+243999999999");
    const second = await service.verify({
      phone: "+243999999999",
      code: secondCode.devCode!,
      name: "A different name",
      role: "passenger",
      city: "kinshasa",
    });
    expect(second.profile.id).toBe(first.profile.id);
    expect(second.profile.name).toBe("Richard");
    expect(postgres.sessions.size).toBe(2);
  });
});
