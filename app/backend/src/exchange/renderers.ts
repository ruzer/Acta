/* eslint-disable no-control-regex -- Explicit control-byte ranges are part of export injection protection. */
export function csvCell(value: unknown) {
  let s = value === null || value === undefined ? "" : String(value);
  // Protect formulas including those hidden behind whitespace/control characters.
  if (
    /^[\s\u0000-\u001f\u007f]*[=+@-]/u.test(s) ||
    /[\u0000-\u001f\u007f]/u.test(s)
  )
    s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function markdownText(value: unknown): string {
  const s = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return (
    s
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .replace(/\r\n?/g, "\n")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replace(/[\\`*_[\]|~]/g, "\\$&")
      .replace(/^([ \t]*)([#+\-=])/gm, "$1\\$2")
      .replace(/^([ \t]*\d+)([.)])(?=\s)/gm, "$1\\$2")
      .replace(/^[ \t]+/gm, (space) => "&#32;".repeat(space.length))
      // GFM also auto-links bare URLs/emails; neutralize those without escaping dates/codes.
      .replace(/:\/\//g, ":&#47;/")
      .replace(/\bwww\./gi, "www&#46;")
      .replaceAll("@", "&#64;")
      .replaceAll("\n", "  \n")
  );
}
export function markdownHeading(value: string) {
  return markdownText(value.replace(/\s+/g, " ").trim()).replace(
    / (#+)$/,
    (_, hashes: string) => ` ${"\\#".repeat(hashes.length)}`,
  );
}
export const csvFields = [
  "projectExternalId",
  "sectionExternalId",
  "questionExternalId",
  "title",
  "priority",
  "responsibleArea",
  "status",
  "published",
  "archived",
  "submittedRespondents",
  "requiredRespondents",
  "validatedBy",
  "validatedAt",
  "validationId",
  "traceabilityIds",
  "exportedAt",
] as const;
export function csvDocument(rows: Record<string, unknown>[]) {
  return (
    "\uFEFF" +
    [
      csvFields.join(","),
      ...rows.map((r) => csvFields.map((k) => csvCell(r[k])).join(",")),
    ].join("\r\n") +
    "\r\n"
  );
}
