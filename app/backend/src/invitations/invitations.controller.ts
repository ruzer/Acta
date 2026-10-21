import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import * as C from "@requirements/contracts";
import { ActorRequest, SchemaPipe } from "../common/http.js";
import { InvitationsService } from "./invitations.service.js";
@Controller("projects/:projectId/invitations")
export class InvitationsController {
  constructor(private readonly service: InvitationsService) {}
  @Get("policy") policy(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
  ) {
    return this.service.policy(r.actor, p);
  }
  @Put("policy") setPolicy(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(C.invitationPolicyInput))
    d: z.infer<typeof C.invitationPolicyInput>,
  ) {
    return this.service.setPolicy(r, p, d);
  }
  @Get() list(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Query(new SchemaPipe(C.invitationListQuery))
    d: z.infer<typeof C.invitationListQuery>,
  ) {
    return this.service.list(r.actor, p, d.page);
  }
  @Post() create(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(C.invitationCreateInput)) d: C.InvitationCreateInput,
  ) {
    return this.service.create(r, p, d);
  }
  @Post(":id/revoke") revoke(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(C.invitationCommand))
    d: z.infer<typeof C.invitationCommand>,
  ) {
    return this.service.revoke(r, p, id, d.expectedVersion);
  }
  @Post(":id/renew") renew(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(C.invitationRenewInput))
    d: z.infer<typeof C.invitationRenewInput>,
  ) {
    return this.service.renew(r, p, id, d);
  }
}
