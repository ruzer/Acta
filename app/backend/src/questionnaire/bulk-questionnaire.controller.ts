import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import * as C from "@requirements/contracts";
import { ActorRequest, SchemaPipe } from "../common/http.js";
import { BulkQuestionnaireService } from "./bulk-questionnaire.service.js";
@Controller("projects/:projectId/questions/bulk")
export class BulkQuestionnaireController {
  constructor(private readonly service: BulkQuestionnaireService) {}
  @Post("area/preview") areaPreview(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(C.bulkAreaInput)) d: C.BulkAreaInput,
  ) {
    return this.service.preview(r, p, "ASSIGN_AREA", d);
  }
  @Post("area/confirm") areaConfirm(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(C.bulkAreaConfirm))
    d: z.infer<typeof C.bulkAreaConfirm>,
  ) {
    return this.service.confirm(r, p, "ASSIGN_AREA", d);
  }
  @Post("participants/preview") participantsPreview(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(C.bulkParticipantsInput)) d: C.BulkParticipantsInput,
  ) {
    return this.service.preview(r, p, "ADD_PARTICIPANTS", d);
  }
  @Post("participants/confirm") participantsConfirm(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(C.bulkParticipantsConfirm))
    d: z.infer<typeof C.bulkParticipantsConfirm>,
  ) {
    return this.service.confirm(r, p, "ADD_PARTICIPANTS", d);
  }
  @Post("publish/preview") publishPreview(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(C.bulkPublishInput)) d: C.BulkPublishInput,
  ) {
    return this.service.preview(r, p, "PUBLISH", d);
  }
  @Post("publish/confirm") publishConfirm(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(C.bulkPublishConfirm))
    d: z.infer<typeof C.bulkPublishConfirm>,
  ) {
    return this.service.confirm(r, p, "PUBLISH", d);
  }
}
