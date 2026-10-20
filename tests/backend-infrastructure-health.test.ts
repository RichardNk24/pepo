import "reflect-metadata";
import { afterEach, describe, expect, it } from "vitest";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import request from "supertest";
import { ApiModule } from "../apps/api/src/nest/api.module";

describe("Nest API health endpoints", () => {
  let app: Awaited<ReturnType<typeof NestFactory.create>> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("keeps liveness independent of optional local infrastructure", async () => {
    app = await NestFactory.create(
      ApiModule.register({
        devAuth: true,
        publicUrl: "http://localhost:4000",
        adminToken: "",
        dataDir: "data",
        corsOrigins: [],
      }),
      new ExpressAdapter(),
      { logger: ["error"] },
    );
    await app.init();

    await request(app.getHttpServer()).get("/health/live").expect(200).expect({
      ok: true,
      service: "pepo",
    });
    const readiness = await request(app.getHttpServer()).get("/health/ready");
    expect(readiness.status, JSON.stringify(readiness.body)).toBe(200);
    expect(readiness.body.ok).toBe(true);
    expect(readiness.body.storage).toBe("sqlite-compatibility");
    expect(readiness.body.dependencies.postgres.status).toBe("not_configured");
    expect(readiness.body.dependencies.redis.status).toBe("not_configured");
  });
});
