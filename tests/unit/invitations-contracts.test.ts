import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  invitationCreateInput,
  invitationExchangeInput,
  invitationPolicyInput,
  contracts,
} from "@requirements/contracts";
const base = () => ({
  requestId: randomUUID(),
  label: "External contributor",
  questionIds: [randomUUID()],
  areaId: randomUUID(),
  identity: { name: "Example Contributor" },
});
describe("external invitation authoritative contracts", () => {
  it("keeps identified and explicitly non-nominal invitations distinct", () => {
    expect(invitationCreateInput.parse(base()).allowEvidence).toBe(false);
    expect(
      invitationCreateInput.parse({ ...base(), identity: {}, nonNominal: true })
        .nonNominal,
    ).toBe(true);
    expect(
      invitationCreateInput.safeParse({ ...base(), identity: {} }).success,
    ).toBe(false);
    expect(
      invitationCreateInput.safeParse({ ...base(), nonNominal: true }).success,
    ).toBe(false);
  });
  it("rejects ambiguous/oversized scope and private credential fields", () => {
    const q = randomUUID();
    for (const changes of [
      { questionIds: [] },
      { questionIds: [q, q] },
      { questionIds: Array.from({ length: 501 }, randomUUID) },
      { password: "unwanted" },
      { identity: { email: "not-an-email" } },
      { expiresAt: "tomorrow" },
    ])
      expect(
        invitationCreateInput.safeParse({ ...base(), ...changes }).success,
      ).toBe(false);
  });
  it("exchanges only opaque 256-bit-format tokens, never user identity", () => {
    expect(
      invitationExchangeInput.safeParse({ token: "a".repeat(43) }).success,
    ).toBe(true);
    for (const token of ["", "a".repeat(42), "a".repeat(44), "/".repeat(43)])
      expect(invitationExchangeInput.safeParse({ token }).success).toBe(false);
    expect(
      invitationExchangeInput.safeParse({
        token: "a".repeat(43),
        userId: randomUUID(),
      }).success,
    ).toBe(false);
  });
  it("requires explicit versioned owner permission for non-nominal use", () => {
    expect(
      invitationPolicyInput.safeParse({ allowNonNominal: true }).success,
    ).toBe(false);
    expect(
      invitationPolicyInput.parse({ allowNonNominal: true, expectedVersion: 0 })
        .allowNonNominal,
    ).toBe(true);
  });
  it("keeps public invitation routes separate from authenticated response routes", () => {
    for (const name of [
      "invitationResponse",
      "invitationSave",
      "invitationSubmit",
      "invitationStage",
      "invitationDownload",
      "invitationClarifications",
      "invitationReply",
    ] as const)
      expect(contracts[name].path.startsWith("/invitations/access/")).toBe(
        true,
      );
    expect(contracts.saveDraft.path.startsWith("/projects/")).toBe(true);
  });
});
