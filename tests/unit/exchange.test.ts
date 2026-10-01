// @vitest-environment node
import { describe, it, expect } from "vitest";
import { parseExactJson } from "../../app/backend/src/exchange/strict-json.js";
import {
  csvCell,
  markdownText,
} from "../../app/backend/src/exchange/renderers.js";
import { metrics } from "../../app/backend/src/visibility/visibility.service.js";
describe("2E boundaries", () => {
  it("rejects escaped duplicate keys, prototype keys, depth and invalid UTF8", () => {
    for (const s of [
      '{"a":1,"\\u0061":2}',
      '{"constructor":{}}',
      "[".repeat(21) + "]".repeat(21),
    ])
      expect(() => parseExactJson(Buffer.from(s))).toThrow();
    expect(() => parseExactJson(Buffer.from([0xff]))).toThrow();
    expect(parseExactJson(Buffer.from('{"exact":"FORM-014"}'))).toEqual({
      exact: "FORM-014",
    });
  });
  it("neutralizes spreadsheet formulas and controls even after spaces", () => {
    for (const s of [
      "=SUM(1,2)",
      " +cmd",
      "  -42",
      " @SUM(1)",
      "\t=2",
      "\r=2",
      "\u0001x",
    ])
      expect(csvCell(s)).toMatch(/^"'/);
    expect(csvCell("normal")).toBe('"normal"');
    expect(csvCell('a"b')).toBe('"a""b"');
  });
  it("escapes HTML, links and block syntax in Markdown", () => {
    const s = markdownText("<script>x</script> [x](javascript:x)\n# title");
    expect(s).not.toContain("<script>");
    expect(s).not.toContain("[x](javascript:");
    expect(s).not.toContain("\n# title");
    expect(markdownText("http://localhost/path")).not.toContain("http:");
  });
  it("does not count not-applicable or conflict as validated; coverage independent", () => {
    const m = metrics([
      { status: "VALIDATED", submittedRespondents: 1 },
      { status: "NOT_APPLICABLE", submittedRespondents: 0 },
      { status: "CONFLICT", submittedRespondents: 2 },
    ]);
    expect(m.validation.numerator).toBe(1);
    expect(m.closure.numerator).toBe(2);
    expect(m.submission.numerator).toBe(2);
    expect(metrics([]).validation.percentage).toBeNull();
  });
});
