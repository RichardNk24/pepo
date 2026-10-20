import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Module,
  Patch,
  Post,
  Req,
  type DynamicModule,
} from "@nestjs/common";
import type { Request } from "express";
import type { Profile } from "@pepo/types/model";
type ActorRequest = Request & { actor: Profile };
import type { Store } from "../database";
import type { ServerConfig } from "../runtime";
import { PostgresService } from "../nest/infrastructure/postgres.service";
import { PremiumService } from "./premium.service";

@Controller("api/premium")
class PremiumController {
  constructor(@Inject(PremiumService) private service: PremiumService) {}
  @Get() status(@Req() req: ActorRequest) {
    return this.service.status(req.actor);
  }
  @Patch("theme") theme(
    @Req() req: ActorRequest,
    @Body() body: { theme?: unknown },
  ) {
    return this.service.theme(req.actor, body?.theme);
  }
  @Post("dev-preview") preview(@Req() req: ActorRequest) {
    return this.service.preview(req.actor);
  }
  @Delete("dev-preview") endPreview(@Req() req: ActorRequest) {
    return this.service.endPreview(req.actor);
  }
  @Get("summary") summary(@Req() req: ActorRequest) {
    return this.service.summary(req.actor);
  }
}
@Module({})
export class PremiumModule {
  static register(store: Store, config: ServerConfig): DynamicModule {
    return {
      module: PremiumModule,
      controllers: [PremiumController],
      providers: [
        {
          provide: PremiumService,
          inject: [PostgresService],
          useFactory: (pg: PostgresService) =>
            new PremiumService(
              pg,
              store,
              config.devAuth &&
                process.env.NODE_ENV !== "production" &&
                process.env.PREMIUM_DEV_PREVIEW === "true",
            ),
        },
      ],
    };
  }
}
