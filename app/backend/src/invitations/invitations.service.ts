import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Project, User } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import * as C from "@requirements/contracts";
import { Database } from "../database/database.module.js";
import { AccessService } from "../administration/access.service.js";
import { CommandContext, Tx, audit, serialize } from "../common/http.js";
import { loadConfig } from "../common/config.js";
import { hash } from "../auth/auth.service.js";

const include = {
  questions: { orderBy: { questionId: "asc" as const } },
  respondent: {
    include: {
      Response_respondent: {
        include: {
          ResponseDraft_response: true,
          ResponseRevision_response: {
            take: 1,
            orderBy: { number: "desc" as const },
          },
        },
      },
    },
  },
};
type FullInvitation = Prisma.ResponseInvitationGetPayload<{
  include: typeof include;
}>;
function present(i: FullInvitation) {
  const responses = i.respondent.Response_respondent.filter((r) =>
    i.questions.some((q) => q.questionId === r.questionId),
  );
  const submitted = responses.filter(
    (r) => r.ResponseRevision_response.length > 0,
  ).length;
  const draft = responses.some((r) => r.ResponseDraft_response !== null);
  return serialize(C.invitationView, {
    id: i.id,
    label: i.label,
    identity: {
      ...(i.recipientName ? { name: i.recipientName } : {}),
      ...(i.recipientEmail ? { email: i.recipientEmail } : {}),
      ...(i.recipientOrganization
        ? { organization: i.recipientOrganization }
        : {}),
    },
    nonNominal: i.nonNominal,
    questionIds: i.questions.map((q) => q.questionId),
    areaId: i.areaId,
    allowEvidence: i.allowEvidence,
    createdAt: i.createdAt.toISOString(),
    expiresAt: i.expiresAt.toISOString(),
    revokedAt: i.revokedAt?.toISOString() ?? null,
    firstOpenedAt: i.firstOpenedAt?.toISOString() ?? null,
    lockVersion: i.lockVersion,
    submitted,
    total: i.questions.length,
    status: i.revokedAt
      ? "REVOKED"
      : i.expiresAt <= new Date()
        ? "EXPIRED"
        : draft
          ? "DRAFT"
          : submitted === i.questions.length
            ? "SUBMITTED"
            : submitted
              ? "PARTIALLY_SUBMITTED"
              : i.firstOpenedAt
                ? "OPENED"
                : "PENDING",
  });
}
function lifetime(value?: string) {
  const c = loadConfig();
  const now = Date.now();
  const result = value
    ? new Date(value)
    : new Date(now + c.INVITATION_DEFAULT_DAYS * 86400000);
  if (
    !Number.isFinite(result.getTime()) ||
    result.getTime() <= now ||
    result.getTime() > now + c.INVITATION_MAX_DAYS * 86400000
  )
    throw new BadRequestException(
      "El vencimiento debe ser futuro y respetar el máximo de la instalación.",
    );
  return result;
}
function policy(p: Project) {
  const c = loadConfig();
  return serialize(C.invitationPolicyView, {
    allowNonNominal: p.allowNonNominalInvitations,
    expectedVersion: p.lockVersion,
    identityRequirement: c.INVITATION_IDENTITY,
    defaultDays: c.INVITATION_DEFAULT_DAYS,
    maxDays: c.INVITATION_MAX_DAYS,
  });
}
@Injectable()
export class InvitationsService {
  constructor(
    private readonly db: Database,
    private readonly access: AccessService,
  ) {}
  async policy(actor: User, projectId: string) {
    const { project } = await this.access.project(this.db, actor, projectId, [
      "ADMIN",
      "ANALYST",
    ]);
    return policy(project);
  }
  async setPolicy(
    r: CommandContext,
    projectId: string,
    d: z.infer<typeof C.invitationPolicyInput>,
  ) {
    return this.access.mutate(r.actor, projectId, ["ADMIN"], async (tx) => {
      const old = await tx.project.findUniqueOrThrow({
        where: { id: projectId },
      });
      if (old.lockVersion !== d.expectedVersion)
        throw new ConflictException("El proyecto cambió. Actualiza la vista.");
      const next = await tx.project.update({
        where: { id: projectId },
        data: {
          allowNonNominalInvitations: d.allowNonNominal,
          lockVersion: { increment: 1 },
        },
      });
      await audit(
        tx,
        r.actor,
        "INVITATION_POLICY_CHANGED",
        "Project",
        projectId,
        projectId,
        { allowNonNominal: old.allowNonNominalInvitations },
        { allowNonNominal: next.allowNonNominalInvitations },
        r.requestId,
      );
      return policy(next);
    });
  }
  async list(actor: User, projectId: string, page: number) {
    return this.db.$transaction(async (tx) => {
      await this.access.project(tx, actor, projectId, ["ADMIN", "ANALYST"]);
      const where = { projectId, organizationId: actor.organizationId };
      const [total, rows] = await Promise.all([
        tx.responseInvitation.count({ where }),
        tx.responseInvitation.findMany({
          where,
          include,
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: 25,
          skip: (page - 1) * 25,
        }),
      ]);
      return serialize(C.invitationListView, {
        items: rows.map(present),
        page,
        total,
      });
    });
  }
  async create(
    r: CommandContext,
    projectId: string,
    d: C.InvitationCreateInput,
  ) {
    return this.access.mutate(
      r.actor,
      projectId,
      ["ADMIN", "ANALYST"],
      async (tx) => {
        const project = await tx.project.findUniqueOrThrow({
          where: { id: projectId },
        });
        const requirement = loadConfig().INVITATION_IDENTITY;
        if (
          d.nonNominal &&
          (!project.allowNonNominalInvitations || requirement !== "NONE")
        )
          throw new BadRequestException(
            "Las invitaciones no nominales requieren permiso del proyecto y de la instalación.",
          );
        if (
          !d.nonNominal &&
          (((requirement === "NAME" || requirement === "BOTH") &&
            !d.identity.name) ||
            ((requirement === "EMAIL" || requirement === "BOTH") &&
              !d.identity.email))
        )
          throw new BadRequestException(
            "Completa los datos de identidad requeridos por la instalación.",
          );
        const expiresAt = lifetime(d.expiresAt);
        if (
          await tx.responseInvitation.findUnique({
            where: {
              createdById_requestId: {
                createdById: r.actor.id,
                requestId: d.requestId,
              },
            },
          })
        )
          throw new ConflictException(
            "Esta invitación ya fue creada. Consulta la lista; renueva el enlace si lo perdiste.",
          );
        if (
          !(await tx.area.findFirst({
            where: {
              id: d.areaId,
              organizationId: r.actor.organizationId,
              active: true,
            },
          }))
        )
          throw new BadRequestException(
            "Selecciona un área activa de este proyecto.",
          );
        const questions = await tx.question.findMany({
          where: {
            projectId,
            id: { in: d.questionIds },
            publication: "PUBLISHED",
          },
          include: {
            QuestionCondition_child: true,
            QuestionDisposition_question: { where: { revokedAt: null } },
          },
        });
        if (
          questions.length !== d.questionIds.length ||
          questions.some((q) => q.QuestionDisposition_question.length)
        )
          throw new BadRequestException(
            "Selecciona únicamente preguntas publicadas disponibles para responder.",
          );
        if (
          questions.some(
            (q) =>
              q.QuestionCondition_child &&
              !d.questionIds.includes(
                q.QuestionCondition_child.parentQuestionId,
              ),
          )
        )
          throw new BadRequestException(
            "Incluye explícitamente las preguntas de las que dependen las condiciones seleccionadas.",
          );
        const principal = await tx.user.create({
          data: {
            organizationId: r.actor.organizationId,
            username: `invitation-${randomUUID()}`,
            displayName: `Invitación: ${d.label}`,
            invitationOnly: true,
            passwordHash: null,
            isOrganizationAdmin: false,
            mustChangePassword: false,
          },
        });
        const token = randomBytes(32).toString("base64url");
        const invitation = await tx.responseInvitation.create({
          data: {
            organizationId: r.actor.organizationId,
            projectId,
            respondentId: principal.id,
            createdById: r.actor.id,
            requestId: d.requestId,
            label: d.label,
            recipientName: d.identity.name,
            recipientEmail: d.identity.email,
            recipientOrganization: d.identity.organization,
            nonNominal: d.nonNominal,
            areaId: d.areaId,
            allowEvidence: d.allowEvidence,
            tokenHash: hash(token),
            expiresAt,
          },
        });
        await tx.invitationQuestion.createMany({
          data: d.questionIds.map((questionId) => ({
            projectId,
            questionId,
            invitationId: invitation.id,
          })),
        });
        const member = await tx.projectMember.create({
          data: {
            projectId,
            userId: principal.id,
            areaId: d.areaId,
            role: "STAKEHOLDER",
          },
        });
        await tx.questionAssignment.createMany({
          data: d.questionIds.map((questionId) => ({
            projectId,
            questionId,
            projectMemberId: member.id,
            required: false,
          })),
        });
        const result = present(
          await tx.responseInvitation.update({
            where: { id: invitation.id },
            data: { scopeSealed: true },
            include,
          }),
        );
        // No raw token, URL or recipient contact details in the audit payload.
        await audit(
          tx,
          r.actor,
          "INVITATION_CREATED",
          "ResponseInvitation",
          invitation.id,
          projectId,
          null,
          {
            invitationId: invitation.id,
            questionIds: d.questionIds,
            areaId: d.areaId,
            nonNominal: d.nonNominal,
            allowEvidence: d.allowEvidence,
            expiresAt: expiresAt.toISOString(),
          },
          d.requestId,
        );
        return serialize(C.invitationLinkView, {
          invitation: result,
          url: `${loadConfig().APP_ORIGIN}/invite#${token}`,
        });
      },
    );
  }
  private async find(
    tx: Tx,
    projectId: string,
    id: string,
    expectedVersion: number,
  ) {
    const i = await tx.responseInvitation.findFirst({
      where: { id, projectId },
      include,
    });
    if (!i) throw new NotFoundException("No se encontró la invitación.");
    if (i.lockVersion !== expectedVersion)
      throw new ConflictException("La invitación cambió. Actualiza la vista.");
    return i;
  }
  async revoke(
    r: CommandContext,
    projectId: string,
    id: string,
    expectedVersion: number,
  ) {
    return this.access.mutate(
      r.actor,
      projectId,
      ["ADMIN", "ANALYST"],
      async (tx) => {
        const old = await this.find(tx, projectId, id, expectedVersion);
        if (old.revokedAt) return present(old);
        const now = new Date();
        await tx.invitationSession.updateMany({
          where: { invitationId: id, revokedAt: null },
          data: { revokedAt: now },
        });
        const next = await tx.responseInvitation.update({
          where: { id },
          data: { revokedAt: now, lockVersion: { increment: 1 } },
          include,
        });
        await audit(
          tx,
          r.actor,
          "INVITATION_REVOKED",
          "ResponseInvitation",
          id,
          projectId,
          null,
          { revokedAt: now.toISOString() },
          r.requestId,
        );
        return present(next);
      },
    );
  }
  async renew(
    r: CommandContext,
    projectId: string,
    id: string,
    d: z.infer<typeof C.invitationRenewInput>,
  ) {
    return this.access.mutate(
      r.actor,
      projectId,
      ["ADMIN", "ANALYST"],
      async (tx) => {
        const old = await this.find(tx, projectId, id, d.expectedVersion);
        if (old.revokedAt)
          throw new ConflictException(
            "Una invitación revocada no puede renovarse.",
          );
        const expiresAt = lifetime(d.expiresAt),
          token = randomBytes(32).toString("base64url");
        await tx.invitationSession.updateMany({
          where: { invitationId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        const next = await tx.responseInvitation.update({
          where: { id },
          data: {
            tokenHash: hash(token),
            expiresAt,
            lockVersion: { increment: 1 },
          },
          include,
        });
        await audit(
          tx,
          r.actor,
          "INVITATION_RENEWED",
          "ResponseInvitation",
          id,
          projectId,
          { expiresAt: old.expiresAt.toISOString() },
          { expiresAt: expiresAt.toISOString(), previousSessionsRevoked: true },
          r.requestId,
        );
        return serialize(C.invitationLinkView, {
          invitation: present(next),
          url: `${loadConfig().APP_ORIGIN}/invite#${token}`,
        });
      },
    );
  }
}
