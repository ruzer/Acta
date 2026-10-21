import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
} from "@nestjs/common";
import { Response } from "express";
import { z } from "zod";
import * as C from "@requirements/contracts";
import { ActorRequest, SchemaPipe, serialize } from "../common/http.js";
import { loadConfig } from "../common/config.js";
import {
  invitationAccess,
  unavailableInvitation,
} from "../common/invitation-access.js";
import {
  InvitationExchange,
  InvitationAccess,
  Public,
  BinaryUpload,
} from "../auth/auth.guard.js";
import { InvitationAuthService } from "../auth/invitation-auth.service.js";
import { Database } from "../database/database.module.js";
import { ResponsesService } from "../responses/responses.service.js";
import { EvidenceHttpService } from "../responses/evidence-http.service.js";
import { ReviewReadService } from "../review/review-read.service.js";
import { ReviewService } from "../review/review.service.js";

const cookieOptions = () => ({
  httpOnly: true,
  secure: loadConfig().COOKIE_SECURE === "true",
  sameSite: "strict" as const,
  path: "/api/v1/invitations/access",
});
@InvitationAccess()
@Controller("invitations/access")
export class InvitationResponseController {
  constructor(
    private readonly auth: InvitationAuthService,
    private readonly db: Database,
    private readonly responses: ResponsesService,
    private readonly evidence: EvidenceHttpService,
    private readonly review: ReviewReadService,
    private readonly reviewCommands: ReviewService,
  ) {}
  private async scope(r: ActorRequest) {
    const invitation = await this.db.responseInvitation.findUnique({
      where: { respondentId: r.actor.id },
    });
    if (!invitation) throw unavailableInvitation();
    return invitationAccess(this.db, r.actor, invitation.projectId);
  }
  private async view(r: ActorRequest) {
    const i = await this.scope(r);
    return serialize(C.invitationAccessView, {
      invitationId: i.id,
      csrfToken: r.csrfToken,
      expiresAt: i.expiresAt.toISOString(),
      allowEvidence: i.allowEvidence,
      work: await this.responses.personal(r.actor, i.projectId),
    });
  }
  @Public() @InvitationExchange() @Post("exchange") async exchange(
    @Req() r: ActorRequest,
    @Body(new SchemaPipe(C.invitationExchangeInput))
    d: z.infer<typeof C.invitationExchangeInput>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.exchange(
      d.token,
      r.requestId,
      r.ip || "unknown",
    );
    r.actor = session.actor;
    r.sessionId = session.sessionId;
    r.csrfToken = session.csrfToken;
    const body = await this.view(r);
    res.cookie("acta_invitation_session", session.token, {
      ...cookieOptions(),
      maxAge: session.expiresAt.getTime() - Date.now(),
    });
    return body;
  }
  @Get() get(@Req() r: ActorRequest) {
    return this.view(r);
  }
  @Post("logout") async logout(
    @Req() r: ActorRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.scope(r);
    await this.db.invitationSession.update({
      where: { id: r.sessionId },
      data: { revokedAt: new Date() },
    });
    res.clearCookie("acta_invitation_session", cookieOptions());
    return { ok: true };
  }
  @Get("questions/:id") async question(
    @Req() r: ActorRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.responses.get(r.actor, (await this.scope(r)).projectId, id);
  }
  @Put("questions/:id/draft") async draft(
    @Req() r: ActorRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(C.saveDraftInput)) d: z.infer<typeof C.saveDraftInput>,
  ) {
    return this.responses.save(r, (await this.scope(r)).projectId, id, d);
  }
  @Post("questions/:id/submit") async submit(
    @Req() r: ActorRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(C.responseCommand))
    d: z.infer<typeof C.responseCommand>,
  ) {
    return this.responses.submit(r, (await this.scope(r)).projectId, id, d);
  }
  @Post("questions/:id/evidence/attach") async attach(
    @Req() r: ActorRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(C.evidenceCommand))
    d: z.infer<typeof C.evidenceCommand>,
  ) {
    return this.responses.attachment(
      r,
      (await this.scope(r)).projectId,
      id,
      d,
      false,
    );
  }
  @Post("questions/:id/evidence/remove") async remove(
    @Req() r: ActorRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(C.evidenceCommand))
    d: z.infer<typeof C.evidenceCommand>,
  ) {
    return this.responses.attachment(
      r,
      (await this.scope(r)).projectId,
      id,
      d,
      true,
    );
  }
  @BinaryUpload() @Post("questions/:id/evidence") async upload(
    @Req() r: ActorRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.evidence.stage(r, (await this.scope(r)).projectId, id);
  }
  @Get("evidence/:id/download") async download(
    @Req() r: ActorRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.evidence.download(r, (await this.scope(r)).projectId, id, res);
  }
  @Get("questions/:id/clarifications") async clarifications(
    @Req() r: ActorRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const i = await this.scope(r);
    await this.responses.get(r.actor, i.projectId, id);
    return this.review.personal(r.actor, i.projectId, id);
  }
  @Post("questions/:id/clarifications/reply") async reply(
    @Req() r: ActorRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new SchemaPipe(C.replyClarificationInput))
    d: z.infer<typeof C.replyClarificationInput>,
  ) {
    const i = await this.scope(r);
    await this.responses.get(r.actor, i.projectId, id);
    return this.reviewCommands.reply(r, i.projectId, id, d);
  }
}
