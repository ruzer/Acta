import type { PublicBranding } from "@requirements/contracts";

type DateSettings = Pick<PublicBranding, "locale" | "timezone">;

/** Un día de calendario no es un instante: conserva sus partes sin aplicar zona. */
export function formatCalendarDate(date: string) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return parts ? `${parts[3]}/${parts[2]}/${parts[1]}` : date;
}

/** Los instantes se muestran en la zona de la organización, no del navegador. */
export function formatDateTime(
  date: string,
  settings: DateSettings,
  endSentence = false,
) {
  const formatted = new Intl.DateTimeFormat(settings.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: settings.timezone,
  }).format(new Date(date));
  return endSentence ? `${formatted.replace(/\.$/, "")}.` : formatted;
}

export function formatClockTime(date: string, settings: DateSettings) {
  return new Intl.DateTimeFormat(settings.locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: settings.timezone,
  }).format(new Date(date));
}
