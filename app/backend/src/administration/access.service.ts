import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { ProjectRole, User } from "@prisma/client";
import { Database } from "../database/database.module.js";
import { invitationAccess } from "../common/invitation-access.js";
import { Tx } from "../common/http.js";
@Injectable()
export class AccessService {
  constructor(private readonly db: Database) {}
  async organizationAdmin(tx: Tx, actor: User) {
    if (actor.invitationOnly)
      throw new ForbiddenException("Esta acción requiere una cuenta.");
    const u = await tx.user.findFirst({
      where: {
        id: actor.id,
        organizationId: actor.organizationId,
        active: true,
        isOrganizationAdmin: true,
      },
    });
    if (!u)
      throw new ForbiddenException(
        "Esta acción requiere administración de la institución.",
      );
    return u;
  }
  async project(tx: Tx, actor: User, projectId: string, roles?: ProjectRole[]) {
    const current = await tx.user.findFirst({
      where: {
        id: actor.id,
        organizationId: actor.organizationId,
        active: true,
      },
    });
    if (!current) throw new ForbiddenException("La cuenta no está activa.");
    const project = await tx.project.findFirst({
      where: { id: projectId, organizationId: actor.organizationId },
    });
    const member = await tx.projectMember.findFirst({
      where: { projectId, userId: actor.id, active: true },
    });
    if (!project || !member)
      throw new NotFoundException(
        "No se encontró el proyecto o no tienes acceso.",
      );
    if (roles && !roles.includes(member.role))
      throw new ForbiddenException("Tu perfil no permite esta acción.");
    const invitation = current.invitationOnly
      ? await invitationAccess(tx, actor, projectId)
      : null;
    if (invitation && member.role !== "STAKEHOLDER")
      throw new ForbiddenException("Invitación no disponible.");
    return { project, member, invitation };
  }
  async membershipAdmin(tx: Tx, actor: User, projectId: string) {
    const project = await tx.project.findFirst({
      where: { id: projectId, organizationId: actor.organizationId },
    });
    if (!project) throw new NotFoundException("No se encontró el proyecto.");
    if (actor.invitationOnly)
      throw new ForbiddenException("Esta acción requiere una cuenta.");
    const u = await tx.user.findFirst({
      where: {
        id: actor.id,
        active: true,
        isOrganizationAdmin: true,
        organizationId: actor.organizationId,
      },
    });
    if (!u) await this.project(tx, actor, projectId, ["ADMIN"]);
    return project;
  }
  async mutate<T>(
    actor: User,
    projectId: string,
    roles: ProjectRole[],
    work: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${projectId}::uuid AND "organizationId"=${actor.organizationId}::uuid FOR UPDATE`;
        const { project } = await this.project(tx, actor, projectId, roles);
        if (project.lifecycle !== "ACTIVE")
          throw new ConflictException("El proyecto está archivado.");
        return work(tx);
      },
      { timeout: 15000 },
    );
  }
}
