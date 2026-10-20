import { Module, type DynamicModule } from "@nestjs/common";
import type { Store } from "../../database";
import { PostgresService } from "../../nest/infrastructure/postgres.service";
import { TripReplicationService } from "./trip-replication.service";

@Module({})
export class TripPersistenceModule {
  static register(store: Store): DynamicModule {
    return {
      module: TripPersistenceModule,
      providers: [{
        provide: TripReplicationService,
        useFactory: (postgres: PostgresService) => new TripReplicationService(store, postgres),
        inject: [PostgresService],
      }],
      exports: [TripReplicationService],
    };
  }
}
