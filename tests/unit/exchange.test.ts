// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  answerText,
  type ResponseQuestionView,
  type ResponseContent,
} from "@requirements/contracts";
import { snapshotName } from "../../app/backend/src/common/snapshot.js";
import { parseExactJson } from "../../app/backend/src/exchange/strict-json.js";
import {
  csvCell,
  markdownHeading,
  markdownText,
} from "../../app/backend/src/exchange/renderers.js";
import {
  excerpt,
  metrics,
} from "../../app/backend/src/visibility/visibility.service.js";
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
    expect(markdownText("http://localhost/path")).toBe(
      "http:&#47;/localhost/path",
    );
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
describe("decision excerpts", () => {
  it("keeps a short text whole, on one line", () => {
    expect(excerpt("  Se adopta\n el registro  único. ", 240)).toEqual({
      text: "Se adopta el registro único.",
      truncated: false,
    });
  });
  it("cuts a long text at a word and says so, never returning the document", () => {
    const text = "palabra ".repeat(200) + "FINAL-SECRETO";
    const cut = excerpt(text, 100);
    expect(cut.truncated).toBe(true);
    expect(cut.text.length).toBeLessThanOrEqual(101);
    expect(cut.text.endsWith("palabra…")).toBe(true);
    expect(cut.text).not.toContain("FINAL-SECRETO");
  });
  it("cuts a long unbroken text at the limit and a text of exactly the limit stays whole", () => {
    expect(excerpt("x".repeat(150), 100).text).toBe("x".repeat(100) + "…");
    expect(excerpt("y".repeat(100), 100)).toEqual({
      text: "y".repeat(100),
      truncated: false,
    });
  });
});

describe("readable Markdown", () => {
  it.each([
    ["¿Qué significa este signo? #", "¿Qué significa este signo? \\#"],
    [
      "¿Qué significan estos signos? ##",
      "¿Qué significan estos signos? \\#\\#",
    ],
    [
      " Primera línea\nsegunda  línea\tcon detalles ",
      "Primera línea segunda línea con detalles",
    ],
    ["#", "\\#"],
    ["##", "\\##"],
    ["Texto con # intermedio", "Texto con # intermedio"],
  ])(
    "keeps the whole question in its Markdown heading: %s",
    (input, expected) => {
      expect(markdownHeading(input)).toBe(expected);
    },
  );
  it("keeps line breaks and spacing in non-heading Markdown", () => {
    expect(markdownText("Primera línea\nsegunda  línea")).toBe(
      "Primera línea  \nsegunda  línea",
    );
  });
  it.each([
    "ftp://x.y",
    "file:///etc/passwd",
    "sftp://x.y",
    "custom+demo://x.y",
  ])("neutralizes every scheme separator: %s", (input) => {
    expect(markdownText(input)).toBe(input.replace("://", ":&#47;/"));
  });
  it.each([
    ["YES_NO", true, "Sí"],
    ["YES_NO", false, "No"],
    ["SINGLE_CHOICE", "A", "Opción A"],
    ["MULTIPLE_CHOICE", ["B", "A"], "Opción B, Opción A"],
    ["SHORT_TEXT", "Texto breve", "Texto breve"],
    ["LONG_TEXT", "Una línea\nOtra línea", "Una línea\nOtra línea"],
    ["DATE", "2026-11-09", "2026-11-09"],
    ["NUMBER", "42.25", "42.25"],
    [
      "MATRIX",
      { first: "A", second: "B" },
      "Primera: Opción A\nSegunda: Opción B",
    ],
  ])("shares the interface formatter for %s", (type, value, expected) => {
    const question = {
      type: type as ResponseQuestionView["type"],
      options: [
        { value: "A", label: "Opción A", order: 0 },
        { value: "B", label: "Opción B", order: 1 },
      ],
      config: {
        rows: [
          { key: "first", label: "Primera" },
          { key: "second", label: "Segunda" },
        ],
        columns: [
          { key: "A", label: "Opción A" },
          { key: "B", label: "Opción B" },
        ],
      },
    };
    expect(answerText(question, value as ResponseContent["answer"])).toBe(
      expected,
    );
  });
  it.each([
    ["<script>alert(1)</script>", "&lt;script&gt;alert(1)&lt;/script&gt;"],
    ["[x](javascript:alert(1))", "\\[x\\](javascript:alert(1))"],
    ["![i](http://x/y.png)", "!\\[i\\](http:&#47;/x/y.png)"],
    ["```js\nalert(1)\n```", "\\`\\`\\`js  \nalert(1)  \n\\`\\`\\`"],
    [
      "# título\n- lista\n> cita\n| tabla |",
      "\\# título  \n\\- lista  \n&gt; cita  \n\\| tabla \\|",
    ],
    [
      "1. paso\n+ paso\n===\n~~borrar~~",
      "1\\. paso  \n\\+ paso  \n\\===  \n\\~\\~borrar\\~\\~",
    ],
    [
      "    bloque\n&amp;lt;script&amp;gt;",
      "&#32;&#32;&#32;&#32;bloque  \n&amp;amp;lt;script&amp;amp;gt;",
    ],
  ])("neutralizes active Markdown/HTML: %s", (input, expected) => {
    expect(markdownText(input)).toBe(expected);
  });
  it("keeps punctuation in identifiers and ISO dates intact", () => {
    expect(markdownText("FORM-DEMO-01 · 2026-11-09T12:41:00.000Z")).toBe(
      "FORM-DEMO-01 · 2026-11-09T12:41:00.000Z",
    );
  });
});

describe("historical snapshot display names", () => {
  it.each([{}, [], null, 42, "unexpected", { displayName: false, name: 42 }])(
    "falls back for malformed snapshots %j",
    (snapshot) => {
      expect(snapshotName(snapshot, "displayName", "Autor no registrado")).toBe(
        "Autor no registrado",
      );
      expect(snapshotName(snapshot, "name", "Área no registrada")).toBe(
        "Área no registrada",
      );
      expect(snapshotName(snapshot, "identityKind", "ACCOUNT")).toBe("ACCOUNT");
    },
  );
  it("preserves valid names and invitation kind, escaping only for Markdown", () => {
    const snapshot = {
      displayName: "Persona <ficticia>",
      name: "Área [ejemplo]",
      identityKind: "INVITATION",
    };
    expect(snapshotName(snapshot, "displayName", "fallback")).toBe(
      snapshot.displayName,
    );
    expect(
      markdownText(snapshotName(snapshot, "displayName", "fallback")),
    ).toBe("Persona &lt;ficticia&gt;");
    expect(snapshotName(snapshot, "name", "fallback")).toBe(snapshot.name);
    expect(snapshotName(snapshot, "identityKind", "ACCOUNT")).toBe(
      "INVITATION",
    );
    expect(
      snapshotName(
        { displayName: "Cuenta histórica" },
        "identityKind",
        "ACCOUNT",
      ),
    ).toBe("ACCOUNT");
  });
});
