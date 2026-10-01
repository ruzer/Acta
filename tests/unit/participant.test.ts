import { describe, it, expect } from "vitest";
import {
  participantState,
  participantStart,
  participantNext,
  type PersonalQuestion,
} from "@requirements/contracts";
const q = (
  id: string,
  changes: Partial<PersonalQuestion> = {},
): PersonalQuestion => ({
  id,
  title: id,
  question: id,
  hasSubmission: false,
  currentSubmission: false,
  applicability: "ENABLED",
  state: "PENDING",
  updatedAt: null,
  reviewStatus: "NOT_REVIEWED",
  clarificationWaiting: 0,
  clarificationCount: 0,
  ...changes,
});
describe("participant documentary queue", () => {
  it("starts clarification, then draft, consultation and pending; ties ignore save time", () => {
    const items = [
      q("p1"),
      q("p2", { state: "CONSULTATION" }),
      q("p3", { state: "DRAFT", updatedAt: "2026-01-01T00:00:00Z" }),
      q("p4", { state: "DRAFT", updatedAt: "2026-09-29T00:00:00Z" }),
      q("p5", {
        hasSubmission: true,
        currentSubmission: true,
        clarificationWaiting: 1,
      }),
    ];
    expect(participantStart(items)?.id).toBe("p5");
    expect(participantStart(items.slice(0, 4))?.id).toBe("p3");
    expect(participantStart(items.slice(0, 2))?.id).toBe("p2");
  });
  it("P1 submit → P2 submit → P3 never indexes a shrinking actionable list", () => {
    const items = [
      q("p1", { hasSubmission: true, state: "SENT" }),
      q("p2"),
      q("p3"),
    ];
    expect(participantNext(items, "p1")?.id).toBe("p2");
    items[1] = q("p2", { hasSubmission: true, state: "SENT" });
    expect(participantNext(items, "p2")?.id).toBe("p3");
    expect(participantNext(items, "unknown")).toBeUndefined();
  });
  it("priority picks start only, later step follows document, no wraparound", () => {
    const items = [
      q("p1"),
      q("p2", { state: "DRAFT" }),
      q("p3"),
      q("p4", { state: "DRAFT" }),
    ];
    expect(participantStart(items)?.id).toBe("p2");
    expect(participantNext(items, "p2")?.id).toBe("p3");
    expect(participantNext(items, "p4")).toBeUndefined();
    expect(participantStart(items)).toBeDefined();
  });
  it("answered clarification is not a participant pending; submitted/validated are read only", () => {
    for (const reviewStatus of [
      "ANSWERED",
      "VALIDATED",
      "CONFLICT",
      "CLARIFICATION_REQUIRED",
    ] as const) {
      const item = q("p1", {
        hasSubmission: true,
        currentSubmission: true,
        reviewStatus,
        clarificationCount: 1,
      });
      expect(participantStart([item])).toBeUndefined();
    }
    expect(
      participantState(
        q("p1", {
          hasSubmission: true,
          reviewStatus: "CLARIFICATION_REQUIRED",
          clarificationCount: 1,
        }),
      ),
    ).toBe("review");
  });
  it("out-of-context submission stays historical, unavailable conditions are not No aplica", () => {
    expect(
      participantStart([
        q("old", { hasSubmission: true, currentSubmission: false }),
      ]),
    ).toBeUndefined();
    const hidden = q("conditional", { applicability: "UNDETERMINED" });
    expect(participantStart([hidden])).toBeUndefined();
    expect(participantState(hidden)).toBe("pending");
  });
});
