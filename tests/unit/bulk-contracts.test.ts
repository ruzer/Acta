import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  bulkAreaInput,
  bulkAreaConfirm,
  bulkParticipantsInput,
  bulkPublishInput,
} from "@requirements/contracts";
const q = { id: randomUUID(), expectedVersion: 0 };
const common = { requestId: randomUUID(), questions: [q] };
it("bulk commands require unique stable IDs, bounded batches and explicit participant policy", () => {
  expect(() =>
    bulkPublishInput.parse({ ...common, questions: [q, q] }),
  ).toThrow();
  expect(() => bulkPublishInput.parse({ ...common, questions: [] })).toThrow();
  expect(() =>
    bulkPublishInput.parse({
      ...common,
      questions: Array.from({ length: 2001 }, () => ({
        id: randomUUID(),
        expectedVersion: 0,
      })),
    }),
  ).toThrow();
  const participant = { projectMemberId: randomUUID(), required: true };
  expect(() =>
    bulkParticipantsInput.parse({
      ...common,
      participants: [participant, participant],
    }),
  ).toThrow();
  expect(() =>
    bulkParticipantsInput.parse({
      ...common,
      participants: [{ projectMemberId: participant.projectMemberId }],
    }),
  ).toThrow();
  expect(() =>
    bulkParticipantsInput.parse({
      ...common,
      questions: Array.from({ length: 1001 }, () => ({
        id: randomUUID(),
        expectedVersion: 0,
      })),
      participants: Array.from({ length: 10 }, () => ({
        projectMemberId: randomUUID(),
        required: false,
      })),
    }),
  ).toThrow();
});
it("area has no priority/order/content fields and confirmation requires server preview hash", () => {
  const command = { ...common, sourceAreaId: null, targetAreaId: randomUUID() };
  expect(bulkAreaInput.parse(command)).toEqual(command);
  for (const extra of [
    { priority: "P0" },
    { order: 1 },
    { question: "changed" },
    { publication: "PUBLISHED" },
    { organizationId: randomUUID() },
  ])
    expect(() => bulkAreaInput.parse({ ...command, ...extra })).toThrow();
  expect(() => bulkAreaConfirm.parse(command)).toThrow();
  expect(() =>
    bulkAreaConfirm.parse({ ...command, previewHash: "invalid" }),
  ).toThrow();
  expect(
    bulkAreaConfirm.parse({ ...command, previewHash: "a".repeat(64) })
      .previewHash,
  ).toHaveLength(64);
});
