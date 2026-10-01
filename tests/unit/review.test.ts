// @vitest-environment node
import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { projectedStatus } from "../../app/backend/src/review/review-state";
import {
  validateQuestionInput,
  markConflictInput,
  reviewInboxQuery,
} from "@requirements/contracts";
const empty = {
  conflict: false,
  clarification: false,
  validated: false,
  notApplicable: false,
  partial: false,
  submitted: 0,
  missing: 0,
  consult: false,
  pending: false,
};
describe("Precedencia de revisión", () => {
  it("respeta todos los estados incluso con banderas simultáneas", () => {
    expect(projectedStatus(empty)).toBe("NOT_REVIEWED");
    const value = { ...empty, pending: true };
    expect(projectedStatus(value)).toBe("PENDING");
    value.submitted = 1;
    expect(projectedStatus(value)).toBe("ANSWERED");
    value.partial = true;
    expect(projectedStatus(value)).toBe("PARTIAL");
    value.notApplicable = true;
    expect(projectedStatus(value)).toBe("NOT_APPLICABLE");
    value.validated = true;
    expect(projectedStatus(value)).toBe("VALIDATED");
    value.clarification = true;
    expect(projectedStatus(value)).toBe("CLARIFICATION_REQUIRED");
    value.conflict = true;
    expect(projectedStatus(value)).toBe("CONFLICT");
  });
  it("falta de cobertura y consulta distinguen parcial de pendiente sin volver no aplica", () => {
    expect(projectedStatus({ ...empty, submitted: 1, missing: 1 })).toBe(
      "PARTIAL",
    );
    expect(projectedStatus({ ...empty, consult: true })).toBe("PENDING");
    expect(projectedStatus({ ...empty, submitted: 1, consult: true })).toBe(
      "PARTIAL",
    );
    expect(projectedStatus({ ...empty, validated: true, consult: true })).toBe(
      "VALIDATED",
    );
  });
});
describe("Límites de contratos de revisión", () => {
  it("no admite autores/estados impuestos ni fuentes duplicadas", () => {
    const id = randomUUID(),
      d = {
        requestId: randomUUID(),
        expectedVersion: 0,
        decisionText: "Decisión",
        scope: "Caso",
        validationComment: "Revisado",
        responseRevisionIds: [id],
      };
    expect(validateQuestionInput.safeParse(d).success).toBe(true);
    expect(
      validateQuestionInput.safeParse({ ...d, validatedById: randomUUID() })
        .success,
    ).toBe(false);
    expect(
      validateQuestionInput.safeParse({ ...d, responseRevisionIds: [id, id] })
        .success,
    ).toBe(false);
    expect(
      validateQuestionInput.safeParse({ ...d, decisionText: " " }).success,
    ).toBe(false);
  });
  it("conflicto exige dos fuentes y la bandeja limita paginación", () => {
    expect(
      markConflictInput.safeParse({
        requestId: randomUUID(),
        expectedVersion: 0,
        reason: "Distintas",
        responseRevisionIds: [randomUUID()],
      }).success,
    ).toBe(false);
    expect(reviewInboxQuery.safeParse({ page: 0 }).success).toBe(false);
    expect(reviewInboxQuery.safeParse({ pageSize: 101 }).success).toBe(false);
    expect(reviewInboxQuery.parse({ page: "2" }).page).toBe(2);
  });
});
