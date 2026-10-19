import { Controller, DynamicModule, Get, Inject, Module } from "@nestjs/common";
import type { ServerConfig } from "../runtime";
import { InfrastructureModule } from "./infrastructure/infrastructure.module";
import { InfrastructureHealthController } from "./infrastructure/health.controller";

const API_CONFIG = Symbol("PEPO_API_CONFIG");

@Controller("health")
class HealthController {
  constructor(@Inject(API_CONFIG) private readonly config: ServerConfig) {}

  @Get()
  health() {
    return {
      ok: true,
      service: "pepo",
      devAuth: this.config.devAuth,
      maps: Boolean(this.config.googleKey),
    };
  }
}

/** Nest owns the API process; legacy route modules are mounted as a migration bridge. */
@Module({})
export class ApiModule {
  static register(config: ServerConfig): DynamicModule {
    return {
      module: ApiModule,
      imports: [InfrastructureModule],
      controllers: [HealthController],
      providers: [{ provide: API_CONFIG, useValue: config }],
    };
  }
}
