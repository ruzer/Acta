import { expect, it } from "vitest";
import { reviewDetailView, type ReviewDetail } from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import { buildTimeline } from "./review-timeline";

const conflict = reviewDetailView.parse(fixture.conflict);
const decision = reviewDetailView.parse(fixture.decision);
const empty = (d: ReviewDetail): ReviewDetail => ({
  ...d,
  submissions: [],
  threads: [],
  conflicts: [],
  validations: [],
  dispositions: [],
});

it("ordena por fecha y no inventa eventos que el detalle no trae", () => {
  const d = {
    ...empty(conflict),
    submissions: conflict.submissions,
    conflicts: conflict.conflicts,
  };
  const events = buildTimeline(d);
  expect(events.length).toBe(
    conflict.submissions.length + conflict.conflicts.length,
  );
  const times = events.map((event) => Date.parse(event.at));
  expect([...times].sort((a, b) => a - b)).toEqual(times);
  expect(
    events.some((event) => event.text.startsWith("registró un conflicto")),
  ).toBe(conflict.conflicts.length > 0);
  expect(buildTimeline(empty(conflict))).toEqual([]);
});

it("distingue quién pregunta y quién responde en una aclaración", () => {
  const first = conflict.submissions[0]!;
  const analyst = { id: "analyst-1", displayName: "Elena Rangel" };
  const d: ReviewDetail = {
    ...empty(conflict),
    submissions: [first],
    threads: [
      {
        id: "t1",
        responseRevisionId: first.id,
        respondentId: first.respondent.id,
        status: "CLOSED",
        lockVersion: 2,
        createdAt: "2026-09-26T11:00:00.000Z",
        closedAt: "2026-09-27T09:30:00.000Z",
        closedBy: analyst,
        closeReason: "Aclarado",
        messages: [
          {
            id: "m1",
            threadId: "t1",
            author: analyst,
            body: "¿Aplica a bienes de importación?",
            createdAt: "2026-09-26T11:00:00.000Z",
          },
          {
            id: "m2",
            threadId: "t1",
            author: first.respondent,
            body: "Sí, aplica.",
            createdAt: "2026-09-27T08:52:00.000Z",
          },
          {
            id: "m3",
            threadId: "t1",
            author: analyst,
            body: "¿Y a servicios?",
            createdAt: "2026-09-27T09:00:00.000Z",
          },
        ],
      },
    ],
  };
  const texts = buildTimeline(d)
    .filter((event) => !event.id.startsWith("submission"))
    .map((event) => `${event.actor} ${event.text}`);
  expect(texts).toEqual([
    `Elena Rangel pidió una aclaración a ${first.respondent.displayName}.`,
    `${first.respondent.displayName} respondió la aclaración.`,
    `Elena Rangel volvió a preguntar a ${first.respondent.displayName}.`,
    "Elena Rangel cerró la aclaración.",
  ]);
});

it("incluye la decisión, su reapertura y la resolución de conflictos sin afirmar validez", () => {
  const events = buildTimeline(decision).map(
    (event) => `${event.actor} ${event.text}`,
  );
  expect(events.some((text) => text.includes("registró la decisión."))).toBe(
    true,
  );
  const reopened: ReviewDetail = {
    ...decision,
    validations: decision.validations.map((v) => ({
      ...v,
      invalidatedAt: "2026-10-05T00:00:00.000Z",
      invalidatedBy: { id: "x", displayName: "Elena Rangel" },
      invalidationReason: "Cambió el alcance",
    })),
  };
  expect(
    buildTimeline(reopened).some((event) =>
      event.text.includes("volvió la pregunta a revisión"),
    ),
  ).toBe(true);
  const resolved: ReviewDetail = {
    ...conflict,
    conflicts: conflict.conflicts.map((c) => ({
      ...c,
      status: "RESOLVED" as const,
      resolution: {
        id: "r1",
        resolutionText: "Se adopta el umbral de 500 UMA.",
        resolvedAt: "2026-10-04T00:00:00.000Z",
        resolvedBy: { id: "x", displayName: "Elena Rangel" },
        sources: [],
      },
    })),
  };
  expect(
    buildTimeline(resolved).some((event) =>
      event.text.includes("resolvió el conflicto (no valida la pregunta)"),
    ),
  ).toBe(true);
});
