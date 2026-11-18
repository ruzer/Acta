import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import { type TemplateInput, templateInput } from "@requirements/contracts";
import { Database } from "../database/database.module.js";
import { AccessService } from "../administration/access.service.js";
import { inspectTemplate } from "./template.js";
import { importLimits } from "./limits.js";
import { csvCell } from "./renderers.js";

const csvTypes: Record<string, string> = {
  YES_NO: "Sí/No",
  SHORT_TEXT: "Texto corto",
  LONG_TEXT: "Texto largo",
  DATE: "Fecha",
  NUMBER: "Número",
};
const normalize = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
export function templateFile(
  data: TemplateInput,
  format: "csv" | "json",
  catalog: TemplateInput["areas"],
) {
  const text = JSON.stringify(data, null, 2);
  const titles = data.sections.map((s) => normalize(s.title));
  // CSV no puede conservar estas propiedades. JSON evita recortar o transformar la estructura.
  const csv =
    format === "csv" &&
    catalog.length < 500 &&
    data.questions.length > 0 &&
    !data.conditions.length &&
    !data.traceabilityReferences.length &&
    new Set(titles).size === titles.length &&
    data.sections.every(
      (s) =>
        !s.description &&
        s.title === s.title.trim().replace(/\s+/g, " ") &&
        data.questions.some((q) => q.sectionExternalId === s.externalId),
    ) &&
    data.areas.every(
      (a) =>
        catalog.filter((c) => normalize(c.name) === normalize(a.name))
          .length === 1,
    ) &&
    data.questions.every(
      (q) =>
        csvTypes[q.type] &&
        q.priority === "P2" &&
        !q.options.length &&
        !q.references.length &&
        !q.groupParentExternalId &&
        !q.sourceLocator &&
        !Object.keys(q.config ?? {}).length &&
        [
          q.externalId,
          q.title,
          q.question,
          q.helpText ?? "",
          data.areas.find((a) => a.code === q.responsibleAreaCode)!.name,
          data.sections.find((s) => s.externalId === q.sectionExternalId)!
            .title,
        ].every(
          (v) =>
            v === v.trim() &&
            !/[\r\n\t]/.test(v) &&
            csvCell(v) === '"' + v.replaceAll('"', '""') + '"',
        ) &&
        q.title === q.title.replace(/\s+/g, " "),
    );
  if (!csv)
    return {
      mime: "application/json",
      filename: "cuestionario-plantilla.json",
      content: text,
    };
  const rows = data.sections.flatMap((section) =>
    data.questions
      .filter((q) => q.sectionExternalId === section.externalId)
      .map((q) =>
        [
          section.title,
          q.externalId,
          q.question,
          q.helpText ?? "",
          csvTypes[q.type],
          q.required ? "Sí" : "No",
          data.areas.find((a) => a.code === q.responsibleAreaCode)!.name,
          q.title,
        ]
          .map(csvCell)
          .join(","),
      ),
  );
  return {
    mime: "text/csv",
    filename: "cuestionario-plantilla.csv",
    content:
      "\uFEFFTema,Código,Pregunta,Texto de ayuda,Tipo,Obligatoria,Área responsable,Título\r\n" +
      rows.join("\r\n") +
      "\r\n",
  };
}
@Injectable()
export class QuestionnaireTemplateService {
  constructor(
    private readonly db: Database,
    private readonly access: AccessService,
  ) {}
  async download(actor: User, projectId: string, format: "csv" | "json") {
    return this.db.$transaction(
      async (tx) => {
        const { project } = await this.access.project(tx, actor, projectId, [
          "ADMIN",
          "ANALYST",
        ]);
        const limits = importLimits();
        const sections = await tx.section.findMany({
          where: { projectId },
          orderBy: { order: "asc" },
          take: limits.IMPORT_MAX_SECTIONS + 1,
          select: {
            id: true,
            externalId: true,
            title: true,
            description: true,
            order: true,
          },
        });
        const references = await tx.traceabilityReference.findMany({
          where: { projectId },
          take: limits.IMPORT_MAX_REFERENCES + 1,
          orderBy: { externalId: "asc" },
          select: {
            id: true,
            type: true,
            externalId: true,
            label: true,
            url: true,
            priority: true,
            description: true,
          },
        });
        const questions = await tx.question.findMany({
          where: { projectId },
          take: limits.IMPORT_MAX_QUESTIONS + 1,
          orderBy: { order: "asc" },
          select: {
            id: true,
            externalId: true,
            sectionId: true,
            groupParentId: true,
            priority: true,
            order: true,
            responsibleArea: { select: { code: true, name: true } },
            QuestionCondition_child: {
              select: { parentQuestionId: true, operator: true, value: true },
            },
            QuestionTraceability_question: {
              select: { referenceId: true, scopeNote: true },
            },
            QuestionRevision_questionRecord: {
              orderBy: { number: "desc" },
              take: 1,
              select: {
                title: true,
                question: true,
                helpText: true,
                type: true,
                required: true,
                config: true,
                sourceLocator: true,
                QuestionOption_revision: {
                  orderBy: { order: "asc" },
                  select: { value: true, label: true, order: true },
                },
              },
            },
          },
        });
        if (
          sections.length > limits.IMPORT_MAX_SECTIONS ||
          questions.length > limits.IMPORT_MAX_QUESTIONS ||
          references.length > limits.IMPORT_MAX_REFERENCES
        )
          throw new PayloadTooLargeException(
            "El cuestionario supera los límites de una plantilla de importación.",
          );
        const sectionIds = new Map(sections.map((s) => [s.id, s.externalId]));
        const questionIds = new Map(questions.map((q) => [q.id, q.externalId]));
        const referenceIds = new Map(references.map((r) => [r.id, r]));
        const data = templateInput.parse({
          formatVersion: "1.0",
          kind: "questionnaire-template",
          project: {
            externalId: project.externalId,
            name: project.name,
            description: project.description,
          },
          areas: [
            ...new Map(
              questions.map((q) => [q.responsibleArea.code, q.responsibleArea]),
            ).values(),
          ],
          sections: sections.map(({ id: _id, ...s }) => s),
          questions: questions.map((q) => {
            const revision = q.QuestionRevision_questionRecord[0]!;
            return {
              externalId: q.externalId,
              sectionExternalId: sectionIds.get(q.sectionId),
              title: revision.title,
              question: revision.question,
              helpText: revision.helpText,
              type: revision.type,
              required: revision.required,
              priority: q.priority,
              responsibleAreaCode: q.responsibleArea.code,
              order: q.order,
              options: revision.QuestionOption_revision,
              references: q.QuestionTraceability_question.map((link) => ({
                type: referenceIds.get(link.referenceId)!.type,
                externalId: referenceIds.get(link.referenceId)!.externalId,
                ...(link.scopeNote ? { scopeNote: link.scopeNote } : {}),
              })),
              ...(q.groupParentId
                ? { groupParentExternalId: questionIds.get(q.groupParentId) }
                : {}),
              ...(revision.config ? { config: revision.config } : {}),
              ...(revision.sourceLocator
                ? { sourceLocator: revision.sourceLocator }
                : {}),
            };
          }),
          conditions: questions.flatMap((q) =>
            q.QuestionCondition_child
              ? [
                  {
                    parentQuestionExternalId: questionIds.get(
                      q.QuestionCondition_child.parentQuestionId,
                    ),
                    childQuestionExternalId: q.externalId,
                    operator: q.QuestionCondition_child.operator,
                    value: q.QuestionCondition_child.value,
                  },
                ]
              : [],
          ),
          traceabilityReferences: references.map((r) => ({
            type: r.type,
            externalId: r.externalId,
            label: r.label,
            ...(r.url ? { url: r.url } : {}),
            ...(r.priority ? { priority: r.priority } : {}),
            ...(r.description ? { description: r.description } : {}),
          })),
        });
        const checked = inspectTemplate(Buffer.from(JSON.stringify(data)));
        if (checked.errors.length)
          throw new BadRequestException(
            "La estructura todavía no puede reutilizarse. Revisa las preguntas, opciones y condiciones en Cuestionario.",
          );
        const catalog = await tx.area.findMany({
          where: { organizationId: actor.organizationId },
          select: { code: true, name: true },
        });
        const file = templateFile(data, format, catalog);
        if (Buffer.byteLength(file.content) > limits.IMPORT_MAX_BYTES)
          throw new PayloadTooLargeException(
            "La plantilla supera el tamaño permitido para importarla.",
          );
        return file;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
