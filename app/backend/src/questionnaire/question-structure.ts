import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { type CommandContext, jsonValue, type Tx } from "../common/http.js";

export async function readQuestionStructure(tx: Tx, projectId: string) {
  return tx.question.findMany({
    where: { projectId },
    include: {
      QuestionRevision_questionRecord: {
        orderBy: { number: "desc" },
        take: 1,
        select: { title: true },
      },
    },
  });
}
type StructureQuestion = Awaited<
  ReturnType<typeof readQuestionStructure>
>[number];
export type QuestionPosition = { id: string; sectionId: string; order: number };

// A family follows grouping links, not conditional-display dependencies. Include
// archived descendants: omitting them would silently split an existing group.
export function movableQuestionFamily(rows: StructureQuestion[], id: string) {
  const byId = new Map(rows.map((q) => [q.id, q]));
  let root = byId.get(id);
  const ancestors = new Set<string>();
  while (root?.groupParentId) {
    if (ancestors.has(root.id))
      throw new ConflictException("El grupo de preguntas contiene un ciclo.");
    ancestors.add(root.id);
    root = byId.get(root.groupParentId);
  }
  if (!root)
    throw new ConflictException(
      "No se encontró la pregunta principal del grupo.",
    );
  const descendants = new Map<string, StructureQuestion[]>();
  for (const q of rows)
    if (q.groupParentId) {
      const children = descendants.get(q.groupParentId) ?? [];
      children.push(q);
      descendants.set(q.groupParentId, children);
    }
  const family: StructureQuestion[] = [],
    pending = [root];
  const seen = new Set<string>();
  while (pending.length) {
    const q = pending.pop()!;
    if (seen.has(q.id))
      throw new ConflictException("El grupo de preguntas contiene un ciclo.");
    seen.add(q.id);
    family.push(q);
    pending.push(...(descendants.get(q.id) ?? []));
  }
  for (const q of family) {
    if (q.sectionId !== root.sectionId)
      throw new ConflictException(
        "Las preguntas del grupo deben pertenecer al mismo tema.",
      );
    if (q.publication !== "DRAFT") {
      const title = q.QuestionRevision_questionRecord[0]?.title ?? q.externalId;
      throw new ConflictException(
        `No se puede cambiar de tema: «${title}» (${q.externalId}) no está en borrador.`,
      );
    }
  }
  return family.sort((a, b) => a.order - b.order);
}

export function planQuestionOrder(
  rows: { id: string; sectionId: string; order: number; publication: string }[],
  sections: { sectionId: string; orderedIds: string[] }[],
): QuestionPosition[] {
  return sections.flatMap((section) => {
    const reserved = new Set(
      rows
        .filter(
          (q) =>
            q.sectionId === section.sectionId && q.publication === "ARCHIVED",
        )
        .map((q) => q.order),
    );
    let order = 0;
    return section.orderedIds.map((id) => {
      while (reserved.has(order)) order++;
      return { id, sectionId: section.sectionId, order: order++ };
    });
  });
}

export function assertCompleteFamilyMove(
  rows: StructureQuestion[],
  next: QuestionPosition[],
) {
  const byId = new Map(rows.map((q) => [q.id, q]));
  const moved = next.filter((q) => byId.get(q.id)!.sectionId !== q.sectionId);
  if (!moved.length) return moved;
  const family = movableQuestionFamily(rows, moved[0]!.id);
  const ids = new Set(family.map((q) => q.id));
  if (
    moved.length !== family.length ||
    moved.some((q) => !ids.has(q.id)) ||
    new Set(moved.map((q) => q.sectionId)).size !== 1
  )
    throw new ConflictException(
      "El traslado debe incluir una sola pregunta con todos sus seguimientos, sin separar el grupo.",
    );
  if (moved.some((q, i) => q.id !== family[i]!.id))
    throw new BadRequestException(
      "Conserva el orden de las preguntas del grupo al cambiar de tema.",
    );
  return moved;
}

// The caller holds the project lock. Temporarily vacate orders before moving
// between sections so the unique (sectionId, order) constraint is never bypassed.
export async function applyQuestionStructure(
  tx: Tx,
  projectId: string,
  rows: {
    id: string;
    sectionId: string;
    order: number;
    groupParentId: string | null;
  }[],
  next: QuestionPosition[],
) {
  const byId = new Map(rows.map((q) => [q.id, q]));
  const changed = next.filter((q) => {
    const old = byId.get(q.id)!;
    return old.order !== q.order || old.sectionId !== q.sectionId;
  });
  const max = Math.max(0, ...rows.map((q) => q.order));
  if (max + changed.length + 1 > 2147483647)
    throw new ConflictException("El orden excede el rango permitido.");
  if (changed.length) {
    const temporary = Prisma.join(
      changed.map((q, i) => Prisma.sql`(${q.id}::uuid, ${max + i + 1}::int)`),
    );
    await tx.$executeRaw`UPDATE "Question" q SET "order"=v.ord FROM (VALUES ${temporary}) AS v(id,ord) WHERE q.id=v.id AND q."projectId"=${projectId}::uuid`;
    // PostgreSQL checks group parents per row, before the UPDATE. Do not rely
    // on its execution order: move each parent layer before its descendants.
    const pending = new Map(changed.map((q) => [q.id, q]));
    while (pending.size) {
      const layer = [...pending.values()].filter((q) => {
        const parent = byId.get(q.id)!.groupParentId;
        return !parent || !pending.has(parent);
      });
      if (!layer.length)
        throw new ConflictException("El grupo de preguntas contiene un ciclo.");
      const final = Prisma.join(
        layer.map(
          (q) =>
            Prisma.sql`(${q.id}::uuid, ${q.sectionId}::uuid, ${q.order}::int)`,
        ),
      );
      await tx.$executeRaw`UPDATE "Question" q SET "sectionId"=v.section, "order"=v.ord, "lockVersion"=q."lockVersion"+1, "updatedAt"=CURRENT_TIMESTAMP FROM (VALUES ${final}) AS v(id,section,ord) WHERE q.id=v.id AND q."projectId"=${projectId}::uuid`;
      for (const q of layer) pending.delete(q.id);
    }
  }
  const project = await tx.project.update({
    where: { id: projectId },
    data: { lockVersion: { increment: 1 } },
  });
  return { structureVersion: project.lockVersion };
}

// edit already wrote QUESTION_UPDATED at index 0. Keep both facts correlated
// within the same transaction without changing the general audit helper.
export async function auditEditedQuestionMove(
  tx: Tx,
  req: CommandContext,
  projectId: string,
  before: QuestionPosition[],
  after: QuestionPosition[],
) {
  const actor = req.actor;
  await tx.auditEvent.create({
    data: {
      organizationId: actor.organizationId,
      projectId,
      actorId: actor.id,
      actorSnapshot: {
        displayName: actor.displayName,
        username: actor.username,
        identityKind: actor.invitationOnly ? "INVITATION" : "ACCOUNT",
      },
      action: "QUESTION_MOVED",
      objectType: "Project",
      objectId: projectId,
      before: jsonValue(before),
      after: jsonValue(after),
      requestId: req.requestId,
      eventIndex: 1,
    },
  });
}
