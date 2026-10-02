// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  templateInput,
  questionTypes,
  type TemplateInput,
} from "@requirements/contracts";
import { inspectTemplate } from "../../app/backend/src/exchange/template.js";

const read = (kind: string) =>
  readFileSync(
    new URL(
      `../../examples/questionnaire-template.${kind}.json`,
      import.meta.url,
    ),
  );
describe("Public import examples use the production validation chain", () => {
  for (const kind of ["minimal", "full"]) {
    it(`${kind} passes strict parsing, schema and semantic validation`, () => {
      const result = inspectTemplate(read(kind));
      expect(result.errors).toEqual([]);
      expect(templateInput.safeParse(result.data).success).toBe(true);
      expect(result.counts.questions).toBe(kind === "minimal" ? 2 : 10);
      expect(result.counts.sections).toBe(kind === "minimal" ? 1 : 4);
      expect(result.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    });
  }
  it("full demonstrates all types and separates grouping from conditions", () => {
    const { data } = inspectTemplate(read("full"));
    expect(new Set(data!.questions.map((q) => q.type))).toEqual(
      new Set(questionTypes),
    );
    expect(
      data!.questions.find((q) => q.externalId === "REQ-007")
        ?.groupParentExternalId,
    ).toBe("REQ-006");
    expect(
      data!.conditions.some((c) => c.childQuestionExternalId === "REQ-007"),
    ).toBe(false);
    expect(
      data!.conditions.some((c) => c.childQuestionExternalId === "REQ-008"),
    ).toBe(true);
  });
  it("preserves distinct near-identical identifiers", () => {
    const { data } = inspectTemplate(read("minimal"));
    expect(data!.questions.map((q) => q.externalId)).toEqual([
      "REQ-001",
      "REQ-01",
    ]);
  });
  it("does not admit unknown fields, coercion, unsafe identifiers or URLs", () => {
    for (const mutate of [
      (d: TemplateInput & { responses?: unknown }) => {
        d.responses = [];
      },
      (d: TemplateInput) => {
        Object.assign(d.questions[0], { required: "true" });
      },
      (d: TemplateInput) => {
        d.questions[0].externalId = "../example";
      },
      (d: TemplateInput) => {
        d.traceabilityReferences[0].url = "javascript:alert(1)";
      },
      (d: TemplateInput) => {
        d.questions[0].sectionExternalId = "MISSING";
      },
    ]) {
      const data = JSON.parse(read("full").toString());
      mutate(data);
      expect(
        inspectTemplate(Buffer.from(JSON.stringify(data))).errors.length,
      ).toBeGreaterThan(0);
    }
  });
  it("rejects duplicate/prototype keys, excessive size/depth and invalid UTF8", () => {
    for (const bytes of [
      Buffer.from('{"kind":"questionnaire-template","kind":"project-export"}'),
      Buffer.from('{"__proto__":{}}'),
      Buffer.from('{"constructor":{}}'),
      Buffer.from("[".repeat(21) + "]".repeat(21)),
      Buffer.alloc(5 * 1024 * 1024 + 1, 32),
      Buffer.from([0xff]),
    ])
      expect(inspectTemplate(bytes).errors.length).toBeGreaterThan(0);
  });
});
