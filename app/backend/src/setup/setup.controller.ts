import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { z } from "zod";
import { setupCompleteInput, setupVerifyInput } from "@requirements/contracts";
import { ActorRequest, SchemaPipe } from "../common/http.js";
import { Public } from "../auth/auth.guard.js";
import { SetupService } from "./setup.service.js";

/**
 * First-run setup. These routes are public because nobody can sign in yet, but
 * every one of them except the status requires the setup code that only the
 * operator can issue, and none of them works once an administrator exists.
 */
@Public()
@Controller("setup")
export class SetupController {
  constructor(private readonly service: SetupService) {}
  @Get("status") status() {
    return this.service.status();
  }
  @HttpCode(200)
  @Post("verify")
  verify(
    @Req() r: ActorRequest,
    @Body(new SchemaPipe(setupVerifyInput)) d: z.infer<typeof setupVerifyInput>,
  ) {
    return this.service.verify(d.token, r.ip || "unknown");
  }
  @HttpCode(200)
  @Post("checks")
  checks(
    @Req() r: ActorRequest,
    @Body(new SchemaPipe(setupVerifyInput)) d: z.infer<typeof setupVerifyInput>,
  ) {
    return this.service.checks(d.token, r.ip || "unknown");
  }
  @Post("complete") complete(
    @Req() r: ActorRequest,
    @Body(new SchemaPipe(setupCompleteInput))
    d: z.infer<typeof setupCompleteInput>,
  ) {
    return this.service.complete(d, r.ip || "unknown", r.requestId);
  }
}
