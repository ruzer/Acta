import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import * as C from "@requirements/contracts";
import { AccessService } from "../administration/access.service.js";
import { CommandContext, Tx, jsonValue, serialize } from "../common/http.js";
import { presentQuestion, questionInclude } from "./questionnaire.service.js";
import { publicationIssues } from "./publication-rules.js";
import { canonical } from "../responses/response-graph.js";
import { sha256 } from "../responses/storage.js";
import { ResponsesService } from "../responses/responses.service.js";
type Input = C.BulkAreaInput | C.BulkParticipantsInput | C.BulkPublishInput;
type Confirm = Input & { previewHash: string };
const roles = ["ADMIN", "ANALYST"] as const;
@Injectable()
export class BulkQuestionnaireService {
  constructor(
    private readonly access: AccessService,
    private readonly responses: ResponsesService,
  ) {}

  preview(
    req: CommandContext,
    projectId: string,
    operation: C.BulkOperation,
    input: Input,
  ) {
    return this.access.mutate(
      req.actor,
      projectId,
      [...roles],
      async (tx) =>
        (await this.plan(tx, req, projectId, operation, input)).preview,
    );
  }

  confirm(
    req: CommandContext,
    projectId: string,
    operation: C.BulkOperation,
    input: Confirm,
  ) {
    return this.access.mutate(req.actor, projectId, [...roles], async (tx) => {
      const payloadHash = sha256(canonical({ projectId, operation, input }));
      const prior = await tx.auditEvent.findFirst({
        where: {
          organizationId: req.actor.organizationId,
          actorId: req.actor.id,
          requestId: input.requestId,
          eventIndex: 0,
        },
      });
      if (prior) {
        if (prior.payloadHash !== payloadHash)
          throw new ConflictException(
            "La solicitud ya se utilizó con otros datos.",
          );
        return serialize(C.bulkResult, prior.result);
      }
      const plan = await this.plan(tx, req, projectId, operation, input);
      if (plan.preview.previewHash !== input.previewHash)
        throw new ConflictException(
          "El cuestionario cambió después de la revisión del lote. Actualiza la información y revisa nuevamente antes de confirmar.",
        );
      if (!plan.preview.canConfirm)
        throw new ConflictException({
          message:
            "El lote no puede aplicarse. Revisa los errores; no se cambió ninguna pregunta.",
          fieldErrors: Object.fromEntries(
            plan.preview.items.flatMap((i) =>
              i.errors.map((e) => [`${i.questionId}.${e.field}`, e.message]),
            ),
          ),
        });
      const ids = plan.preview.items
        .filter((i) => i.state === "READY" || i.state === "WARNING")
        .map((i) => i.questionId);
      const changed = new Set(ids);
      if (operation === "ASSIGN_AREA") {
        await tx.question.updateMany({
          where: { projectId, id: { in: ids } },
          data: {
            responsibleAreaId: (input as C.BulkAreaInput).targetAreaId,
            lockVersion: { increment: 1 },
          },
        });
      } else if (operation === "ADD_PARTICIPANTS") {
        const additions = plan.additions.filter((a) =>
          changed.has(a.questionId),
        );
        const fresh = additions.filter((a) => !a.existingId);
        if (fresh.length)
          await tx.questionAssignment.createMany({
            data: fresh.map((a) => ({
              id: randomUUID(),
              projectId,
              questionId: a.questionId,
              projectMemberId: a.projectMemberId,
              required: a.required,
              active: true,
            })),
          });
        // Existing active assignments are deliberately never updated. Reactivate only the explicitly previewed pairs.
        for (const required of [false, true]) {
          const reactivated = additions
            .filter((a) => a.existingId && a.required === required)
            .map((a) => a.existingId!);
          if (reactivated.length)
            await tx.questionAssignment.updateMany({
              where: { projectId, id: { in: reactivated } },
              data: { active: true, required },
            });
        }
        await tx.question.updateMany({
          where: { projectId, id: { in: ids } },
          data: { lockVersion: { increment: 1 } },
        });
      } else {
        // One write per dependency layer, never one transaction/request per question.
        for (const level of plan.levels) {
          const targets = level.filter((id) => changed.has(id));
          if (targets.length)
            await tx.$executeRaw`UPDATE "Question" SET "publication"='PUBLISHED', "publishedRevisionNumber"="currentRevisionNumber", "lockVersion"="lockVersion"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "projectId"=${projectId}::uuid AND id IN (${Prisma.join(targets.map((id) => Prisma.sql`${id}::uuid`))})`;
        }
      }
      if (operation !== "ASSIGN_AREA")
        await this.responses.recompute(tx, req.actor, projectId);
      const result = serialize(C.bulkResult, {
        operation,
        requestId: input.requestId,
        changedIds: ids,
        ignoredIds: plan.preview.items
          .filter((i) => !changed.has(i.questionId))
          .map((i) => i.questionId),
        newAssignments: plan.preview.counts.newAssignments,
        reactivatedAssignments: plan.preview.counts.reactivatedAssignments,
      });
      await tx.auditEvent.create({
        data: {
          organizationId: req.actor.organizationId,
          actorId: req.actor.id,
          projectId,
          actorSnapshot: {
            username: req.actor.username,
            displayName: req.actor.displayName,
          },
          action: "QUESTIONNAIRE_BATCH_APPLIED",
          objectType: "Project",
          objectId: projectId,
          requestId: input.requestId,
          payloadHash,
          result: jsonValue(result),
          before: jsonValue(
            plan.selected
              .filter((q) => changed.has(q.id))
              .map((q) => ({
                id: q.id,
                responsibleAreaId: q.responsibleAreaId,
                publication: q.publication,
                revisionNumber: q.revisionNumber,
                assignments: q.assignments,
              })),
          ),
          after: jsonValue({
            operation,
            count: ids.length,
            ids,
            ...(operation === "ASSIGN_AREA"
              ? { targetAreaId: (input as C.BulkAreaInput).targetAreaId }
              : operation === "ADD_PARTICIPANTS"
                ? {
                    added: plan.additions.filter((a) =>
                      changed.has(a.questionId),
                    ),
                  }
                : {
                    published: ids.map((id) => ({
                      id,
                      revisionNumber: plan.byId.get(id)!.revisionNumber,
                    })),
                  }),
          }),
        },
      });
      return result;
    });
  }

  private async plan(
    tx: Tx,
    req: CommandContext,
    projectId: string,
    operation: C.BulkOperation,
    input: Input,
  ) {
    const areaInput =
      operation === "ASSIGN_AREA" ? (input as C.BulkAreaInput) : null;
    const participantInput =
      operation === "ADD_PARTICIPANTS"
        ? (input as C.BulkParticipantsInput)
        : null;
    const [rows, sections, areas, refs, members, project] = await Promise.all([
      tx.question.findMany({
        where: { projectId },
        include: questionInclude,
        orderBy: { id: "asc" },
        take: 2001,
      }),
      tx.section.findMany({ where: { projectId }, select: { id: true } }),
      tx.area.findMany({
        where: { organizationId: req.actor.organizationId },
        orderBy: { id: "asc" },
        select: { id: true, name: true, active: true },
      }),
      tx.traceabilityReference.findMany({
        where: { projectId },
        select: { id: true },
      }),
      tx.projectMember.findMany({
        where: { projectId },
        orderBy: { id: "asc" },
        select: {
          id: true,
          role: true,
          active: true,
          userId: true,
          user: { select: { active: true } },
          area: { select: { id: true, active: true } },
        },
      }),
      tx.project.findUniqueOrThrow({
        where: { id: projectId },
        select: { lockVersion: true },
      }),
    ]);
    if (rows.length > 2000)
      throw new BadRequestException(
        "El proyecto supera el alcance de 2.000 preguntas disponible para operaciones masivas.",
      );
    const byId = new Map(rows.map((q) => [q.id, presentQuestion(q)]));
    const selected = input.questions.map((q) => {
      const current = byId.get(q.id);
      if (!current)
        throw new NotFoundException(
          "Una pregunta no está disponible en este proyecto.",
        );
      return current;
    });
    const selectedIds = new Set(selected.map((q) => q.id));
    const areaMap = new Map(areas.map((a) => [a.id, a]));
    if (
      areaInput &&
      (!areaMap.get(areaInput.targetAreaId)?.active ||
        (areaInput.sourceAreaId && !areaMap.has(areaInput.sourceAreaId)))
    )
      throw new BadRequestException(
        "Selecciona áreas disponibles de esta organización; el área destino debe estar activa.",
      );
    const membersById = new Map(members.map((m) => [m.id, m]));
    if (
      participantInput &&
      participantInput.participants.some((p) => {
        const m = membersById.get(p.projectMemberId);
        return (
          !m ||
          m.role !== "STAKEHOLDER" ||
          !m.active ||
          !m.user.active ||
          !m.area?.active
        );
      })
    )
      throw new BadRequestException(
        "Selecciona participantes activos de este proyecto.",
      );
    const publishing = new Set(
      operation === "PUBLISH"
        ? selected.filter((q) => q.publication === "DRAFT").map((q) => q.id)
        : [],
    );
    const context = {
      questions: byId,
      sections: new Set(sections.map((s) => s.id)),
      areas: areaMap,
      references: new Set(refs.map((r) => r.id)),
    };
    const items: C.BulkPreview["items"] = [];
    const dependencies: C.BulkPreview["dependencies"] = [];
    const additions: {
      questionId: string;
      projectMemberId: string;
      required: boolean;
      existingId: string | null;
    }[] = [];
    let existingAssignments = 0;
    for (const q of selected) {
      const item: C.BulkPreview["items"][number] = {
        questionId: q.id,
        title: q.title,
        state: "READY",
        errors: [],
        warnings: [],
      };
      const error = (
        message: string,
        field: string,
        targetId: string | null = null,
      ) => item.errors.push({ message, field, targetId });
      const warning = (message: string, field: string) =>
        item.warnings.push({ message, field, targetId: null });
      if (
        q.lockVersion !==
        input.questions.find((x) => x.id === q.id)!.expectedVersion
      )
        error(
          "Esta pregunta cambió. Actualiza la información antes de continuar.",
          "version",
        );
      if (q.publication === "ARCHIVED")
        error(
          "La pregunta está archivada. Retírala de la selección.",
          "publication",
        );
      if (
        areaInput &&
        (q.responsibleAreaId === areaInput.targetAreaId ||
          (areaInput.sourceAreaId &&
            q.responsibleAreaId !== areaInput.sourceAreaId))
      )
        item.state = "UNCHANGED";
      if (operation === "PUBLISH") {
        if (q.publication === "PUBLISHED") item.state = "ALREADY_PUBLISHED";
        if (q.publication === "DRAFT") {
          item.errors.push(...publicationIssues(q, context, publishing));
          if (!q.assignments.some((a) => a.active))
            warning(
              "Sin participantes asignados: nadie podrá responder todavía. Esto no impide publicar.",
              "assignments",
            );
        }
      }
      if (participantInput) {
        const start = additions.length;
        for (const person of participantInput.participants) {
          const existing = q.assignments.find(
            (a) => a.projectMemberId === person.projectMemberId,
          );
          if (existing?.active) existingAssignments++;
          else
            additions.push({
              questionId: q.id,
              projectMemberId: person.projectMemberId,
              required: person.required,
              existingId: existing?.id ?? null,
            });
          if (existing && !existing.active)
            warning(
              "Se reactivará una asignación inactiva con la obligatoriedad indicada.",
              "assignments",
            );
          const parent = q.condition
            ? byId.get(q.condition.parentQuestionId)
            : undefined;
          if (
            q.condition &&
            (!parent ||
              (!parent.assignments.some(
                (a) => a.active && a.projectMemberId === person.projectMemberId,
              ) &&
                (!selectedIds.has(parent.id) ||
                  parent.publication === "ARCHIVED")))
          )
            error(
              "Asigna también la pregunta de la que depende a este participante.",
              "assignments",
              parent?.id ?? null,
            );
        }
        if (start === additions.length) item.state = "UNCHANGED";
      }
      for (const [kind, parentId] of [
        ["GROUP", q.groupParentId],
        ["CONDITION", q.condition?.parentQuestionId],
      ] as const) {
        if (
          !parentId ||
          operation === "ASSIGN_AREA" ||
          (operation === "ADD_PARTICIPANTS" && kind === "GROUP")
        )
          continue;
        const parent = byId.get(parentId);
        if (parent)
          dependencies.push({
            questionId: q.id,
            dependsOnId: parent.id,
            title: parent.title,
            kind,
            inSelection: selectedIds.has(parent.id),
            publication: parent.publication,
          });
      }
      items.push(item);
    }
    // Combined graph detects publication deadlocks across grouping and conditions.
    const remaining = new Set(publishing),
      levels: string[][] = [];
    while (remaining.size) {
      const level = [...remaining].filter((id) => {
        const q = byId.get(id)!;
        return ![q.groupParentId, q.condition?.parentQuestionId].some(
          (parent) => parent && remaining.has(parent),
        );
      });
      if (!level.length) {
        for (const id of remaining)
          items
            .find((i) => i.questionId === id)!
            .errors.push({
              message:
                "Las dependencias del lote contienen un ciclo. Corrige la agrupación o condición.",
              field: "condition",
              targetId: null,
            });
        break;
      }
      levels.push(level);
      for (const id of level) remaining.delete(id);
    }
    for (const item of items) {
      if (item.errors.length) item.state = "BLOCKED";
      else if (item.state === "READY" && item.warnings.length)
        item.state = "WARNING";
    }
    const relevant = new Set(selectedIds);
    const queue = [...selectedIds];
    for (let i = 0; i < queue.length; i++) {
      const q = byId.get(queue[i]!)!;
      for (const id of [
        q.groupParentId,
        q.condition?.parentQuestionId,
        q.supersedesQuestionId,
      ])
        if (id && byId.has(id) && !relevant.has(id)) {
          relevant.add(id);
          queue.push(id);
        }
    }
    const snapshot = {
      projectId,
      structureVersion: project.lockVersion,
      operation,
      questions: [...relevant].sort().map((id) => {
        const q = byId.get(id)!;
        return { id, version: q.lockVersion };
      }),
      // Administrative changes do not all increment Question.lockVersion.
      areas,
      members,
      references: [...context.references].sort(),
      sections: [...context.sections].sort(),
      command: {
        requestId: input.requestId,
        questions: input.questions,
        ...(areaInput
          ? {
              targetAreaId: areaInput.targetAreaId,
              sourceAreaId: areaInput.sourceAreaId,
            }
          : participantInput
            ? { participants: participantInput.participants }
            : {}),
      },
    };
    const applicable = items.filter(
      (i) => i.state === "READY" || i.state === "WARNING",
    ).length;
    const blocked = items.filter((i) => i.state === "BLOCKED").length;
    const preview = serialize(C.bulkPreview, {
      operation,
      requestId: input.requestId,
      previewHash: sha256(canonical(snapshot)),
      canConfirm: blocked === 0 && applicable > 0,
      counts: {
        selected: items.length,
        applicable,
        blocked,
        ignored: items.length - applicable - blocked,
        warnings: items.reduce((n, i) => n + i.warnings.length, 0),
        newAssignments: additions.filter((a) => !a.existingId).length,
        reactivatedAssignments: additions.filter((a) => a.existingId).length,
        existingAssignments,
      },
      items,
      dependencies,
    });
    return { preview, selected, byId, additions, levels };
  }
}
