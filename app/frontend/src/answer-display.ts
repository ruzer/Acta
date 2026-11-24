import { answerText } from "@requirements/contracts";
import { formatCalendarDate } from "./date-format";

/** Solo cambia la lectura en pantalla; el contrato y los exportes conservan ISO. */
export function answerDisplay(...args: Parameters<typeof answerText>): string {
  const text = answerText(...args);
  return args[0].type === "DATE" ? formatCalendarDate(text) : text;
}
