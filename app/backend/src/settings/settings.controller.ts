import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  PayloadTooLargeException,
  PipeTransform,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import {
  assetRemoveInput,
  brandingAssetKind,
  brandingAssetLimits,
  settingsInput,
  type BrandingAssetKind,
} from "@requirements/contracts";
import { ActorRequest, SchemaPipe } from "../common/http.js";
import { BinaryUpload, Public } from "../auth/auth.guard.js";
import { SettingsService } from "./settings.service.js";

class KindPipe implements PipeTransform<string, BrandingAssetKind> {
  transform(value: string) {
    const kind = brandingAssetKind.safeParse(value);
    if (!kind.success) throw new BadRequestException("Imagen no válida.");
    return kind.data;
  }
}
async function readBody(r: ActorRequest, limit: number) {
  if (Number(r.get("content-length")) > limit)
    throw new PayloadTooLargeException(
      `El archivo es demasiado grande: el máximo es ${Math.round(limit / 1024)} KB.`,
    );
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of r) {
    const part = Buffer.from(chunk);
    size += part.length;
    if (size > limit)
      throw new PayloadTooLargeException(
        `El archivo es demasiado grande: el máximo es ${Math.round(limit / 1024)} KB.`,
      );
    chunks.push(part);
  }
  return Buffer.concat(chunks);
}

/** Administration: every route requires an active organization administrator. */
@Controller()
export class SettingsController {
  constructor(private readonly service: SettingsService) {}
  @Get("settings") settings(@Req() r: ActorRequest) {
    return this.service.settings(r.actor);
  }
  @Post("settings") update(
    @Req() r: ActorRequest,
    @Body(new SchemaPipe(settingsInput)) d: z.infer<typeof settingsInput>,
  ) {
    return this.service.update(r, d);
  }
  @BinaryUpload() @Post("settings/assets/:kind") async upload(
    @Req() r: ActorRequest,
    @Param("kind", new KindPipe()) kind: BrandingAssetKind,
    @Headers("x-expected-version") expected: string | undefined,
  ) {
    const version = Number(expected);
    if (!Number.isSafeInteger(version) || version < 0)
      throw new BadRequestException("Falta la versión de la configuración.");
    const bytes = await readBody(r, brandingAssetLimits[kind].maxBytes);
    return this.service.putAsset(r, kind, version, bytes);
  }
  @Post("settings/assets/:kind/remove") remove(
    @Req() r: ActorRequest,
    @Param("kind", new KindPipe()) kind: BrandingAssetKind,
    @Body(new SchemaPipe(assetRemoveInput))
    d: z.infer<typeof assetRemoveInput>,
  ) {
    return this.service.removeAsset(r, kind, d.expectedVersion);
  }
  @Get("system") system(@Req() r: ActorRequest) {
    return this.service.system(r.actor);
  }
  @Post("system/storage-test") storageTest(
    @Req() r: ActorRequest,
    @Body(new SchemaPipe(z.strictObject({}))) _: object,
  ) {
    return this.service.storageTest(r);
  }
}

/** The only unauthenticated routes: what the sign-in page needs to look like the installation. */
@Controller("configuration")
export class PublicConfigurationController {
  constructor(private readonly service: SettingsService) {}
  @Public() @Get("public") branding() {
    return this.service.publicBranding();
  }
  @Public() @Get("assets/:kind") async asset(
    @Param("kind", new KindPipe()) kind: BrandingAssetKind,
    @Res() res: Response,
  ) {
    const asset = await this.service.asset(kind);
    res.setHeader("Content-Type", asset.contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    // The address carries the content version, but a replaced image must show on the next visit.
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("ETag", `"${asset.sha256}"`);
    res.send(asset.content);
  }
}
