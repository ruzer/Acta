import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import {
  areaInput,
  areaView,
  createUserInput,
  memberInput,
  memberView,
  organizationView,
  projectInput,
  projectView,
} from "@requirements/contracts";
import { User } from "@prisma/client";
import { Database } from "../database/database.module.js";
import { CommandContext, audit, serialize, Tx } from "../common/http.js";
import { hashPassword, publicUser } from "../auth/auth.service.js";
import { AccessService } from "./access.service.js";
import { ResponsesService } from "../responses/responses.service.js";
@Injectable()
export class AdministrationService {
  constructor(
    private readonly db: Database,
    private readonly access: AccessService,
    private readonly responses: ResponsesService,
  ) {}
  async organization(actor: User) {
    const x = await this.db.organization.findUniqueOrThrow({
      where: { id: actor.organizationId },
    });
    return serialize(organizationView, {
      id: x.id,
      code: x.code,
      name: x.name,
    });
  }
  async users(actor: User) {
    await this.access.organizationAdmin(this.db, actor);
    return (
      await this.db.user.findMany({
        where: { organizationId: actor.organizationId, invitationOnly: false },
        orderBy: { displayName: "asc" },
        take: 500,
      })
    ).map(publicUser);
  }
  async createUser(req: CommandContext, d: z.infer<typeof createUserInput>) {
    const passwordHash = await hashPassword(d.temporaryPassword);
    return this.db.$transaction(async (tx) => {
      await this.access.organizationAdmin(tx, req.actor);
      const u = await tx.user.create({
        data: {
          organizationId: req.actor.organizationId,
          username: d.username.toLowerCase(),
          displayName: d.displayName,
          passwordHash,
          mustChangePassword: true,
          isOrganizationAdmin: d.isOrganizationAdmin,
        },
      });
      await audit(
        tx,
        req.actor,
        "USER_CREATED",
        "User",
        u.id,
        null,
        null,
        publicUser(u),
        req.requestId,
      );
      return publicUser(u);
    });
  }
  async setActive(req: CommandContext, id: string, active: boolean) {
    return this.db.$transaction(async (tx) => {
      await this.access.organizationAdmin(tx, req.actor);
      if (id === req.actor.id && !active)
        throw new ConflictException("No puedes desactivar tu propia cuenta.");
      const u = await tx.user.findFirst({
        where: {
          id,
          organizationId: req.actor.organizationId,
          invitationOnly: false,
        },
      });
      if (!u) throw new NotFoundException("No se encontró el usuario.");
      const affected = await tx.projectMember.findMany({
        where: { userId: id },
        select: { projectId: true },
        orderBy: { projectId: "asc" },
      });
      for (const item of affected)
        await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${item.projectId}::uuid FOR UPDATE`;
      const next = await tx.user.update({ where: { id }, data: { active } });
      if (!active)
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      await audit(
        tx,
        req.actor,
        "USER_ACTIVE_CHANGED",
        "User",
        id,
        null,
        { active: u.active },
        { active: next.active },
        req.requestId,
      );
      for (const item of affected)
        await this.responses.recompute(tx, req.actor, item.projectId);
      return { ok: true };
    });
  }
  async resetPassword(req: CommandContext, id: string, password: string) {
    const passwordHash = await hashPassword(password);
    return this.db.$transaction(async (tx) => {
      await this.access.organizationAdmin(tx, req.actor);
      const u = await tx.user.findFirst({
        where: {
          id,
          organizationId: req.actor.organizationId,
          invitationOnly: false,
        },
      });
      if (!u) throw new NotFoundException("No se encontró el usuario.");
      await tx.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
      });
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await audit(
        tx,
        req.actor,
        "TEMPORARY_PASSWORD_SET",
        "User",
        id,
        null,
        null,
        { mustChangePassword: true },
        req.requestId,
      );
      return { ok: true };
    });
  }
  async areas(actor: User) {
    return (
      await this.db.area.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { name: "asc" },
        take: 500,
      })
    ).map((x) =>
      serialize(areaView, {
        id: x.id,
        code: x.code,
        name: x.name,
        active: x.active,
      }),
    );
  }
  async createArea(req: CommandContext, d: z.infer<typeof areaInput>) {
    return this.db.$transaction(async (tx) => {
      await this.access.organizationAdmin(tx, req.actor);
      const x = await tx.area.create({
        data: { organizationId: req.actor.organizationId, ...d },
      });
      const v = serialize(areaView, {
        id: x.id,
        code: x.code,
        name: x.name,
        active: x.active,
      });
      await audit(
        tx,
        req.actor,
        "AREA_CREATED",
        "Area",
        x.id,
        null,
        null,
        v,
        req.requestId,
      );
      return v;
    });
  }
  async projects(actor: User) {
    const ms = await this.db.projectMember.findMany({
      where: {
        userId: actor.id,
        active: true,
        project: { organizationId: actor.organizationId },
      },
      include: { project: true },
    });
    const counts = await this.db.question.groupBy({
      by: ["projectId"],
      where: {
        projectId: { in: ms.map((m) => m.projectId) },
        publication: "PUBLISHED",
        OR: [
          {
            project: {
              ProjectMember_project: {
                some: {
                  userId: actor.id,
                  active: true,
                  role: { in: ["ADMIN", "ANALYST", "VIEWER"] },
                },
              },
            },
          },
          {
            QuestionAssignment_question: {
              some: {
                active: true,
                member: { userId: actor.id, active: true },
              },
            },
          },
        ],
      },
      _count: true,
    });
    return ms.map((m) =>
      serialize(projectView, {
        id: m.project.id,
        externalId: m.project.externalId,
        name: m.project.name,
        description: m.project.description,
        lifecycle: m.project.lifecycle,
        role: m.role,
        lockVersion: m.project.lockVersion,
        questionCount:
          counts.find((c) => c.projectId === m.projectId)?._count || 0,
      }),
    );
  }
  async createProject(req: CommandContext, d: z.infer<typeof projectInput>) {
    return this.db.$transaction(async (tx) => {
      await this.access.organizationAdmin(tx, req.actor);
      const p = await tx.project.create({
        data: { organizationId: req.actor.organizationId, ...d },
      });
      await tx.projectMember.create({
        data: { projectId: p.id, userId: req.actor.id, role: "ADMIN" },
      });
      await audit(
        tx,
        req.actor,
        "PROJECT_CREATED",
        "Project",
        p.id,
        p.id,
        null,
        d,
        req.requestId,
      );
      return serialize(projectView, {
        id: p.id,
        ...d,
        lifecycle: p.lifecycle,
        role: "ADMIN",
        lockVersion: p.lockVersion,
        questionCount: 0,
      });
    });
  }
  async members(actor: User, projectId: string) {
    await this.access.membershipAdmin(this.db, actor, projectId);
    return this.memberList(this.db, projectId);
  }
  async memberList(tx: Tx, projectId: string) {
    const rows = await tx.projectMember.findMany({
      where: { projectId, user: { invitationOnly: false } },
      include: { user: true, area: true },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    return rows.map((m) =>
      serialize(memberView, {
        id: m.id,
        userId: m.userId,
        displayName: m.user.displayName,
        username: m.user.username,
        role: m.role,
        areaId: m.areaId,
        areaName: m.area?.name || null,
        active: m.active,
      }),
    );
  }
  async setMember(
    req: CommandContext,
    projectId: string,
    d: z.infer<typeof memberInput>,
  ) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${projectId}::uuid AND "organizationId"=${req.actor.organizationId}::uuid FOR UPDATE`;
      const p = await this.access.membershipAdmin(tx, req.actor, projectId);
      if (p.lifecycle !== "ACTIVE")
        throw new ConflictException("El proyecto está archivado.");
      const u = await tx.user.findFirst({
        where: {
          id: d.userId,
          invitationOnly: false,
          organizationId: req.actor.organizationId,
          ...(d.active ? { active: true } : {}),
        },
      });
      if (!u)
        throw new NotFoundException(
          "No se encontró un usuario activo de esta institución.",
        );
      if (
        d.areaId &&
        !(await tx.area.findFirst({
          where: {
            id: d.areaId,
            organizationId: req.actor.organizationId,
            active: true,
          },
        }))
      )
        throw new NotFoundException("No se encontró el área.");
      const old = await tx.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: d.userId } },
      });
      if (
        old &&
        (!d.active || d.role !== "STAKEHOLDER") &&
        (await tx.questionAssignment.count({
          where: { projectMemberId: old.id, active: true },
        }))
      )
        throw new ConflictException(
          "Retira primero las asignaciones activas de este participante.",
        );
      const member = await tx.projectMember.upsert({
        where: { projectId_userId: { projectId, userId: d.userId } },
        create: { projectId, ...d },
        update: d,
      });
      await audit(
        tx,
        req.actor,
        "PROJECT_MEMBER_CHANGED",
        "ProjectMember",
        member.id,
        projectId,
        old ? { role: old.role, active: old.active, areaId: old.areaId } : null,
        d,
        req.requestId,
      );
      await this.responses.recompute(tx, req.actor, projectId);
      return (await this.memberList(tx, projectId)).find(
        (m) => m.id === member.id,
      )!;
    });
  }
}
