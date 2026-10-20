import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  Inject,
  Post,
} from "@nestjs/common";
import { z } from "zod";
import { city, phone } from "../runtime";
import { AuthFailure, PostgresAuthService } from "./postgres-auth.service";

const verifyInput = z.object({
  phone,
  code: z.string().regex(/^\d{6}$/),
  name: z.string().trim().min(2).max(80),
  role: z.enum(["passenger", "driver"]),
  city,
});

@Controller("api/auth")
export class PostgresAuthController {
  constructor(@Inject(PostgresAuthService) private readonly auth: PostgresAuthService) {}

  @Post("request")
  async request(@Body() body: unknown) {
    const parsed = z.object({ phone }).safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues[0]?.message || "Numéro invalide.");
    try {
      return await this.auth.requestCode(parsed.data.phone);
    } catch (error) {
      throw mapAuthError(error);
    }
  }

  @Post("verify")
  async verify(@Body() body: unknown) {
    const parsed = verifyInput.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues[0]?.message || "Données de connexion invalides.");
    try {
      return await this.auth.verify(parsed.data);
    } catch (error) {
      throw mapAuthError(error);
    }
  }
}

function mapAuthError(error: unknown) {
  if (error instanceof AuthFailure)
    return new HttpException({ error: error.message }, error.status);
  return new HttpException(
    { error: "Impossible de joindre Pepo. Vérifiez votre connexion et réessayez." },
    503,
  );
}
