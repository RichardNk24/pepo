import { Global, Module } from "@nestjs/common";
import { readInfrastructureConfig } from "./config";
import { INFRASTRUCTURE_CONFIG, PostgresService } from "./postgres.service";
import { RedisService } from "./redis.service";

@Global()
@Module({
  providers: [
    { provide: INFRASTRUCTURE_CONFIG, useFactory: () => readInfrastructureConfig() },
    {
      provide: PostgresService,
      useFactory: (config: ReturnType<typeof readInfrastructureConfig>) => new PostgresService(config),
      inject: [INFRASTRUCTURE_CONFIG],
    },
    {
      provide: RedisService,
      useFactory: (config: ReturnType<typeof readInfrastructureConfig>) => new RedisService(config),
      inject: [INFRASTRUCTURE_CONFIG],
    },
  ],
  exports: [INFRASTRUCTURE_CONFIG, PostgresService, RedisService],
})
export class InfrastructureModule {}
