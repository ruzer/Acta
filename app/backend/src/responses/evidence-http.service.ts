import {
  Injectable,
  PayloadTooLargeException,
  ServiceUnavailableException,
  BadRequestException,
} from "@nestjs/common";
import { Response } from "express";
import { stageEvidenceInput } from "@requirements/contracts";
import { ActorRequest } from "../common/http.js";
import { ResponsesService } from "./responses.service.js";
import { evidenceLimits } from "./file-validation.js";
// Both account and invitation routes share admission limits and byte validation.
@Injectable()
export class EvidenceHttpService {
  private uploads = 0;
  constructor(private readonly service: ResponsesService) {}
  async stage(r: ActorRequest, p: string, q: string) {
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
  async download(r: ActorRequest, p: string, id: string, res: Response) {
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
