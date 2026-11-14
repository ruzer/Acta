import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import type { User, ProjectRole } from "@prisma/client";
import * as C from "@requirements/contracts";
import { Database } from "../database/database.module.js";
import { audit, jsonValue, serialize, type Tx } from "../common/http.js";
import { hashPassword, publicUser } from "../auth/auth.service.js";
import { canonical } from "../responses/response-graph.js";
import { sha256 } from "../responses/storage.js";
import { AccessService } from "./access.service.js";
import { lockAreas } from "./area-rules.js";
import { parseBulkUsers, temporaryPassword } from "./bulk-users.js";

@Injectable()
export class BulkUsersService {
  constructor(
    private readonly db: Database,
    private readonly access: AccessService,
  ) {}

  private async plan(tx: Tx, actor: User, input: C.BulkUsersInput) {
    await this.access.organizationAdmin(tx, actor);
    const parsed = parseBulkUsers(input.text);
    const scope = { organizationId: actor.organizationId };
    const projects = await tx.project.findMany({
      where: {
        ...scope,
        externalId: { in: parsed.rows.map((r) => r.projectCode) },
      },
    });
    const areas = await tx.area.findMany({
      where: {
        ...scope,
        code: { in: parsed.rows.map((r) => r.areaCode).filter(Boolean) },
      },
    });
    const existing = await tx.user.findMany({
      where: { ...scope, username: { in: parsed.rows.map((r) => r.username) } },
      select: { username: true },
    });
    const rows = parsed.rows.map((row) => {
      const project = projects.find((p) => p.externalId === row.projectCode);
      const area = areas.find((a) => a.code === row.areaCode);
      const error = (
        column: "Usuario" | "Proyecto" | "Área",
        message: string,
      ) => parsed.errors.push({ row: row.line, column, message });
      if (existing.some((u) => u.username === row.username))
        error(
          "Usuario",
          "El usuario ya existe en esta institución. Gestiona sus membresías desde la pantalla habitual.",
        );
      if (!project || project.lifecycle !== "ACTIVE")
        error(
          "Proyecto",
          "No se encontró un proyecto activo de esta institución con ese código.",
        );
      if (row.areaCode && (!area || !area.active))
        error(
          "Área",
          "No se encontró un área activa de esta institución con ese código.",
        );
      return {
        ...row,
        projectName: project?.name ?? "",
        areaName: area?.name ?? "",
        projectId: project?.id ?? null,
        areaId: area?.id ?? null,
      };
    });
    const preview = serialize(C.bulkUsersPreview, {
      rows: rows.map(({ projectId: _p, areaId: _a, ...row }) => row),
      errors: parsed.errors,
      users: new Set(rows.map((r) => r.username)).size,
      memberships: rows.length,
      canConfirm: rows.length > 0 && !parsed.errors.length,
      previewHash: sha256(canonical({ rows, errors: parsed.errors })),
    });
    return { rows, preview };
  }

  async preview(actor: User, input: C.BulkUsersInput) {
    return (await this.plan(this.db, actor, input)).preview;
  }

  private async replay(
    tx: Tx,
    actor: User,
    input: C.BulkUsersConfirmInput,
    payloadHash: string,
  ) {
    const prior = await tx.auditEvent.findFirst({
      where: {
        organizationId: actor.organizationId,
        actorId: actor.id,
        requestId: input.requestId,
        eventIndex: 0,
      },
    });
    if (!prior) return null;
    if (
      prior.action !== "USERS_BATCH_CREATED" ||
      prior.payloadHash !== payloadHash
    )
      throw new ConflictException(
        "La solicitud ya se utilizó con otros datos.",
      );
    return {
      ...serialize(C.bulkUsersReceipt, prior.result),
      delivery: "REPLAY" as const,
    };
  }

  private valid(preview: C.BulkUsersPreview, hash: string) {
    if (!preview.canConfirm)
      throw new BadRequestException({
        message: "Revisa las filas indicadas. No se creó ninguna cuenta.",
        fieldErrors: Object.fromEntries(
          preview.errors.map((e) => [`${e.row}.${e.column}`, e.message]),
        ),
      });
    if (preview.previewHash !== hash)
      throw new ConflictException(
        "Los datos cambiaron después de la vista previa. Revisa de nuevo antes de confirmar.",
      );
  }

  async confirm(actor: User, input: C.BulkUsersConfirmInput) {
    await this.access.organizationAdmin(this.db, actor);
    const payloadHash = sha256(
      canonical({ text: input.text, previewHash: input.previewHash }),
    );
    const replay = await this.replay(this.db, actor, input, payloadHash);
    if (replay) return replay;
    const first = await this.plan(this.db, actor, input);
    this.valid(first.preview, input.previewHash);
    const accounts = [
      ...new Map(first.rows.map((r) => [r.username, r])).values(),
    ].sort((a, b) => a.username.localeCompare(b.username));
    const credentials = accounts.map((row) => ({
      username: row.username,
      temporaryPassword: temporaryPassword(),
    }));
    const hashes = new Map<string, string>();
    // Los hashes costosos se calculan fuera de la transacción, como máximo dos a la vez.
    for (let i = 0; i < credentials.length; i += 2)
      await Promise.all(
        credentials
          .slice(i, i + 2)
          .map(async (c) =>
            hashes.set(c.username, await hashPassword(c.temporaryPassword)),
          ),
      );
    return this.db.$transaction(
      async (tx) => {
        const lock = `bulk-users:${actor.organizationId}:${actor.id}:${input.requestId}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))`;
        await this.access.organizationAdmin(tx, actor);
        const repeated = await this.replay(tx, actor, input, payloadHash);
        if (repeated) return repeated;
        for (const id of [
          ...new Set(first.rows.map((r) => r.projectId!)),
        ].sort())
          await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${id}::uuid AND "organizationId"=${actor.organizationId}::uuid FOR UPDATE`;
        await lockAreas(
          tx,
          first.rows.map((r) => r.areaId),
        );
        const plan = await this.plan(tx, actor, input);
        this.valid(plan.preview, input.previewHash);
        const users = [];
        for (const account of accounts) {
          const user = await tx.user.create({
            data: {
              organizationId: actor.organizationId,
              username: account.username,
              displayName: account.displayName,
              passwordHash: hashes.get(account.username)!,
              mustChangePassword: true,
              isOrganizationAdmin: false,
            },
          });
          users.push({
            id: user.id,
            username: user.username,
            displayName: user.displayName,
          });
          await audit(
            tx,
            actor,
            "USER_CREATED",
            "User",
            user.id,
            null,
            null,
            publicUser(user),
          );
        }
        for (const row of plan.rows) {
          const data = {
            projectId: row.projectId!,
            userId: users.find((u) => u.username === row.username)!.id,
            role: row.role as ProjectRole,
            areaId: row.areaId,
            active: true,
          };
          const member = await tx.projectMember.create({ data });
          await audit(
            tx,
            actor,
            "PROJECT_MEMBER_CHANGED",
            "ProjectMember",
            member.id,
            data.projectId,
            null,
            { role: data.role, areaId: data.areaId, active: true },
          );
        }
        const receipt = serialize(C.bulkUsersReceipt, {
          users,
          memberships: plan.rows.length,
        });
        // AuditEvent es inmutable: huella y recibo se insertan juntos, nunca se actualizan.
        await tx.auditEvent.create({
          data: {
            organizationId: actor.organizationId,
            actorId: actor.id,
            actorSnapshot: {
              displayName: actor.displayName,
              username: actor.username,
              identityKind: "ACCOUNT",
            },
            action: "USERS_BATCH_CREATED",
            objectType: "Organization",
            objectId: actor.organizationId,
            requestId: input.requestId,
            eventIndex: 0,
            payloadHash,
            result: jsonValue(receipt),
            after: jsonValue(receipt),
          },
        });
        return serialize(C.bulkUsersResult, {
          ...receipt,
          delivery: "NEW",
          credentials,
        });
      },
      { timeout: 15000 },
    );
  }
}
