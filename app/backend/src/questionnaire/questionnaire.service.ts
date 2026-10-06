import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  assignmentInput,
  editQuestionInput,
  editSectionInput,
  reorderSectionsInput,
  reorderQuestionsInput,
  metadataInput,
  participantView,
  QuestionInput,
  questionnaireView,
  questionView,
  referenceInput,
  referenceView,
  roleLabels,
  sectionInput,
  sectionView,
  typeLabels,
  statusLabels,
} from "@requirements/contracts";
import { Database } from "../database/database.module.js";
import { AccessService } from "../administration/access.service.js";
import { AdministrationService } from "../administration/administration.service.js";
import {
  CommandContext,
  audit,
  jsonValue,
  serialize,
  Tx,
} from "../common/http.js";
import { assertAcyclic, validateQuestion } from "./rules.js";
import { ResponsesService } from "../responses/responses.service.js";
import { publicationIssues } from "./publication-rules.js";
const editorRoles = ["ADMIN", "ANALYST"] as const;
export const questionInclude = {
  QuestionRevision_questionRecord: {
    orderBy: { number: "desc" as const },
    take: 1,
    include: {
      QuestionOption_revision: { orderBy: { order: "asc" as const } },
    },
  },
  QuestionCondition_child: true,
  QuestionTraceability_question: true,
  QuestionAssignment_question: {
    include: {
      member: { select: { user: { select: { invitationOnly: true } } } },
    },
  },
};
type FullQuestion = Prisma.QuestionGetPayload<{
  include: typeof questionInclude;
}>;
export function presentQuestion(q: FullQuestion) {
  const v = q.QuestionRevision_questionRecord[0];
  if (!v) throw new Error("MissingQuestionRevision");
  const c = q.QuestionCondition_child;
  return serialize(questionView, {
    id: q.id,
    externalId: q.externalId,
    sectionId: q.sectionId,
    title: v.title,
    question: v.question,
    helpText: v.helpText,
    type: v.type,
    required: v.required,
    priority: q.priority,
    responsibleAreaId: q.responsibleAreaId,
    order: q.order,
    groupParentId: q.groupParentId,
    supersedesQuestionId: q.supersedesQuestionId,
    config: v.config,
    options: v.QuestionOption_revision.map((o) => ({
      value: o.value,
      label: o.label,
      order: o.order,
    })),
    condition: c
      ? {
          parentQuestionId: c.parentQuestionId,
          operator: c.operator,
          value: c.value,
        }
      : null,
    references: q.QuestionTraceability_question.map((x) => ({
      referenceId: x.referenceId,
      scopeNote: x.scopeNote,
    })),
    publication: q.publication,
    status: q.status,
    lockVersion: q.lockVersion,
    revisionNumber: v.number,
    assignments: q.QuestionAssignment_question.filter(
      (a) => !a.member?.user.invitationOnly,
    ).map((a) => ({
      id: a.id,
      projectMemberId: a.projectMemberId,
      required: a.required,
      active: a.active,
    })),
  });
}
@Injectable()
export class QuestionnaireService {
  constructor(
    private readonly db: Database,
    private readonly access: AccessService,
    private readonly admin: AdministrationService,
    private readonly responses: ResponsesService,
  ) {}
  async editor(actor: User, projectId: string) {
    const { project } = await this.access.project(this.db, actor, projectId, [
      ...editorRoles,
    ]);
    const [sections, questions, refs, areas, members] = await Promise.all([
      this.db.section.findMany({
        where: { projectId },
        orderBy: { order: "asc" },
      }),
      this.db.question.findMany({
        where: { projectId },
        include: questionInclude,
        orderBy: { order: "asc" },
        take: 2000,
      }),
      this.db.traceabilityReference.findMany({
        where: { projectId },
        orderBy: { externalId: "asc" },
        take: 10000,
      }),
      this.admin.areas(actor),
      this.admin.memberList(this.db, projectId),
    ]);
    return serialize(questionnaireView, {
      structureVersion: project.lockVersion,
      sections: sections.map((s) => ({
        id: s.id,
        externalId: s.externalId,
        title: s.title,
        description: s.description,
        order: s.order,
      })),
      questions: questions.map(presentQuestion),
      references: refs.map((x) => ({
        id: x.id,
        type: x.type,
        externalId: x.externalId,
        label: x.label,
        url: x.url,
        priority: x.priority,
        description: x.description,
      })),
      areas,
      members,
    });
  }
  async participant(actor: User, projectId: string) {
    const { project, member } = await this.access.project(
      this.db,
      actor,
      projectId,
    );
    const sections = await this.db.section.findMany({
      where: { projectId },
      orderBy: { order: "asc" },
    });
    const questions = await this.db.question.findMany({
      where: {
        projectId,
        publication: "PUBLISHED",
        ...(member.role === "STAKEHOLDER"
          ? {
              QuestionAssignment_question: {
                some: { projectMemberId: member.id, active: true },
              },
            }
          : {}),
      },
      include: questionInclude,
      orderBy: { order: "asc" },
      take: 2000,
    });
    const presented = questions.map(presentQuestion);
    return serialize(participantView, {
      projectName: project.name,
      roleLabel: roleLabels[member.role],
      phaseNotice:
        "Consulta las preguntas publicadas. Las decisiones vigentes permiten consultar sus fuentes en modo de solo lectura.",
      sections: sections
        .map((s, i) => ({
          key: "seccion-" + i,
          title: s.title,
          questions: presented
            .filter((q) => q.sectionId === s.id)
            .map((q, j) => ({
              key: "pregunta-" + i + "-" + j,
              title: q.title,
              question: q.question,
              helpText: q.helpText,
              typeLabel: typeLabels[q.type],
              statusLabel: statusLabels[q.status],
              reviewQuestionId:
                member.role === "VIEWER"
                  ? q.status === "VALIDATED"
                    ? q.id
                    : null
                  : member.role === "STAKEHOLDER"
                    ? null
                    : q.id,
              conditional: q.condition !== null,
              groupTitle:
                presented.find((parent) => parent.id === q.groupParentId)
                  ?.title || null,
              options: q.options.map((o) => o.label),
            })),
        }))
        .filter((s) => member.role !== "STAKEHOLDER" || s.questions.length > 0),
    });
  }
  async createSection(
    req: CommandContext,
    projectId: string,
    d: z.infer<typeof sectionInput>,
  ) {
    return this.access.mutate(
      req.actor,
      projectId,
      [...editorRoles],
      async (tx) => {
        const x = await tx.section.create({ data: { projectId, ...d } });
        await audit(
          tx,
          req.actor,
          "SECTION_CREATED",
          "Section",
          x.id,
          projectId,
          null,
          d,
          req.requestId,
        );
        return serialize(sectionView, { id: x.id, ...d });
      },
    );
  }
  private structureConflict(): never {
    throw new ConflictException(
      "El cuestionario cambió mientras lo estabas organizando. Actualiza la información e inténtalo nuevamente.",
    );
  }
  private async structureVersion(tx: Tx, projectId: string, expected: number) {
    const p = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    if (p.lockVersion !== expected) this.structureConflict();
  }
  private async advanceStructure(tx: Tx, projectId: string) {
    const p = await tx.project.update({
      where: { id: projectId },
      data: { lockVersion: { increment: 1 } },
    });
    return { structureVersion: p.lockVersion };
  }
  private uniqueIds(ids: string[]) {
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException(
        "La lista contiene identificadores repetidos.",
      );
  }
  async editSection(
    req: CommandContext,
    projectId: string,
    id: string,
    d: z.infer<typeof editSectionInput>,
  ) {
    return this.access.mutate(
      req.actor,
      projectId,
      [...editorRoles],
      async (tx) => {
        const s = await tx.section.findFirst({ where: { id, projectId } });
        if (!s) throw new NotFoundException("No se encontró el tema.");
        await this.structureVersion(tx, projectId, d.expectedVersion);
        if (
          await tx.question.count({
            where: { projectId, sectionId: id, publication: { not: "DRAFT" } },
          })
        )
          throw new ConflictException(
            "Este tema contiene preguntas publicadas o archivadas. Su nombre y descripción están protegidos.",
          );
        const next = await tx.section.update({
          where: { id },
          data: { title: d.title, description: d.description },
        });
        await this.advanceStructure(tx, projectId);
        await audit(
          tx,
          req.actor,
          "SECTION_UPDATED",
          "Section",
          id,
          projectId,
          { title: s.title, description: s.description },
          { title: next.title, description: next.description },
          req.requestId,
        );
        return serialize(sectionView, {
          id,
          externalId: next.externalId,
          title: next.title,
          description: next.description,
          order: next.order,
        });
      },
    );
  }
  async reorderSections(
    req: CommandContext,
    projectId: string,
    d: z.infer<typeof reorderSectionsInput>,
  ) {
    return this.access.mutate(
      req.actor,
      projectId,
      [...editorRoles],
      async (tx) => {
        this.uniqueIds(d.expected.map((x) => x.id));
        this.uniqueIds(d.orderedIds);
        await this.structureVersion(tx, projectId, d.expectedVersion);
        const rows = await tx.section.findMany({
          where: { projectId },
          orderBy: { order: "asc" },
        });
        const byId = new Map(rows.map((s) => [s.id, s]));
        if (
          [...d.expected.map((x) => x.id), ...d.orderedIds].some(
            (id) => !byId.has(id),
          )
        )
          throw new NotFoundException("No se encontró un tema del proyecto.");
        if (
          d.expected.length !== rows.length ||
          d.expected.some((x) => byId.get(x.id)?.order !== x.order)
        )
          this.structureConflict();
        if (d.orderedIds.length !== rows.length)
          throw new BadRequestException(
            "Incluye todos los temas en el orden final.",
          );
        const next = d.orderedIds.map((id, order) => ({ id, order }));
        const max = Math.max(0, ...rows.map((x) => x.order));
        if (max + rows.length + 1 > 2147483647)
          throw new ConflictException("El orden excede el rango permitido.");
        if (rows.length) {
          const temporary = Prisma.join(
            next.map(
              (x, i) => Prisma.sql`(${x.id}::uuid, ${max + i + 1}::int)`,
            ),
          );
          await tx.$executeRaw`UPDATE "Section" s SET "order"=v.ord FROM (VALUES ${temporary}) AS v(id,ord) WHERE s.id=v.id AND s."projectId"=${projectId}::uuid`;
          const final = Prisma.join(
            next.map((x) => Prisma.sql`(${x.id}::uuid, ${x.order}::int)`),
          );
          await tx.$executeRaw`UPDATE "Section" s SET "order"=v.ord, "updatedAt"=CURRENT_TIMESTAMP FROM (VALUES ${final}) AS v(id,ord) WHERE s.id=v.id AND s."projectId"=${projectId}::uuid`;
        }
        const result = await this.advanceStructure(tx, projectId);
        await audit(
          tx,
          req.actor,
          "SECTIONS_REORDERED",
          "Project",
          projectId,
          projectId,
          d.expected,
          next,
          req.requestId,
        );
        return result;
      },
    );
  }
  async reorderQuestions(
    req: CommandContext,
    projectId: string,
    d: z.infer<typeof reorderQuestionsInput>,
  ) {
    return this.access.mutate(
      req.actor,
      projectId,
      [...editorRoles],
      async (tx) => {
        this.uniqueIds(d.sections.map((x) => x.sectionId));
        this.uniqueIds(d.sections.flatMap((x) => x.expected.map((q) => q.id)));
        this.uniqueIds(d.sections.flatMap((x) => x.orderedIds));
        await this.structureVersion(tx, projectId, d.expectedVersion);
        const scopeIds = d.sections.map((x) => x.sectionId);
        if (
          (await tx.section.count({
            where: { projectId, id: { in: scopeIds } },
          })) !== scopeIds.length
        )
          throw new NotFoundException("No se encontró un tema del proyecto.");
        const rows = await tx.question.findMany({
          where: { projectId, sectionId: { in: scopeIds } },
        });
        const byId = new Map(rows.map((q) => [q.id, q]));
        for (const scope of d.sections) {
          if (
            scope.expected.some((x) => !byId.has(x.id)) ||
            scope.orderedIds.some((id) => !byId.has(id))
          )
            throw new NotFoundException(
              "No se encontró una pregunta del ámbito solicitado.",
            );
          const current = rows.filter((q) => q.sectionId === scope.sectionId);
          if (
            scope.expected.length !== current.length ||
            scope.expected.some((x) => {
              const q = byId.get(x.id)!;
              return (
                q.sectionId !== scope.sectionId ||
                q.order !== x.order ||
                q.lockVersion !== x.lockVersion
              );
            })
          )
            this.structureConflict();
        }
        const active = rows.filter((q) => q.publication !== "ARCHIVED");
        const ids = d.sections.flatMap((x) => x.orderedIds);
        if (
          ids.length !== active.length ||
          ids.some((id) => byId.get(id)!.publication === "ARCHIVED")
        )
          throw new BadRequestException(
            "El orden final debe incluir todas las preguntas activas y ninguna archivada.",
          );
        const next = d.sections.flatMap((scope) => {
          const reserved = new Set(
            rows
              .filter(
                (q) =>
                  q.sectionId === scope.sectionId &&
                  q.publication === "ARCHIVED",
              )
              .map((q) => q.order),
          );
          let order = 0;
          return scope.orderedIds.map((id) => {
            while (reserved.has(order)) order++;
            return { id, sectionId: scope.sectionId, order: order++ };
          });
        });
        const moved = next.filter(
          (x) => byId.get(x.id)!.sectionId !== x.sectionId,
        );
        if (moved.length > 1)
          throw new BadRequestException(
            "Mueve una pregunta a la vez entre temas.",
          );
        for (const x of moved) {
          const q = byId.get(x.id)!;
          if (q.publication !== "DRAFT")
            throw new ConflictException(
              "Una pregunta publicada no puede cambiar de tema.",
            );
          if (
            q.groupParentId ||
            (await tx.question.count({
              where: { projectId, groupParentId: q.id },
            }))
          )
            throw new ConflictException(
              "El traslado no puede separar una pregunta de sus seguimientos.",
            );
        }
        // Only structural fields are updated; revisions, grouping and conditions remain untouched.
        const changed = next.filter((x) => {
          const q = byId.get(x.id)!;
          return q.order !== x.order || q.sectionId !== x.sectionId;
        });
        const max = Math.max(0, ...rows.map((q) => q.order));
        if (max + changed.length + 1 > 2147483647)
          throw new ConflictException("El orden excede el rango permitido.");
        if (changed.length) {
          const temporary = Prisma.join(
            changed.map(
              (x, i) => Prisma.sql`(${x.id}::uuid, ${max + i + 1}::int)`,
            ),
          );
          await tx.$executeRaw`UPDATE "Question" q SET "order"=v.ord FROM (VALUES ${temporary}) AS v(id,ord) WHERE q.id=v.id AND q."projectId"=${projectId}::uuid`;
          const final = Prisma.join(
            changed.map(
              (x) =>
                Prisma.sql`(${x.id}::uuid, ${x.sectionId}::uuid, ${x.order}::int)`,
            ),
          );
          await tx.$executeRaw`UPDATE "Question" q SET "sectionId"=v.section, "order"=v.ord, "lockVersion"=q."lockVersion"+1, "updatedAt"=CURRENT_TIMESTAMP FROM (VALUES ${final}) AS v(id,section,ord) WHERE q.id=v.id AND q."projectId"=${projectId}::uuid`;
        }
        const result = await this.advanceStructure(tx, projectId);
        await audit(
          tx,
          req.actor,
          moved.length ? "QUESTION_MOVED" : "QUESTIONS_REORDERED",
          "Project",
          projectId,
          projectId,
          rows.map((q) => ({
            id: q.id,
            sectionId: q.sectionId,
            order: q.order,
          })),
          next,
          req.requestId,
        );
        return result;
      },
    );
  }
  async createReference(
    req: CommandContext,
    projectId: string,
    d: z.infer<typeof referenceInput>,
  ) {
    return this.access.mutate(
      req.actor,
      projectId,
      [...editorRoles],
      async (tx) => {
        const x = await tx.traceabilityReference.create({
          data: { projectId, ...d },
        });
        await audit(
          tx,
          req.actor,
          "REFERENCE_CREATED",
          "TraceabilityReference",
          x.id,
          projectId,
          null,
          d,
          req.requestId,
        );
        return serialize(referenceView, { id: x.id, ...d });
      },
    );
  }
  private async get(tx: Tx, projectId: string, id: string) {
    const q = await tx.question.findFirst({
      where: { id, projectId },
      include: questionInclude,
    });
    if (!q) throw new NotFoundException("No se encontró la pregunta.");
    return q;
  }
  private async checkLinks(
    tx: Tx,
    actor: User,
    projectId: string,
    id: string,
    d: QuestionInput,
  ) {
    validateQuestion(d);
    if (
      !(await tx.section.findFirst({ where: { id: d.sectionId, projectId } }))
    )
      throw new NotFoundException("No se encontró la sección.");
    if (
      !(await tx.area.findFirst({
        where: {
          id: d.responsibleAreaId,
          organizationId: actor.organizationId,
          active: true,
        },
      }))
    )
      throw new NotFoundException("No se encontró el área responsable.");
    const refs = await tx.traceabilityReference.findMany({
      where: { projectId, id: { in: d.references.map((x) => x.referenceId) } },
    });
    if (refs.length !== d.references.length)
      throw new BadRequestException("Una referencia no pertenece al proyecto.");
    if (d.supersedesQuestionId) {
      if (
        d.supersedesQuestionId === id ||
        !(await tx.question.findFirst({
          where: { id: d.supersedesQuestionId, projectId },
        }))
      )
        throw new BadRequestException(
          "La pregunta anterior debe pertenecer a este proyecto.",
        );
    }
    const groups = await tx.question.findMany({
      where: { projectId, groupParentId: { not: null }, id: { not: id } },
      select: { id: true, groupParentId: true },
    });
    if (d.groupParentId) {
      const parent = await tx.question.findFirst({
        where: {
          id: d.groupParentId,
          projectId,
          sectionId: d.sectionId,
          publication: { not: "ARCHIVED" },
        },
      });
      if (!parent)
        throw new BadRequestException(
          "La pregunta principal debe estar en la misma sección.",
        );
      assertAcyclic([
        ...groups.map((q) => ({ child: q.id, parent: q.groupParentId! })),
        { child: id, parent: d.groupParentId },
      ]);
    }
    if (d.condition) {
      const parent = await tx.question.findFirst({
        where: {
          id: d.condition.parentQuestionId,
          projectId,
          publication: { not: "ARCHIVED" },
        },
        include: questionInclude,
      });
      if (!parent)
        throw new BadRequestException(
          "La condición debe referirse a una pregunta de este proyecto.",
        );
      const v = presentQuestion(parent);
      const c = d.condition;
      const valid =
        v.type === "YES_NO"
          ? c.operator !== "CONTAINS" && typeof c.value === "boolean"
          : v.type === "SINGLE_CHOICE"
            ? c.operator !== "CONTAINS" &&
              v.options.some((o) => o.value === c.value)
            : v.type === "MULTIPLE_CHOICE"
              ? c.operator === "CONTAINS" &&
                v.options.some((o) => o.value === c.value)
              : false;
      if (!valid)
        throw new BadRequestException(
          "La condición no coincide con el tipo u opciones de la pregunta principal.",
        );
      const edges = await tx.questionCondition.findMany({
        where: { projectId, childQuestionId: { not: id } },
      });
      assertAcyclic([
        ...edges.map((e) => ({
          child: e.childQuestionId,
          parent: e.parentQuestionId,
        })),
        { child: id, parent: c.parentQuestionId },
      ]);
    }
    return refs.map((x) => ({
      id: x.id,
      type: x.type,
      externalId: x.externalId,
      label: x.label,
      url: x.url,
      priority: x.priority,
    }));
  }
  private async writeRevision(
    tx: Tx,
    actor: User,
    projectId: string,
    id: string,
    number: number,
    d: QuestionInput,
    resolvedReferences: unknown,
  ) {
    const v = await tx.questionRevision.create({
      data: {
        projectId,
        questionId: id,
        number,
        title: d.title,
        question: d.question,
        helpText: d.helpText,
        type: d.type,
        required: d.required,
        config: d.config === null ? Prisma.JsonNull : jsonValue(d.config),
        snapshot: jsonValue({ ...d, resolvedReferences }),
        createdById: actor.id,
      },
    });
    if (d.options.length)
      await tx.questionOption.createMany({
        data: d.options.map((o) => ({
          projectId,
          questionRevisionId: v.id,
          ...o,
        })),
      });
    await tx.questionCondition.deleteMany({
      where: { projectId, childQuestionId: id },
    });
    if (d.condition)
      await tx.questionCondition.create({
        data: {
          projectId,
          childQuestionId: id,
          ...d.condition,
          value: jsonValue(d.condition.value),
        },
      });
    await tx.questionTraceability.deleteMany({
      where: { projectId, questionId: id },
    });
    if (d.references.length)
      await tx.questionTraceability.createMany({
        data: d.references.map((x) => ({ projectId, questionId: id, ...x })),
      });
  }
  async create(req: CommandContext, projectId: string, d: QuestionInput) {
    return this.access.mutate(
      req.actor,
      projectId,
      [...editorRoles],
      async (tx) => {
        const id = randomUUID();
        const refs = await this.checkLinks(tx, req.actor, projectId, id, d);
        await tx.question.create({
          data: {
            id,
            projectId,
            sectionId: d.sectionId,
            externalId: d.externalId,
            groupParentId: d.groupParentId,
            supersedesQuestionId: d.supersedesQuestionId,
            responsibleAreaId: d.responsibleAreaId,
            priority: d.priority,
            order: d.order,
          },
        });
        await this.writeRevision(tx, req.actor, projectId, id, 1, d, refs);
        await audit(
          tx,
          req.actor,
          "QUESTION_CREATED",
          "Question",
          id,
          projectId,
          null,
          d,
          req.requestId,
        );
        return presentQuestion(await this.get(tx, projectId, id));
      },
    );
  }
  async edit(
    req: CommandContext,
    projectId: string,
    id: string,
    d: z.infer<typeof editQuestionInput>,
  ) {
    return this.access.mutate(
      req.actor,
      projectId,
      [...editorRoles],
      async (tx) => {
        const old = await this.get(tx, projectId, id);
        this.version(old, d.expectedVersion);
        if (old.publication !== "DRAFT")
          throw new ConflictException(
            "El contenido publicado está protegido. Crea una pregunta que sustituya a la anterior.",
          );
        if (d.externalId !== old.externalId)
          throw new ConflictException(
            "El identificador externo es estable y no se cambia al editar.",
          );
        const refs = await this.checkLinks(tx, req.actor, projectId, id, d);
        // Changing a parent must not leave a condition or grouping invalid.
        const children = await tx.questionCondition.findMany({
          where: { projectId, parentQuestionId: id },
        });
        for (const c of children) {
          const valid =
            d.type === "YES_NO"
              ? c.operator !== "CONTAINS" && typeof c.value === "boolean"
              : d.type === "SINGLE_CHOICE"
                ? c.operator !== "CONTAINS" &&
                  d.options.some((o) => o.value === c.value)
                : d.type === "MULTIPLE_CHOICE"
                  ? c.operator === "CONTAINS" &&
                    d.options.some((o) => o.value === c.value)
                  : false;
          if (!valid)
            throw new ConflictException(
              "Actualiza primero las condiciones que dependen de esta pregunta.",
            );
        }
        if (
          d.sectionId !== old.sectionId &&
          (await tx.question.count({ where: { projectId, groupParentId: id } }))
        )
          throw new ConflictException(
            "La pregunta tiene seguimientos en esta sección.",
          );
        await tx.question.update({
          where: { id },
          data: {
            sectionId: d.sectionId,
            groupParentId: d.groupParentId,
            supersedesQuestionId: d.supersedesQuestionId,
            responsibleAreaId: d.responsibleAreaId,
            priority: d.priority,
            order: d.order,
            currentRevisionNumber: { increment: 1 },
            lockVersion: { increment: 1 },
          },
        });
        await this.writeRevision(
          tx,
          req.actor,
          projectId,
          id,
          old.currentRevisionNumber + 1,
          d,
          refs,
        );
        await audit(
          tx,
          req.actor,
          "QUESTION_UPDATED",
          "Question",
          id,
          projectId,
          presentQuestion(old),
          d,
          req.requestId,
        );
        return presentQuestion(await this.get(tx, projectId, id));
      },
    );
  }
  private version(q: { lockVersion: number }, expected: number) {
    if (q.lockVersion !== expected)
      throw new ConflictException(
        "Otra persona cambió esta pregunta. Actualiza la vista para continuar.",
      );
  }
  async metadata(
    req: CommandContext,
    p: string,
    id: string,
    d: z.infer<typeof metadataInput>,
  ) {
    return this.access.mutate(req.actor, p, [...editorRoles], async (tx) => {
      const q = await this.get(tx, p, id);
      this.version(q, d.expectedVersion);
      if (q.publication === "ARCHIVED")
        throw new ConflictException("La pregunta está archivada.");
      if (
        !(await tx.area.findFirst({
          where: {
            id: d.responsibleAreaId,
            organizationId: req.actor.organizationId,
            active: true,
          },
        }))
      )
        throw new NotFoundException("No se encontró el área.");
      await tx.question.update({
        where: { id },
        data: {
          priority: d.priority,
          responsibleAreaId: d.responsibleAreaId,
          order: d.order,
          lockVersion: { increment: 1 },
        },
      });
      await audit(
        tx,
        req.actor,
        "QUESTION_METADATA_CHANGED",
        "Question",
        id,
        p,
        {
          priority: q.priority,
          order: q.order,
          responsibleAreaId: q.responsibleAreaId,
        },
        d,
        req.requestId,
      );
      return presentQuestion(await this.get(tx, p, id));
    });
  }
  async assign(
    req: CommandContext,
    p: string,
    id: string,
    d: z.infer<typeof assignmentInput>,
  ) {
    return this.access.mutate(req.actor, p, [...editorRoles], async (tx) => {
      const q = await this.get(tx, p, id);
      this.version(q, d.expectedVersion);
      if (q.publication === "ARCHIVED")
        throw new ConflictException("La pregunta está archivada.");
      const m = await tx.projectMember.findFirst({
        where: {
          id: d.projectMemberId,
          user: { invitationOnly: false },
          projectId: p,
          ...(d.active
            ? {
                role: "STAKEHOLDER" as const,
                active: true,
                user: { active: true, invitationOnly: false },
                area: { active: true },
              }
            : {}),
        },
      });
      if (!m)
        throw new BadRequestException(
          "Selecciona un participante activo de este proyecto.",
        );
      if (
        d.active &&
        q.QuestionCondition_child &&
        !(await tx.questionAssignment.findFirst({
          where: {
            projectId: p,
            questionId: q.QuestionCondition_child.parentQuestionId,
            projectMemberId: m.id,
            active: true,
          },
        }))
      )
        throw new ConflictException(
          "Asigna primero la pregunta de la que depende.",
        );
      if (!d.active) {
        const children = await tx.questionCondition.findMany({
          where: { projectId: p, parentQuestionId: id },
        });
        if (
          await tx.questionAssignment.count({
            where: {
              projectId: p,
              projectMemberId: m.id,
              active: true,
              questionId: { in: children.map((c) => c.childQuestionId) },
              question: { publication: { not: "ARCHIVED" } },
            },
          })
        )
          throw new ConflictException(
            "Retira primero las asignaciones de preguntas dependientes.",
          );
      }
      const previous = await tx.questionAssignment.findUnique({
        where: {
          questionId_projectMemberId: { questionId: id, projectMemberId: m.id },
        },
      });
      const a = await tx.questionAssignment.upsert({
        where: {
          questionId_projectMemberId: { questionId: id, projectMemberId: m.id },
        },
        create: {
          projectId: p,
          questionId: id,
          projectMemberId: m.id,
          required: d.required,
          active: d.active,
        },
        update: { required: d.required, active: d.active },
      });
      await tx.question.update({
        where: { id },
        data: { lockVersion: { increment: 1 } },
      });
      await audit(
        tx,
        req.actor,
        "ASSIGNMENT_CHANGED",
        "QuestionAssignment",
        a.id,
        p,
        previous
          ? { active: previous.active, required: previous.required }
          : null,
        {
          questionId: id,
          memberId: m.id,
          active: d.active,
          required: d.required,
        },
        req.requestId,
      );
      await this.responses.recompute(tx, req.actor, p);
      return presentQuestion(await this.get(tx, p, id));
    });
  }
  async publish(
    req: CommandContext,
    p: string,
    id: string,
    expectedVersion: number,
  ) {
    return this.access.mutate(req.actor, p, [...editorRoles], async (tx) => {
      const q = await this.get(tx, p, id);
      this.version(q, expectedVersion);
      if (q.publication !== "DRAFT")
        throw new ConflictException("Solo se publican preguntas en borrador.");
      await this.checkLinks(tx, req.actor, p, id, presentQuestion(q));
      const [rows, sections, areas, references] = await Promise.all([
        tx.question.findMany({
          where: { projectId: p },
          include: questionInclude,
        }),
        tx.section.findMany({ where: { projectId: p }, select: { id: true } }),
        tx.area.findMany({
          where: { organizationId: req.actor.organizationId },
          select: { id: true, active: true },
        }),
        tx.traceabilityReference.findMany({
          where: { projectId: p },
          select: { id: true },
        }),
      ]);
      const issues = publicationIssues(
        presentQuestion(q),
        {
          questions: new Map(rows.map((row) => [row.id, presentQuestion(row)])),
          sections: new Set(sections.map((s) => s.id)),
          areas: new Map(areas.map((a) => [a.id, a])),
          references: new Set(references.map((r) => r.id)),
        },
        new Set(),
      );
      if (issues.length) throw new ConflictException(issues[0]!.message);
      await tx.question.update({
        where: { id },
        data: {
          publication: "PUBLISHED",
          publishedRevisionNumber: q.currentRevisionNumber,
          lockVersion: { increment: 1 },
        },
      });
      await audit(
        tx,
        req.actor,
        "QUESTION_PUBLISHED",
        "Question",
        id,
        p,
        { publication: "DRAFT" },
        { publication: "PUBLISHED", revisionNumber: q.currentRevisionNumber },
        req.requestId,
      );
      await this.responses.recompute(tx, req.actor, p);
      return presentQuestion(await this.get(tx, p, id));
    });
  }
  async archive(
    req: CommandContext,
    p: string,
    id: string,
    expectedVersion: number,
  ) {
    return this.access.mutate(req.actor, p, [...editorRoles], async (tx) => {
      const q = await this.get(tx, p, id);
      this.version(q, expectedVersion);
      if (q.publication === "ARCHIVED")
        throw new ConflictException("La pregunta ya está archivada.");
      if (
        await tx.question.count({
          where: {
            projectId: p,
            publication: { not: "ARCHIVED" },
            OR: [
              { groupParentId: id },
              { QuestionCondition_child: { parentQuestionId: id } },
            ],
          },
        })
      )
        throw new ConflictException(
          "Archiva primero los seguimientos y preguntas dependientes.",
        );
      await tx.question.update({
        where: { id },
        data: { publication: "ARCHIVED", lockVersion: { increment: 1 } },
      });
      await audit(
        tx,
        req.actor,
        "QUESTION_ARCHIVED",
        "Question",
        id,
        p,
        { publication: q.publication },
        { publication: "ARCHIVED" },
        req.requestId,
      );
      await this.responses.recompute(tx, req.actor, p);
      return presentQuestion(await this.get(tx, p, id));
    });
  }
}
