import { HttpException, Injectable, Logger } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Database } from "../database/database.module.js";
import { audit } from "../common/http.js";
import { loadConfig } from "../common/config.js";
import {
  bindInvitationActor,
  unavailableInvitation,
} from "../common/invitation-access.js";
import { hash } from "./auth.service.js";

export const invitationCsrf = (token: string) =>
  hash("acta-invitation-csrf-v1:" + token);
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
@Injectable()
export class InvitationAuthService {
  constructor(private readonly db: Database) {}

  private readonly logger = new Logger("InvitationSecurity");

  private async limit(
    category:
      | "exchange-network"
      | "access-network"
      | "exchange"
      | "access"
      | "invalid-exchange"
      | "invalid-access",
    subject: string,
  ) {
    const exchange = category.includes("exchange");
    const windowMs = exchange ? 15 * 60000 : 60000;
    const maximum =
      category === "exchange-network"
        ? 6000
        : category === "access-network"
          ? 24000
          : exchange
            ? 30
            : 240;
    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    // Capability limits apply only after verification. Untrusted values never
    // allocate one bucket per arbitrary token or forwarding header.
    const key = hash(`invitation:${category}:${bucket}:${subject}`);
    const count = await this.db.$transaction(async (tx) => {
      await tx.invitationRateBucket.deleteMany({
        where: { expiresAt: { lt: new Date(now) } },
      });
      return tx.invitationRateBucket.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: new Date((bucket + 1) * windowMs) },
        update: { count: { increment: 1 } },
      });
    });
    // Operational security events are bounded per bucket. No token, identity,
    // IP, header, URL, or request body reaches the logger.
    if (category.startsWith("invalid-") && count.count === 1)
      this.logger.warn({ event: "INVITATION_ACCESS_DENIED", category });
    if (count.count === maximum + 1)
      this.logger.warn({ event: "INVITATION_RATE_LIMITED", category });
    if (count.count > maximum)
      throw new HttpException(
        "Demasiados intentos. Intenta de nuevo más tarde.",
        429,
      );
  }

  async beforeExchange(body: unknown, network: string) {
    await this.limit("exchange-network", network);
    if (
      !body ||
      typeof body !== "object" ||
      !("token" in body) ||
      typeof body.token !== "string" ||
      !tokenPattern.test(body.token) ||
      Object.keys(body).length !== 1
    )
      await this.limit("invalid-exchange", network);
  }

  private async denied(
    category: "exchange" | "access",
    network: string,
  ): Promise<never> {
    await this.limit(`invalid-${category}`, network);
    throw unavailableInvitation();
  }

  async exchange(token: string, requestId: string, network = "internal") {
    if (!tokenPattern.test(token)) return this.denied("exchange", network);
    const config = loadConfig();
    const found = await this.db.responseInvitation.findUnique({
      where: { tokenHash: hash(token) },
    });
    if (!found) return this.denied("exchange", network);
    await this.limit("exchange", found.id);
    const result = await this.db.$transaction(async (tx) => {
      // Same lock as revoke/renew and response writes; never authorize stale links.
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${found.projectId}::uuid FOR UPDATE`;
      const now = new Date();
      const invitation = await tx.responseInvitation.findFirst({
        where: {
          id: found.id,
          tokenHash: hash(token),
          scopeSealed: true,
          revokedAt: null,
          expiresAt: { gt: now },
          organization: { code: config.ORGANIZATION_CODE },
          project: { lifecycle: "ACTIVE" },
          respondent: { active: true, invitationOnly: true },
        },
        include: { respondent: true },
      });
      if (!invitation) return null;
      const sessionToken = randomBytes(32).toString("base64url");
      const expiresAt = new Date(
        Math.min(
          invitation.expiresAt.getTime(),
          Date.now() + config.SESSION_MAX_HOURS * 3600000,
        ),
      );
      const session = await tx.invitationSession.create({
        data: {
          invitationId: invitation.id,
          tokenHash: hash(sessionToken),
          expiresAt,
        },
      });
      if (!invitation.firstOpenedAt) {
        await tx.responseInvitation.update({
          where: { id: invitation.id },
          data: { firstOpenedAt: now },
        });
        await audit(
          tx,
          invitation.respondent,
          "INVITATION_OPENED",
          "ResponseInvitation",
          invitation.id,
          invitation.projectId,
          null,
          { invitationId: invitation.id },
          requestId,
        );
      }
      return {
        token: sessionToken,
        expiresAt,
        invitation,
        actor: bindInvitationActor(invitation.respondent, {
          sessionId: session.id,
          invitationId: invitation.id,
        }),
        sessionId: session.id,
        csrfToken: invitationCsrf(sessionToken),
      };
    });
    if (!result) return this.denied("exchange", network);
    return result;
  }

  async authenticate(token: string, expectedId: string, network: string) {
    await this.limit("access-network", network);
    if (!tokenPattern.test(token)) return this.denied("access", network);
    const now = new Date();
    const session = await this.db.invitationSession.findUnique({
      where: { tokenHash: hash(token) },
      include: {
        invitation: {
          include: { respondent: true, organization: true, project: true },
        },
      },
    });
    const config = loadConfig();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.invitation.id !== expectedId ||
      !session.invitation.scopeSealed ||
      session.invitation.revokedAt ||
      session.invitation.expiresAt <= now ||
      !session.invitation.respondent.active ||
      !session.invitation.respondent.invitationOnly ||
      session.invitation.organization.code !== config.ORGANIZATION_CODE ||
      session.invitation.project.lifecycle !== "ACTIVE"
    )
      return this.denied("access", network);
    await this.limit("access", session.id);
    await this.db.invitationSession.update({
      where: { id: session.id },
      data: { lastSeenAt: now },
    });
    return {
      session,
      actor: bindInvitationActor(session.invitation.respondent, {
        sessionId: session.id,
        invitationId: session.invitationId,
      }),
      csrfToken: invitationCsrf(token),
    };
  }
}
