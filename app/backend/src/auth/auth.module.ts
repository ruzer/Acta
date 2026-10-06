import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { InvitationAuthService } from "./invitation-auth.service.js";
import { AuthService } from "./auth.service.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthController } from "./auth.controller.js";
@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    InvitationAuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, InvitationAuthService],
})
export class AuthModule {}
