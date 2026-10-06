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
import { z } from "zod";
import { Response } from "express";
import {
  evidenceCommand,
  responseCommand,
  saveDraftInput,
} from "@requirements/contracts";
import { ActorRequest, SchemaPipe } from "../common/http.js";
import { BinaryUpload } from "../auth/auth.guard.js";
import { ResponsesService } from "./responses.service.js";
import { EvidenceHttpService } from "./evidence-http.service.js";
@Controller("projects/:projectId")
export class ResponsesController {
  constructor(
    private readonly service: ResponsesService,
    private readonly evidence: EvidenceHttpService,
  ) {}
  @Get("my-work") personal(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
  ) {
    return this.service.personal(r.actor, p);
  }
  @Get("questions/:id/response") get(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
  ) {
    return this.service.get(r.actor, p, q);
  }
  @Get("questions/:id/response/draft") draft(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
  ) {
    return this.service.get(r.actor, p, q);
  }
  @Put("questions/:id/response/draft") save(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(saveDraftInput)) d: z.infer<typeof saveDraftInput>,
  ) {
    return this.service.save(r, p, q, d);
  }
  @Post("questions/:id/response/submit") submit(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(responseCommand)) d: z.infer<typeof responseCommand>,
  ) {
    return this.service.submit(r, p, q, d);
  }
  @Post("questions/:id/response/evidence/attach") attach(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(evidenceCommand)) d: z.infer<typeof evidenceCommand>,
  ) {
    return this.service.attachment(r, p, q, d, false);
  }
  @Post("questions/:id/response/evidence/remove") remove(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
    @Body(new SchemaPipe(evidenceCommand)) d: z.infer<typeof evidenceCommand>,
  ) {
    return this.service.attachment(r, p, q, d, true);
  }
  @BinaryUpload() @Post("questions/:id/evidence") async stage(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) q: string,
  ) {
    return this.evidence.stage(r, p, q);
  }
  @Get("evidence/:id/download") async download(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.evidence.download(r, p, id, res);
  }
}
