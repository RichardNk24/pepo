import { DynamicModule, Module } from "@nestjs/common";
import type { ServerConfig } from "../runtime";
import type { Store } from "../database";
import { PostgresAuthController } from "./postgres-auth.controller";
import { PostgresAuthService } from "./postgres-auth.service";

import { AUTH_CONFIG, AUTH_LEGACY_STORE } from "./postgres-auth.tokens";
export { AUTH_CONFIG, AUTH_LEGACY_STORE } from "./postgres-auth.tokens";

@Module({})
export class PostgresAuthModule {
  static register(config: ServerConfig, store: Store): DynamicModule {
    return {
      module: PostgresAuthModule,
      controllers: [PostgresAuthController],
      providers: [
        { provide: AUTH_CONFIG, useValue: config },
        { provide: AUTH_LEGACY_STORE, useValue: store },
        PostgresAuthService,
      ],
    };
  }
}
