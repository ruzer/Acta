import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  assetCommandView,
  minimumAccentContrast,
  publicBrandingView,
  settingsInput,
  settingsView,
  storageTestView,
  systemStatusView,
  type BrandingAssetKind,
  type PublicBranding,
} from "@requirements/contracts";
import type { User } from "@prisma/client";
import { Database } from "../database/database.module.js";
import { AccessService } from "../administration/access.service.js";
import { loadConfig, publicBranding } from "../common/config.js";
import { CommandContext, audit, serialize } from "../common/http.js";
import { STORAGE, type StorageProvider } from "../responses/storage.js";
import { evidenceLimits } from "../responses/file-validation.js";
import { importLimits } from "../exchange/limits.js";
import {
  appearanceKeys,
  assertTimezone,
  assetVariables,
  externalValue,
  refuseExternal,
  resolveAppearance,
  type SavedAppearance,
} from "./appearance.js";
import { inspectImage } from "./branding-image.js";

const kindColumn = {
  logo: "LOGO",
  logoSecondary: "LOGO_SECONDARY",
  favicon: "FAVICON",
} as const;
const assetUrl = (kind: BrandingAssetKind, sha256: string) =>
  `/api/v1/configuration/assets/${kind}?v=${sha256.slice(0, 12)}`;
const backendVersion = (() => {
  try {
    const file = new URL("../../package.json", import.meta.url);
    return String(JSON.parse(readFileSync(file, "utf8")).version);
  } catch {
    return "desconocida";
  }
})();

/** A storage check that cannot hang a request. */
async function checked(storage: StorageProvider) {
  try {
    await Promise.race([
      storage.health?.(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 8000).unref(),
      ),
    ]);
    return "ok" as const;
  } catch {
    return "unavailable" as const;
  }
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly db: Database,
    private readonly access: AccessService,
    @Inject(STORAGE) private readonly storage: StorageProvider,
  ) {}

  private configuredOrganization() {
    return this.db.organization.findUnique({
      where: { code: loadConfig().ORGANIZATION_CODE },
      include: {
        settings: true,
        brandingAssets: {
          select: { kind: true, sha256: true, byteSize: true },
        },
      },
    });
  }

  /**
   * What every visitor sees before signing in. Environment values come first,
   * then what an administrator saved, then the product defaults. If the database
   * cannot answer, the environment alone is used: showing the sign-in page never
   * depends on the settings.
   */
  async publicBranding(): Promise<PublicBranding> {
    const base = publicBranding();
    let organization;
    try {
      organization = await this.configuredOrganization();
    } catch {
      return base;
    }
    if (!organization) return base;
    const appearance = resolveAppearance(organization.settings);
    const asset = (kind: BrandingAssetKind) => {
      const external = externalValue(assetVariables[kind]);
      if (external) return external;
      const saved = organization.brandingAssets.find(
        (item) => item.kind === kindColumn[kind],
      );
      return saved ? assetUrl(kind, saved.sha256) : "";
    };
    return serialize(publicBrandingView, {
      appName: appearance.appName.value,
      shortName: appearance.shortName.value,
      organizationName: organization.name,
      logo: asset("logo"),
      logoSecondary: asset("logoSecondary"),
      secondaryName: appearance.secondaryName.value,
      favicon: asset("favicon"),
      accent: appearance.accent.value,
      locale: appearance.locale.value,
      timezone: appearance.timezone.value,
    });
  }

  /** The stored image of a kind, for the public address that serves it. */
  async asset(kind: BrandingAssetKind) {
    const organization = await this.db.organization.findUnique({
      where: { code: loadConfig().ORGANIZATION_CODE },
      select: { id: true },
    });
    const asset = organization
      ? await this.db.brandingAsset.findUnique({
          where: {
            organizationId_kind: {
              organizationId: organization.id,
              kind: kindColumn[kind],
            },
          },
        })
      : null;
    if (!asset || externalValue(assetVariables[kind]))
      throw new NotFoundException("No hay imagen configurada.");
    return {
      contentType: asset.contentType,
      sha256: asset.sha256,
      content: Buffer.from(asset.content),
    };
  }

  private async load(actor: User) {
    const organization = await this.db.organization.findUniqueOrThrow({
      where: { id: actor.organizationId },
      include: {
        settings: true,
        brandingAssets: {
          select: { kind: true, sha256: true, byteSize: true },
        },
      },
    });
    return organization;
  }

  private view(
    organization: Awaited<ReturnType<SettingsService["load"]>>,
  ): z.infer<typeof settingsView> {
    const appearance = resolveAppearance(organization.settings);
    const asset = (kind: BrandingAssetKind) => {
      const variable = assetVariables[kind];
      const external = externalValue(variable);
      if (external)
        return {
          url: external,
          source: "external" as const,
          variable,
          byteSize: null,
        };
      const saved = organization.brandingAssets.find(
        (item) => item.kind === kindColumn[kind],
      );
      return saved
        ? {
            url: assetUrl(kind, saved.sha256),
            source: "saved" as const,
            variable: null,
            byteSize: saved.byteSize,
          }
        : {
            url: "",
            source: "default" as const,
            variable: null,
            byteSize: null,
          };
    };
    return serialize(settingsView, {
      version: organization.settings?.lockVersion ?? 0,
      organizationName: organization.name,
      ...appearance,
      logo: asset("logo"),
      logoSecondary: asset("logoSecondary"),
      favicon: asset("favicon"),
      minimumContrast: minimumAccentContrast,
    });
  }

  async settings(actor: User) {
    await this.access.organizationAdmin(this.db, actor);
    return this.view(await this.load(actor));
  }

  async update(req: CommandContext, input: z.infer<typeof settingsInput>) {
    // Who may ask comes before what is asked: a refusal never reveals how the installation is set up.
    await this.access.organizationAdmin(this.db, req.actor);
    const changes = appearanceKeys.filter((key) => input[key] !== undefined);
    const resets = input.reset ?? [];
    if (changes.some((key) => resets.includes(key)))
      throw new ConflictException(
        "Un valor no puede guardarse y restablecerse a la vez.",
      );
    refuseExternal([...changes, ...resets]);
    if (input.timezone !== undefined) assertTimezone(input.timezone);
    await this.db.$transaction(async (tx) => {
      await this.access.organizationAdmin(tx, req.actor);
      const organizationId = req.actor.organizationId;
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        include: { settings: true },
      });
      const current = organization.settings;
      if ((current?.lockVersion ?? 0) !== input.expectedVersion)
        throw new ConflictException(
          "La configuración cambió mientras la editabas. Actualiza la página e inténtalo de nuevo.",
        );
      const data: SavedAppearance = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (const key of changes) {
        // An emptied optional name is "no name", not an empty choice.
        const value = input[key]! === "" ? null : input[key]!;
        data[key] = value;
        before[key] = current?.[key] ?? null;
        after[key] = value;
      }
      for (const key of resets) {
        data[key] = null;
        before[key] = current?.[key] ?? null;
        after[key] = null;
      }
      if (
        input.organizationName !== undefined &&
        input.organizationName !== organization.name
      ) {
        before.organizationName = organization.name;
        after.organizationName = input.organizationName;
        await tx.organization.update({
          where: { id: organizationId },
          data: { name: input.organizationName },
        });
      }
      if (Object.keys(after).length === 0) return;
      if (current) {
        const done = await tx.organizationSettings.updateMany({
          where: { organizationId, lockVersion: current.lockVersion },
          data: {
            ...data,
            lockVersion: { increment: 1 },
            updatedById: req.actor.id,
          },
        });
        if (done.count !== 1)
          throw new ConflictException(
            "La configuración cambió mientras la editabas. Actualiza la página e inténtalo de nuevo.",
          );
      } else
        await tx.organizationSettings.create({
          data: {
            organizationId,
            ...data,
            lockVersion: 1,
            updatedById: req.actor.id,
          },
        });
      await audit(
        tx,
        req.actor,
        "SETTINGS_UPDATED",
        "Organization",
        organizationId,
        null,
        before,
        after,
        req.requestId,
      );
    });
    return this.view(await this.load(req.actor));
  }

  /** Save or replace an image after checking its bytes. */
  async putAsset(
    req: CommandContext,
    kind: BrandingAssetKind,
    expectedVersion: number,
    bytes: Buffer,
  ) {
    await this.access.organizationAdmin(this.db, req.actor);
    const variable = assetVariables[kind];
    if (externalValue(variable))
      throw new ConflictException({
        message: `${variable} está definida por la infraestructura y no se puede cambiar desde Acta.`,
      });
    const image = inspectImage(kind, bytes);
    await this.db.$transaction(async (tx) => {
      await this.access.organizationAdmin(tx, req.actor);
      const organizationId = req.actor.organizationId;
      await this.bump(tx, req.actor, expectedVersion);
      await tx.brandingAsset.upsert({
        where: {
          organizationId_kind: { organizationId, kind: kindColumn[kind] },
        },
        create: {
          organizationId,
          kind: kindColumn[kind],
          contentType: image.contentType,
          byteSize: image.byteSize,
          sha256: image.sha256,
          content: new Uint8Array(bytes),
          createdById: req.actor.id,
        },
        update: {
          contentType: image.contentType,
          byteSize: image.byteSize,
          sha256: image.sha256,
          content: new Uint8Array(bytes),
          createdById: req.actor.id,
          createdAt: new Date(),
        },
      });
      await audit(
        tx,
        req.actor,
        "BRANDING_ASSET_CHANGED",
        "Organization",
        organizationId,
        null,
        null,
        {
          kind,
          contentType: image.contentType,
          byteSize: image.byteSize,
          sha256: image.sha256,
        },
        req.requestId,
      );
    });
    return this.assetResult(req.actor, kind);
  }

  async removeAsset(
    req: CommandContext,
    kind: BrandingAssetKind,
    expectedVersion: number,
  ) {
    await this.access.organizationAdmin(this.db, req.actor);
    const variable = assetVariables[kind];
    if (externalValue(variable))
      throw new ConflictException({
        message: `${variable} está definida por la infraestructura y no se puede cambiar desde Acta.`,
      });
    await this.db.$transaction(async (tx) => {
      await this.access.organizationAdmin(tx, req.actor);
      const organizationId = req.actor.organizationId;
      const existing = await tx.brandingAsset.findUnique({
        where: {
          organizationId_kind: { organizationId, kind: kindColumn[kind] },
        },
        select: { sha256: true },
      });
      if (!existing) throw new NotFoundException("No hay imagen que quitar.");
      await this.bump(tx, req.actor, expectedVersion);
      await tx.brandingAsset.delete({
        where: {
          organizationId_kind: { organizationId, kind: kindColumn[kind] },
        },
      });
      await audit(
        tx,
        req.actor,
        "BRANDING_ASSET_REMOVED",
        "Organization",
        organizationId,
        null,
        { kind, sha256: existing.sha256 },
        null,
        req.requestId,
      );
    });
    return this.assetResult(req.actor, kind);
  }

  /** Checks the version the editor saw and moves it forward, creating the row on first use. */
  private async bump(
    tx: Parameters<Parameters<Database["$transaction"]>[0]>[0],
    actor: User,
    expectedVersion: number,
  ) {
    const organizationId = actor.organizationId;
    const current = await tx.organizationSettings.findUnique({
      where: { organizationId },
      select: { lockVersion: true },
    });
    if ((current?.lockVersion ?? 0) !== expectedVersion)
      throw new ConflictException(
        "La configuración cambió mientras la editabas. Actualiza la página e inténtalo de nuevo.",
      );
    if (!current) {
      await tx.organizationSettings.create({
        data: { organizationId, lockVersion: 1, updatedById: actor.id },
      });
      return;
    }
    const done = await tx.organizationSettings.updateMany({
      where: { organizationId, lockVersion: expectedVersion },
      data: { lockVersion: { increment: 1 }, updatedById: actor.id },
    });
    if (done.count !== 1)
      throw new ConflictException(
        "La configuración cambió mientras la editabas. Actualiza la página e inténtalo de nuevo.",
      );
  }

  private async assetResult(actor: User, kind: BrandingAssetKind) {
    const view = this.view(await this.load(actor));
    return serialize(assetCommandView, {
      version: view.version,
      asset: view[kind],
    });
  }

  // ------------------------------------------------------------- system
  async system(actor: User) {
    await this.access.organizationAdmin(this.db, actor);
    const config = loadConfig();
    let database: "ok" | "unavailable" = "ok";
    try {
      await this.db.$queryRaw`SELECT 1`;
    } catch {
      database = "unavailable";
    }
    const provider = this.storage.backend === "LOCAL" ? "LOCAL" : "S3";
    let endpointHost = "";
    try {
      if (provider === "S3" && process.env.S3_ENDPOINT)
        endpointHost = new URL(process.env.S3_ENDPOINT).host;
    } catch {
      endpointHost = "";
    }
    const evidence = await this.db.evidence.groupBy({
      by: ["backend"],
      where: { project: { organizationId: actor.organizationId } },
      _count: { _all: true },
    });
    const evidenceLimit = evidenceLimits();
    const origin = new URL(config.APP_ORIGIN);
    return serialize(systemStatusView, {
      version: backendVersion,
      environment: config.NODE_ENV,
      checkedAt: new Date().toISOString(),
      database: { status: database },
      storage: {
        status: await checked(this.storage),
        provider,
        endpointHost,
        bucket: provider === "S3" ? (process.env.S3_BUCKET ?? "") : "",
        region: provider === "S3" ? (process.env.S3_REGION ?? "") : "",
        evidenceByBackend: evidence
          .map((row) => ({ backend: row.backend, files: row._count._all }))
          .sort((a, b) => a.backend.localeCompare(b.backend)),
      },
      security: {
        origin: origin.origin,
        https: origin.protocol === "https:",
        secureCookies: config.COOKIE_SECURE === "true",
        sessionIdleMinutes: config.SESSION_IDLE_MINUTES,
        sessionMaxHours: config.SESSION_MAX_HOURS,
        invitationIdentity: config.INVITATION_IDENTITY,
        invitationDefaultDays: config.INVITATION_DEFAULT_DAYS,
        invitationMaxDays: config.INVITATION_MAX_DAYS,
      },
      limits: {
        evidenceMaxBytes: evidenceLimit.fileBytes,
        evidenceMaxAttachments: evidenceLimit.attachments,
        evidenceProjectBytes: evidenceLimit.projectBytes,
        importMaxBytes: importLimits().IMPORT_MAX_BYTES,
      },
    });
  }

  /** An explicit connection test; it changes nothing but is recorded like any administrative action. */
  async storageTest(req: CommandContext) {
    await this.access.organizationAdmin(this.db, req.actor);
    const status = await checked(this.storage);
    const provider = this.storage.backend === "LOCAL" ? "LOCAL" : "S3";
    await audit(
      this.db,
      req.actor,
      "STORAGE_CONNECTION_TESTED",
      "Storage",
      provider,
      null,
      null,
      { status },
      req.requestId,
    );
    return serialize(storageTestView, {
      status,
      provider,
      checkedAt: new Date().toISOString(),
    });
  }
}
