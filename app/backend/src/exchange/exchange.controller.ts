import { importLimits } from "./limits.js";
import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  BadRequestException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Response } from "express";
import { z } from "zod";
import * as C from "@requirements/contracts";
import { ActorRequest, SchemaPipe } from "../common/http.js";
import { BinaryUpload } from "../auth/auth.guard.js";
import { ImportService } from "./import.service.js";
import { ExportService } from "./export.service.js";
import { VisibilityService } from "../visibility/visibility.service.js";
@Controller("projects/:projectId")
export class ExchangeController {
  private uploads = 0;
  constructor(
    private readonly imports: ImportService,
    private readonly exports: ExportService,
    private readonly visibility: VisibilityService,
  ) {}
  @Get("dashboard") dashboard(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
  ) {
    return this.visibility.dashboard(r.actor, p);
  }
  @Get("traceability") traceability(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
  ) {
    return this.visibility.traceability(r.actor, p);
  }
  @Get("history") history(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Query(new SchemaPipe(C.historyQuery)) d: z.infer<typeof C.historyQuery>,
  ) {
    return this.visibility.history(r.actor, p, d);
  }
  private async upload(
    r: ActorRequest,
    p: string,
    work: (bytes: Buffer) => Promise<unknown>,
  ) {
    await this.imports.authorize(r.actor, p);
    const limit = importLimits().IMPORT_MAX_BYTES;
    if (Number(r.get("content-length")) > limit)
      throw new PayloadTooLargeException("El archivo supera 5 MiB.");
    if (this.uploads >= 2)
      throw new ServiceUnavailableException(
        "Hay otras importaciones en proceso. Inténtalo de nuevo.",
      );
    this.uploads++;
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of r) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > limit)
          throw new PayloadTooLargeException("El archivo supera 5 MiB.");
        chunks.push(bytes);
      }
      return await work(Buffer.concat(chunks));
    } finally {
      this.uploads--;
    }
  }
  @BinaryUpload() @Post("imports/preview") preview(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
  ) {
    return this.upload(r, p, (bytes) =>
      this.imports.preview(r.actor, p, bytes),
    );
  }
  @BinaryUpload() @Post("imports/confirm") confirm(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
  ) {
    let input: unknown;
    try {
      input = JSON.parse(decodeURIComponent(r.get("x-import-command") ?? ""));
    } catch {
      throw new BadRequestException("Falta la confirmación de importación.");
    }
    const command = C.importConfirmInput.parse(input);
    return this.upload(r, p, (bytes) =>
      this.imports.confirm(r, p, bytes, command),
    );
  }
  @Post("exports") async createExport(
    @Req() r: ActorRequest,
    @Param("projectId", ParseUUIDPipe) p: string,
    @Body(new SchemaPipe(C.exportInput)) d: z.infer<typeof C.exportInput>,
    @Res() res: Response,
  ) {
    const file = await this.exports.create(r, p, d);
    res.setHeader("Content-Type", file.mime + "; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.filename}"`,
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(file.content);
  }
}
