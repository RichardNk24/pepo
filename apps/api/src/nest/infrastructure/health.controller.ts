import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { PostgresService } from "./postgres.service";
import { RedisService } from "./redis.service";

@Controller("health")
export class InfrastructureHealthController {
  constructor(
    @Inject(PostgresService) private readonly postgres: PostgresService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  @Get("live")
  live() {
    return { ok: true, service: "pepo" };
  }

  @Get("ready")
  ready() {
    const dependencies = {
      postgres: this.status(this.postgres.configured, this.postgres.ready),
      redis: this.status(this.redis.configured, this.redis.ready),
    };
    if (Object.values(dependencies).some((item) => item.status === "unavailable")) {
      throw new ServiceUnavailableException({
        ok: false,
        service: "pepo",
        storage: "sqlite-compatibility",
        dependencies,
      });
    }
    return {
      ok: true,
      service: "pepo",
      storage: "sqlite-compatibility",
      dependencies,
    };
  }

  private status(configured: boolean, ready: boolean) {
    return {
      status: !configured ? "not_configured" : ready ? "ready" : "unavailable",
    } as const;
  }
}
