/** Next free identifier in the "P-001" style among the ones the project already uses. */
export function nextQuestionId(existing: Iterable<string>) {
  let max = 0;
  for (const id of existing) {
    const match = /^P-(\d+)$/i.exec(id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `P-${String(max + 1).padStart(3, "0")}`;
}

/** A short title taken from the first sentence of the statement, cut at a word. No external service. */
export function suggestTitle(statement: string, max = 80) {
  const text = statement
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[¿¡]+/, "");
  const sentence = (text.split(/(?<=[.?!])\s/)[0] ?? "").replace(
    /[.?!:;,\s]+$/,
    "",
  );
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (
    (space > max / 2 ? cut.slice(0, space) : cut).replace(/[,:;\s]+$/, "") + "…"
  );
}
