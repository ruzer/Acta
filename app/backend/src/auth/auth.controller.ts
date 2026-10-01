import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { Response } from "express";
import { z } from "zod";
import { loginInput, passwordInput } from "@requirements/contracts";
import { ActorRequest, SchemaPipe } from "../common/http.js";
import { loadConfig } from "../common/config.js";
import { AuthService } from "./auth.service.js";
import { PasswordAllowed, Public } from "./auth.guard.js";
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Get("context")
  context() {
    return this.auth.loginContext();
  }
  @Public()
  @Post("login")
  async login(
    @Body(new SchemaPipe(loginInput)) dto: z.infer<typeof loginInput>,
    @Req() req: ActorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, body } = await this.auth.login(dto, req.ip || "unknown");
    res.cookie("fgeo_session", token, {
      httpOnly: true,
      secure: loadConfig().COOKIE_SECURE === "true",
      sameSite: "lax",
      path: "/",
      maxAge: loadConfig().SESSION_MAX_HOURS * 3600000,
    });
    return body;
  }
  @PasswordAllowed() @Get("me") me(@Req() req: ActorRequest) {
    return this.auth.me(req);
  }
  @PasswordAllowed() @Post("logout") async logout(
    @Req() req: ActorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req);
    res.clearCookie("fgeo_session", {
      path: "/",
      httpOnly: true,
      secure: loadConfig().COOKIE_SECURE === "true",
      sameSite: "lax",
    });
    return { ok: true };
  }
  @PasswordAllowed() @Post("change-password") async password(
    @Body(new SchemaPipe(passwordInput)) dto: z.infer<typeof passwordInput>,
    @Req() req: ActorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.changePassword(req, dto);
    res.clearCookie("fgeo_session", { path: "/" });
    return { ok: true };
  }
}
