import { ReviewModule } from "../review/review.module.js";
import { InvitationResponseController } from "./invitation-response.controller.js";
import { Module } from "@nestjs/common";
import { InvitationsService } from "./invitations.service.js";
import { InvitationsController } from "./invitations.controller.js";
@Module({
  imports: [ReviewModule],
  providers: [InvitationsService],
  controllers: [InvitationsController, InvitationResponseController],
})
export class InvitationsModule {}
