import {
  responseCalendarDate,
  responseDueLabel as contractResponseDueLabel,
} from "@requirements/contracts";
import { formatCalendarDate } from "./date-format";

/** Nombre legible; Intl conserva el nombre genérico de las demás zonas IANA. */
export function timezoneLabel(timezone: string) {
  const formatter = new Intl.DateTimeFormat("es-MX", {
    timeZone: timezone,
    timeZoneName: "longGeneric",
  });
  const canonical = formatter.resolvedOptions().timeZone;
  if (canonical === "America/Mexico_City") return "hora de Ciudad de México";
  if (canonical === "UTC") return "hora universal (UTC)";
  return formatter
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")!.value;
}

/** Conserva la lógica del contrato; solo cambia la fecha visible y aclara la zona. */
export function responseDueLabel(
  value: string | null | undefined,
  timezone: string,
  now = new Date(),
) {
  const text = contractResponseDueLabel(value, timezone, now);
  if (!value) return text;
  const date = new Date(value);
  const originalDate = new Intl.DateTimeFormat("es-MX", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const calendar = formatCalendarDate(responseCalendarDate(date, timezone));
  return `${text.replace(originalDate, calendar)} · ${timezoneLabel(timezone)}`;
}
