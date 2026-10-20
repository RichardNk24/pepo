import { PremiumModule } from "../premium/premium.module";
import { Controller, DynamicModule, Get, Inject, Module } from "@nestjs/common";
import type { ServerConfig } from "../runtime";
import type { Store } from "../database";
import { PostgresAuthModule } from "../auth/postgres-auth.module";
import { InfrastructureModule } from "./infrastructure/infrastructure.module";
import { InfrastructureHealthController } from "./infrastructure/health.controller";

import { TripPersistenceModule } from "../trips/persistence/trip-persistence.module";

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
  static register(config: ServerConfig, store?: Store): DynamicModule {
    if (config.authPostgresEnabled && !store)
      throw new Error(
        "Le store SQLite de compatibilité est requis pour le cutover Auth.",
      );
    if (process.env.TRIPS_POSTGRES_MIRROR_ENABLED === "true" && !store)
      throw new Error("Le miroir des courses nécessite le store SQLite.");
    return {
      module: ApiModule,
      imports: [
        InfrastructureModule,
        ...(store ? [PremiumModule.register(store, config)] : []),
        ...(process.env.TRIPS_POSTGRES_MIRROR_ENABLED === "true" && store
          ? [TripPersistenceModule.register(store)]
          : []),
        ...(config.authPostgresEnabled && store
          ? [PostgresAuthModule.register(config, store)]
          : []),
      ],
      controllers: [HealthController],
      providers: [{ provide: API_CONFIG, useValue: config }],
    };
  }
}
