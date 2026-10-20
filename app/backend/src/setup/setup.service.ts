import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import {
  setupChecksView,
  setupCompleteInput,
  setupStatusView,
  setupVerifyView,
} from "@requirements/contracts";
import { Database } from "../database/database.module.js";
import { hash, hashPassword } from "../auth/auth.service.js";
import { loadConfig } from "../common/config.js";
import { audit, serialize } from "../common/http.js";
import { STORAGE, type StorageProvider } from "../responses/storage.js";
import {
  appearanceKeys,
  assertTimezone,
  productDefaults,
  refuseExternal,
  resolveAppearance,
  type AppearanceKey,
} from "../settings/appearance.js";
import {
  SETUP_ROW,
  codeIsValid,
  lockInstallation,
  setupIsClosed,
} from "./setup-core.js";

const CLOSED = "La instalación ya está configurada.";
const INVALID_CODE =
  "El código de instalación no es válido o caducó. Pide al operador que genere uno nuevo.";
const FAILURES = 10;
const WINDOW_MS = 15 * 60 * 1000;
/** The placeholder of the sample configuration is not a name worth suggesting. */
const placeholderOrganization = "Example Organization";

@Injectable()
export class SetupService {
  constructor(
    private readonly db: Database,
    @Inject(STORAGE) private readonly storage: StorageProvider,
  ) {}

  private enabled() {
    return loadConfig().SETUP_WIZARD !== "disabled";
  }

  /** Public and deliberately small: whether the wizard exists, nothing about the installation. */
  async status() {
    if (await setupIsClosed(this.db))
      return serialize(setupStatusView, { state: "COMPLETED" });
    return serialize(setupStatusView, {
      state: this.enabled() ? "PENDING" : "DISABLED",
    });
  }

  /**
   * Every wizard call proves the setup code. Wrong codes are counted per
   * network address so the endpoint cannot be probed; a closed or disabled
   * wizard answers the same way whatever code arrives.
   */
  private async authorize(token: string, ip: string) {
    if (!this.enabled()) throw new NotFoundException("No encontrado.");
    if (await setupIsClosed(this.db)) throw new ConflictException(CLOSED);
    const ipKeyHash = hash("setup:" + ip);
    const valid = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ipKeyHash}, 2))::text`;
      const attempts = await tx.loginAttempt.count({
        where: {
          ipKeyHash,
          success: false,
          occurredAt: { gte: new Date(Date.now() - WINDOW_MS) },
        },
      });
      if (attempts >= FAILURES)
        throw new HttpException(
          "Demasiados intentos. Intenta de nuevo más tarde.",
          429,
        );
      const row = await tx.installationSetup.findUnique({
        where: { id: SETUP_ROW },
      });
      // Another request may have completed setup after the initial guard.
      if (row?.state === "COMPLETED") throw new ConflictException(CLOSED);
      const ok = codeIsValid(row, token);
      if (!ok)
        await tx.loginAttempt.create({
          data: {
            accountKeyHash: hash("installation-setup"),
            ipKeyHash,
            success: false,
          },
        });
      return ok;
    });
    if (!valid) throw new ForbiddenException(INVALID_CODE);
  }

  async verify(token: string, ip: string) {
    await this.authorize(token, ip);
    const configured = process.env.ORGANIZATION_NAME?.trim() ?? "";
    return serialize(setupVerifyView, {
      defaults: {
        organizationCode: loadConfig().ORGANIZATION_CODE,
        organizationName:
          configured === placeholderOrganization ? "" : configured,
        appearance: resolveAppearance(null),
      },
    });
  }

  async checks(token: string, ip: string) {
    await this.authorize(token, ip);
    let storage: "ok" | "unavailable" = "ok";
    try {
      await Promise.race([
        this.storage.health?.(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 8000).unref(),
        ),
      ]);
    } catch {
      storage = "unavailable";
    }
    const origin = new URL(loadConfig().APP_ORIGIN);
    return serialize(setupChecksView, {
      database: "ok",
      storage,
      storageProvider: this.storage.backend === "LOCAL" ? "LOCAL" : "S3",
      secureOrigin:
        origin.protocol === "https:" ||
        ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname),
      origin: origin.origin,
    });
  }

  /**
   * Create the organization, its first administrator and the chosen settings in
   * one transaction under the installation lock: either everything exists
   * afterwards or nothing changed, a second call finds the installation closed,
   * and the operator's command-line bootstrap cannot run alongside.
   */
  async complete(
    input: z.infer<typeof setupCompleteInput>,
    ip: string,
    requestId: string,
  ) {
    await this.authorize(input.token, ip);
    const chosen = appearanceKeys.filter(
      (key) => input.appearance[key] !== undefined,
    );
    refuseExternal(chosen);
    if (input.appearance.timezone !== undefined)
      assertTimezone(input.appearance.timezone, "appearance.timezone");
    const passwordHash = await hashPassword(input.administrator.password);
    const config = loadConfig();
    await this.db.$transaction(async (tx) => {
      await lockInstallation(tx);
      if (await setupIsClosed(tx)) throw new ConflictException(CLOSED);
      const row = await tx.installationSetup.findUnique({
        where: { id: SETUP_ROW },
      });
      if (!codeIsValid(row, input.token))
        throw new ForbiddenException(INVALID_CODE);
      const organization = await tx.organization.upsert({
        where: { code: config.ORGANIZATION_CODE },
        create: {
          code: config.ORGANIZATION_CODE,
          name: input.organization.name,
        },
        update: { name: input.organization.name },
      });
      const administrator = await tx.user.create({
        data: {
          organizationId: organization.id,
          username: input.administrator.username.toLowerCase(),
          displayName: input.administrator.displayName,
          passwordHash,
          // The person chose this password just now; there is nothing temporary to replace.
          mustChangePassword: false,
          isOrganizationAdmin: true,
        },
      });
      // A choice equal to the product default is not a choice: it stays "default".
      const saved: Partial<Record<AppearanceKey, string>> = {};
      for (const key of chosen) {
        const value = input.appearance[key]!;
        if (value !== productDefaults[key]) saved[key] = value;
      }
      if (Object.keys(saved).length)
        await tx.organizationSettings.upsert({
          where: { organizationId: organization.id },
          create: {
            organizationId: organization.id,
            ...saved,
            lockVersion: 1,
            updatedById: administrator.id,
          },
          update: { ...saved, updatedById: administrator.id },
        });
      const now = new Date();
      await tx.installationSetup.upsert({
        where: { id: SETUP_ROW },
        create: {
          id: SETUP_ROW,
          state: "COMPLETED",
          completedAt: now,
          completedById: administrator.id,
        },
        update: {
          state: "COMPLETED",
          tokenHash: null,
          tokenIssuedAt: null,
          tokenExpiresAt: null,
          completedAt: now,
          completedById: administrator.id,
        },
      });
      await audit(
        tx,
        administrator,
        "INSTALLATION_BOOTSTRAPPED",
        "User",
        administrator.id,
        null,
        null,
        {
          firstAdministrator: true,
          via: "setup-wizard",
          organizationName: input.organization.name,
          settings: Object.keys(saved),
        },
        requestId,
      );
    });
    return { ok: true as const };
  }
}
