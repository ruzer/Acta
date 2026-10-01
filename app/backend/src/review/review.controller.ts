import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
} from "@nestjs/common";
import { z } from "zod";
import * as C from "@requirements/contracts";
import { ActorRequest, SchemaPipe } from "../common/http.js";
import { ReviewService } from "./review.service.js";
import { ReviewReadService } from "./review-read.service.js";
@Controller()
export class ReviewController {
  constructor(
    private readonly service: ReviewService,
    private readonly read: ReviewReadService,
  ) {}
  @Get("review") inbox(
    @Req() r: ActorRequest,
    @Query(new SchemaPipe(C.reviewInboxQuery))
    d: z.infer<typeof C.reviewInboxQuery>,
  ) {
    return this.read.inbox(r.actor, d);
  }
  @Get("projects/:projectId/questions/:id/review") detail(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
  ) {
    return this.read.detail(r.actor, p, q);
  }
  @Get("projects/:projectId/questions/:id/clarifications") personal(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
  ) {
    return this.read.personal(r.actor, p, q);
  }
  @Post("projects/:projectId/questions/:id/review/clarifications/request")
  request(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(C.requestClarificationInput))
    d: z.infer<typeof C.requestClarificationInput>,
  ) {
    return this.service.request(r, p, q, d);
  }
  @Post("projects/:projectId/questions/:id/review/clarifications/reply") reply(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(C.replyClarificationInput))
    d: z.infer<typeof C.replyClarificationInput>,
  ) {
    return this.service.reply(r, p, q, d);
  }
  @Post("projects/:projectId/questions/:id/review/clarifications/close") close(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(C.closeClarificationInput))
    d: z.infer<typeof C.closeClarificationInput>,
  ) {
    return this.service.close(r, p, q, d);
  }
  @Post("projects/:projectId/questions/:id/review/partial") partial(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(C.reviewReasonInput))
    d: z.infer<typeof C.reviewReasonInput>,
  ) {
    return this.service.mark(r, p, q, d, true);
  }
  @Post("projects/:projectId/questions/:id/review/pending") pending(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(C.reviewReasonInput))
    d: z.infer<typeof C.reviewReasonInput>,
  ) {
    return this.service.mark(r, p, q, d, false);
  }
  @Post("projects/:projectId/questions/:id/review/validate") validate(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(C.validateQuestionInput))
    d: z.infer<typeof C.validateQuestionInput>,
  ) {
    return this.service.validate(r, p, q, d);
  }
  @Post("projects/:projectId/questions/:id/review/not-applicable")
  notApplicable(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(C.notApplicableInput))
    d: z.infer<typeof C.notApplicableInput>,
  ) {
    return this.service.notApplicable(r, p, q, d);
  }
  @Post("projects/:projectId/questions/:id/review/reopen") reopen(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(C.reviewReasonInput))
    d: z.infer<typeof C.reviewReasonInput>,
  ) {
    return this.service.reopen(r, p, q, d);
  }
  @Post("projects/:projectId/questions/:id/review/conflicts") conflict(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(C.markConflictInput))
    d: z.infer<typeof C.markConflictInput>,
  ) {
    return this.service.conflict(r, p, q, d);
  }
  @Post("projects/:projectId/questions/:id/review/conflicts/resolve") resolve(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(C.resolveConflictInput))
    d: z.infer<typeof C.resolveConflictInput>,
  ) {
    return this.service.resolve(r, p, q, d);
  }
}
