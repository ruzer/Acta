/**
 * Spanish count + noun with the right number: `plural(1, "pregunta")` is
 * "1 pregunta" and `plural(0, "pregunta")` is "0 preguntas". Pass the plural
 * when it is not the singular plus "s" (`plural(2, "aportación", "aportaciones")`)
 * or when an adjective has to agree (`"pregunta publicada"`).
 */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
