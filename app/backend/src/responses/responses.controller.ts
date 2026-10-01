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
  PayloadTooLargeException,
  ServiceUnavailableException,
  BadRequestException,
} from "@nestjs/common";
import { z } from "zod";
import { Response } from "express";
import {
  evidenceCommand,
  responseCommand,
  saveDraftInput,
  stageEvidenceInput,
} from "@requirements/contracts";
import { ActorRequest, SchemaPipe } from "../common/http.js";
import { BinaryUpload } from "../auth/auth.guard.js";
import { ResponsesService } from "./responses.service.js";
import { evidenceLimits } from "./file-validation.js";
@Controller("projects/:projectId")
export class ResponsesController {
  private uploads = 0;
  constructor(private readonly service: ResponsesService) {}
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
    await this.service.authorizeUpload(r.actor, p, q);
    let metadata: unknown;
    try {
      metadata = JSON.parse(
        decodeURIComponent(r.get("x-evidence-metadata") || ""),
      );
    } catch {
      throw new BadRequestException("Faltan los datos del archivo.");
    }
    const d = stageEvidenceInput.parse(metadata),
      limit = evidenceLimits().fileBytes;
    if (Number(r.get("content-length")) > limit)
      throw new PayloadTooLargeException(
        "El archivo excede el tamaño permitido.",
      );
    if (this.uploads >= 2)
      throw new ServiceUnavailableException(
        "Hay otras cargas en proceso. Inténtalo de nuevo.",
      );
    this.uploads++;
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of r) {
        const b = Buffer.from(chunk);
        size += b.length;
        if (size > limit)
          throw new PayloadTooLargeException(
            "El archivo excede el tamaño permitido.",
          );
        chunks.push(b);
      }
      return await this.service.stage(r, p, q, d, Buffer.concat(chunks));
    } finally {
      this.uploads--;
    }
  }
  @Get("evidence/:id/download") async download(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { bytes, evidence } = await this.service.download(r, p, id);
    res.setHeader("Content-Type", evidence.detectedMimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="evidence"; filename*=UTF-8''${encodeURIComponent(evidence.originalName).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16))}`,
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Length", bytes.length);
    res.send(bytes);
  }
}
