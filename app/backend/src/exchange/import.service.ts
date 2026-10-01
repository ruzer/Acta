import {
  Injectable,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  importConfirmInput,
  importPreviewView,
  importResultView,
} from "@requirements/contracts";
import { Database } from "../database/database.module.js";
import { AccessService } from "../administration/access.service.js";
import { Tx, CommandContext, jsonValue, serialize } from "../common/http.js";
import { inspectTemplate, referenceKey } from "./template.js";
@Injectable()
export class ImportService {
  constructor(
    private readonly db: Database,
    private readonly access: AccessService,
  ) {}
  async authorize(actor: User, p: string) {
    await this.access.project(this.db, actor, p, ["ADMIN", "ANALYST"]);
  }
  private async inspect(tx: Tx, actor: User, p: string, bytes: Buffer) {
    const { project, member } = await this.access.project(tx, actor, p, [
      "ADMIN",
      "ANALYST",
    ]);
    const result = inspectTemplate(bytes),
      errors = [...result.errors],
      warnings: { path: string; message: string }[] = [],
      missingAreas: { code: string; name: string }[] = [];
    const fail = (path: string, message: string) =>
      errors.push({ path, message });
    if (project.lifecycle !== "ACTIVE")
      fail("/project", "Este proyecto está archivado.");
    if (
      (await tx.section.count({ where: { projectId: p } })) ||
      (await tx.question.count({ where: { projectId: p } })) ||
      (await tx.traceabilityReference.count({ where: { projectId: p } })) ||
      (await tx.importBatch.count({ where: { projectId: p } }))
    )
      fail(
        "/project",
        "El proyecto ya contiene estructura. La importación requiere un proyecto vacío.",
      );
    if (result.data) {
      if (result.data.project.externalId !== project.externalId)
        fail(
          "/project/externalId",
          "El identificador del archivo debe coincidir exactamente con este proyecto.",
        );
      const areas = await tx.area.findMany({
        where: {
          organizationId: actor.organizationId,
          code: { in: result.data.areas.map((a) => a.code) },
        },
      });
      result.data.areas.forEach((a, i) => {
        const existing = areas.find((x) => x.code === a.code);
        if (!existing) {
          missingAreas.push(a);
          if (member.role !== "ADMIN")
            fail(
              `/areas/${i}/code`,
              "Esta área no existe. Solicita a administración que la cree antes de importar.",
            );
        } else if (existing.name !== a.name || !existing.active)
          fail(
            `/areas/${i}/name`,
            "El área existente tiene otro nombre o está inactiva. Revisa el catálogo institucional.",
          );
      });
      if (missingAreas.length && member.role === "ADMIN")
        warnings.push({
          path: "/areas",
          message: "Se crearán las áreas faltantes únicamente si lo confirmas.",
        });
    }
    return {
      data: result.data,
      view: serialize(importPreviewView, {
        payloadHash: result.payloadHash,
        expectedProjectVersion: project.lockVersion,
        projectName: result.data?.project.name ?? project.name,
        counts: { ...result.counts, areas: missingAreas.length },
        missingAreas,
        warnings,
        errors,
        canConfirm: errors.length === 0,
      }),
    };
  }
  async preview(actor: User, p: string, bytes: Buffer) {
    return this.db.$transaction(
      async (tx) => (await this.inspect(tx, actor, p, bytes)).view,
      { isolationLevel: "RepeatableRead", timeout: 30000 },
    );
  }
  async confirm(
    req: CommandContext,
    p: string,
    bytes: Buffer,
    cmd: z.infer<typeof importConfirmInput>,
  ) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Project" WHERE id=${p}::uuid AND "organizationId"=${req.actor.organizationId}::uuid FOR UPDATE`;
        const { member, project } = await this.access.project(
          tx,
          req.actor,
          p,
          ["ADMIN", "ANALYST"],
        );
        const parsed = inspectTemplate(bytes);
        if (parsed.payloadHash !== cmd.payloadHash)
          throw new ConflictException(
            "El archivo cambió después de revisarlo. Vuelve a generar la vista previa.",
          );
        const previous = await tx.auditEvent.findFirst({
          where: {
            organizationId: req.actor.organizationId,
            actorId: req.actor.id,
            requestId: cmd.requestId,
            eventIndex: 0,
          },
        });
        if (previous) {
          if (
            previous.projectId !== p ||
            previous.action !== "PROJECT_IMPORTED" ||
            previous.payloadHash !== cmd.payloadHash
          )
            throw new ConflictException(
              "Este requestId ya se utilizó con otro contenido.",
            );
          return serialize(importResultView, previous.result);
        }
        if (project.lockVersion !== cmd.expectedProjectVersion)
          throw new ConflictException(
            "El proyecto cambió. Vuelve a revisar el archivo.",
          );
        const { data: d, view } = await this.inspect(tx, req.actor, p, bytes);
        if (view.errors.length || !d)
          throw new BadRequestException({
            message:
              "No se puede importar. Corrige los errores de la vista previa.",
            fieldErrors: Object.fromEntries(
              view.errors.map((e) => [e.path, e.message]),
            ),
          });
        if (
          view.missingAreas.length &&
          (!cmd.createMissingAreas || member.role !== "ADMIN")
        )
          throw new BadRequestException(
            "Confirma la creación de las áreas faltantes.",
          );
        for (const a of view.missingAreas)
          await tx.area.create({
            data: { organizationId: req.actor.organizationId, ...a },
          });
        const areas = await tx.area.findMany({
          where: {
            organizationId: req.actor.organizationId,
            code: { in: d.areas.map((a) => a.code) },
          },
        });
        const areaIds = new Map(areas.map((a) => [a.code, a.id])),
          sectionIds = new Map(
            d.sections.map((s) => [s.externalId, randomUUID()]),
          ),
          questionIds = new Map(
            d.questions.map((q) => [q.externalId, randomUUID()]),
          ),
          refIds = new Map(
            d.traceabilityReferences.map((r) => [
              referenceKey(r),
              randomUUID(),
            ]),
          );
        await tx.section.createMany({
          data: d.sections.map((s) => ({
            id: sectionIds.get(s.externalId)!,
            projectId: p,
            ...s,
          })),
        });
        if (d.traceabilityReferences.length)
          await tx.traceabilityReference.createMany({
            data: d.traceabilityReferences.map((r) => ({
              id: refIds.get(referenceKey(r))!,
              projectId: p,
              ...r,
            })),
          });
        // Parents are linked after all identities exist; deferred revision FK is satisfied in this transaction.
        await tx.question.createMany({
          data: d.questions.map((q) => ({
            id: questionIds.get(q.externalId)!,
            projectId: p,
            sectionId: sectionIds.get(q.sectionExternalId)!,
            externalId: q.externalId,
            responsibleAreaId: areaIds.get(q.responsibleAreaCode)!,
            priority: q.priority,
            order: q.order,
          })),
        });
        for (const q of d.questions) {
          const id = questionIds.get(q.externalId)!;
          if (q.groupParentExternalId)
            await tx.question.update({
              where: { id },
              data: {
                groupParentId: questionIds.get(q.groupParentExternalId)!,
              },
            });
          const condition = d.conditions.find(
            (c) => c.childQuestionExternalId === q.externalId,
          );
          const snapshot = {
            ...q,
            sectionId: sectionIds.get(q.sectionExternalId),
            responsibleAreaId: areaIds.get(q.responsibleAreaCode),
            groupParentId: q.groupParentExternalId
              ? questionIds.get(q.groupParentExternalId)
              : null,
            condition: condition
              ? {
                  parentQuestionId: questionIds.get(
                    condition.parentQuestionExternalId,
                  ),
                  operator: condition.operator,
                  value: condition.value,
                }
              : null,
            references: q.references.map((r) => ({
              referenceId: refIds.get(referenceKey(r)),
              scopeNote: r.scopeNote ?? "",
            })),
            resolvedReferences: q.references.map((r) => ({
              id: refIds.get(referenceKey(r)),
              ...d.traceabilityReferences.find(
                (x) => referenceKey(x) === referenceKey(r),
              ),
            })),
          };
          const revision = await tx.questionRevision.create({
            data: {
              projectId: p,
              questionId: id,
              number: 1,
              title: q.title,
              question: q.question,
              helpText: q.helpText ?? "",
              type: q.type,
              required: q.required,
              config: q.config ? jsonValue(q.config) : Prisma.JsonNull,
              sourceLocator: q.sourceLocator
                ? jsonValue(q.sourceLocator)
                : Prisma.JsonNull,
              snapshot: jsonValue(snapshot),
              createdById: req.actor.id,
            },
          });
          if (q.options.length)
            await tx.questionOption.createMany({
              data: q.options.map((o) => ({
                projectId: p,
                questionRevisionId: revision.id,
                ...o,
              })),
            });
          if (q.references.length)
            await tx.questionTraceability.createMany({
              data: q.references.map((r) => ({
                projectId: p,
                questionId: id,
                referenceId: refIds.get(referenceKey(r))!,
                scopeNote: r.scopeNote ?? "",
              })),
            });
        }
        if (d.conditions.length)
          await tx.questionCondition.createMany({
            data: d.conditions.map((c) => ({
              projectId: p,
              parentQuestionId: questionIds.get(c.parentQuestionExternalId)!,
              childQuestionId: questionIds.get(c.childQuestionExternalId)!,
              operator: c.operator,
              value: jsonValue(c.value),
            })),
          });
        const updated = await tx.project.update({
          where: { id: p },
          data: {
            name: d.project.name,
            description: d.project.description ?? "",
            lockVersion: { increment: 1 },
          },
        });
        const batch = await tx.importBatch.create({
          data: {
            projectId: p,
            formatVersion: "1.0",
            sourceSha256: cmd.payloadHash,
            importedById: req.actor.id,
            counts: jsonValue(view.counts),
            requestId: cmd.requestId,
          },
        });
        const result = serialize(importResultView, {
          batchId: batch.id,
          projectId: p,
          payloadHash: cmd.payloadHash,
          counts: view.counts,
          projectVersion: updated.lockVersion,
        });
        await tx.auditEvent.create({
          data: {
            organizationId: req.actor.organizationId,
            projectId: p,
            actorId: req.actor.id,
            actorSnapshot: { displayName: req.actor.displayName },
            action: "PROJECT_IMPORTED",
            objectType: "ImportBatch",
            objectId: batch.id,
            requestId: cmd.requestId,
            payloadHash: cmd.payloadHash,
            after: jsonValue({
              counts: view.counts,
              sourceSha256: cmd.payloadHash,
              createdAreas: view.missingAreas.map((a) => a.code),
            }),
            result: jsonValue(result),
          },
        });
        return result;
      },
      { timeout: 60000 },
    );
  }
}
