import { DynamicModule, Module } from "@nestjs/common";
import type { ServerConfig } from "../runtime";
import type { Store } from "../database";
import { PostgresAuthController } from "./postgres-auth.controller";
import { PostgresAuthService } from "./postgres-auth.service";

export const AUTH_CONFIG = Symbol("PEPO_AUTH_CONFIG");
export const AUTH_LEGACY_STORE = Symbol("PEPO_AUTH_LEGACY_STORE");

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
