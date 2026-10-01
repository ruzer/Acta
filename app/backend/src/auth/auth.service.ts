import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  HttpException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import * as argon2 from "argon2";
import { z } from "zod";
import {
  loginInput,
  loginContextView,
  passwordInput,
  meView,
  userView,
} from "@requirements/contracts";
import { Database } from "../database/database.module.js";
import { loadConfig } from "../common/config.js";
import { ActorRequest, audit, serialize } from "../common/http.js";
import { User } from "@prisma/client";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const csrfFor = (token: string) => hash("fgeo-csrf-v1:" + token);
export const equal = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const publicUser = (u: User) =>
  serialize(userView, {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    active: u.active,
    isOrganizationAdmin: u.isOrganizationAdmin,
    mustChangePassword: u.mustChangePassword,
  });
export const hashPassword = (password: string) =>
  argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
const dummyPasswordHash = hashPassword(randomBytes(32).toString("base64url"));
@Injectable()
export class AuthService {
  constructor(private readonly db: Database) {}
  // Trusted installation context. Future host routing belongs here, never in login DTOs.
  private configuredOrganization() {
    return this.db.organization.findUnique({
      where: { code: loadConfig().ORGANIZATION_CODE },
    });
  }
  async loginContext() {
    const organization = await this.configuredOrganization();
    if (!organization)
      throw new ServiceUnavailableException(
        "El acceso no está disponible. Contacta a la administración.",
      );
    return serialize(loginContextView, {
      mode: "single-organization",
      institutionName: organization.name,
    });
  }
  async login(dto: z.infer<typeof loginInput>, ip: string) {
    const accountKeyHash = hash(
      loadConfig().ORGANIZATION_CODE + ":" + dto.username.toLowerCase(),
    );
    const ipKeyHash = hash(ip);
    const since = new Date(Date.now() - 15 * 60 * 1000);
    const attempt = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ipKeyHash}, 0))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${accountKeyHash}, 1))::text`;
      const attempts = await tx.loginAttempt.count({
        where: {
          occurredAt: { gte: since },
          OR: [{ accountKeyHash }, { ipKeyHash }],
          success: false,
        },
      });
      if (attempts >= 10)
        throw new HttpException(
          "Demasiados intentos. Intenta de nuevo más tarde.",
          429,
        );
      return tx.loginAttempt.create({
        data: { accountKeyHash, ipKeyHash, success: false },
      });
    });
    const org = await this.configuredOrganization();
    const user = org
      ? await this.db.user.findUnique({
          where: {
            organizationId_username: {
              organizationId: org.id,
              username: dto.username.toLowerCase(),
            },
          },
        })
      : null;
    const valid = await argon2.verify(
      user?.passwordHash || (await dummyPasswordHash),
      dto.password,
    );
    if (!valid || !user?.active) {
      throw new UnauthorizedException(
        "No fue posible iniciar sesión con esos datos.",
      );
    }
    const token = randomBytes(32).toString("base64url");
    const csrfToken = csrfFor(token);
    const config = loadConfig();
    await this.db.$transaction(async (tx) => {
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      if (!current.active || current.passwordHash !== user.passwordHash)
        throw new UnauthorizedException("No fue posible iniciar sesión.");
      await tx.session.create({
        data: {
          userId: user.id,
          tokenHash: hash(token),
          csrfSecretHash: hash(csrfToken),
          expiresAt: new Date(Date.now() + config.SESSION_MAX_HOURS * 3600000),
        },
      });
      await tx.loginAttempt.update({
        where: { id: attempt.id },
        data: { success: true },
      });
      await audit(tx, user, "LOGIN", "User", user.id, null, null, {
        authenticated: true,
      });
    });
    return {
      token,
      body: serialize(meView, {
        user: publicUser(user),
        organization: { id: org!.id, code: org!.code, name: org!.name },
        csrfToken,
      }),
    };
  }
  async authenticate(token: string) {
    const session = await this.db.session.findUnique({
      where: { tokenHash: hash(token) },
      include: { user: { include: { organization: true } } },
    });
    const now = new Date();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !session.user.active ||
      session.user.organization.code !== loadConfig().ORGANIZATION_CODE ||
      Date.now() - session.lastSeenAt.getTime() >
        loadConfig().SESSION_IDLE_MINUTES * 60000
    )
      throw new UnauthorizedException(
        "Tu sesión terminó. Inicia sesión nuevamente.",
      );
    await this.db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
    return { session, csrfToken: csrfFor(token) };
  }
  async me(req: ActorRequest) {
    const org = await this.db.organization.findUniqueOrThrow({
      where: { id: req.actor.organizationId },
    });
    return serialize(meView, {
      user: publicUser(req.actor),
      organization: { id: org.id, code: org.code, name: org.name },
      csrfToken: req.csrfToken,
    });
  }
  async logout(req: ActorRequest) {
    await this.db.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { id: req.sessionId, userId: req.actor.id },
        data: { revokedAt: new Date() },
      });
      await audit(
        tx,
        req.actor,
        "LOGOUT",
        "Session",
        req.sessionId,
        null,
        null,
        { revoked: true },
        req.requestId,
      );
    });
  }
  async changePassword(req: ActorRequest, dto: z.infer<typeof passwordInput>) {
    if (
      !req.actor.passwordHash ||
      !(await argon2.verify(req.actor.passwordHash, dto.currentPassword))
    )
      throw new ForbiddenException("La contraseña actual no es correcta.");
    if (dto.currentPassword === dto.newPassword)
      throw new ForbiddenException("Elige una contraseña diferente.");
    const passwordHash = await hashPassword(dto.newPassword);
    await this.db.$transaction(async (tx) => {
      const result = await tx.user.updateMany({
        where: {
          id: req.actor.id,
          passwordHash: req.actor.passwordHash,
          active: true,
        },
        data: { passwordHash, mustChangePassword: false },
      });
      if (result.count !== 1)
        throw new UnauthorizedException(
          "La cuenta cambió. Inicia sesión nuevamente.",
        );
      await tx.session.updateMany({
        where: { userId: req.actor.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await audit(
        tx,
        req.actor,
        "PASSWORD_CHANGED",
        "User",
        req.actor.id,
        null,
        { mustChangePassword: req.actor.mustChangePassword },
        { mustChangePassword: false },
        req.requestId,
      );
    });
  }
}
