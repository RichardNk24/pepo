import { describe, expect, it } from "vitest";
import { readInfrastructureConfig } from "../apps/api/src/nest/infrastructure/config";

describe("backend infrastructure configuration", () => {
  it("allows local development to keep running without external services", () => {
    expect(readInfrastructureConfig({})).toEqual({ requireExternal: false });
  });

  it("accepts PostgreSQL and Redis URLs and requires both in strict mode", () => {
    expect(
      readInfrastructureConfig({
        DATABASE_URL: "postgresql://pepo:secret@localhost:5432/pepo",
        REDIS_URL: "rediss://:secret@cache.example:6380",
        REQUIRE_EXTERNAL_INFRA: "true",
      }),
    ).toEqual({
      postgresUrl: "postgresql://pepo:secret@localhost:5432/pepo",
      redisUrl: "rediss://:secret@cache.example:6380",
      requireExternal: true,
    });
  });

  it("rejects malformed URLs and missing strict dependencies", () => {
    expect(() => readInfrastructureConfig({ DATABASE_URL: "http://localhost" })).toThrow(
      "DATABASE_URL doit utiliser postgres: ou postgresql:",
    );
    expect(() => readInfrastructureConfig({ REQUIRE_EXTERNAL_INFRA: "true" })).toThrow(
      "REQUIRE_EXTERNAL_INFRA=true nécessite DATABASE_URL et REDIS_URL",
    );
  });
});
