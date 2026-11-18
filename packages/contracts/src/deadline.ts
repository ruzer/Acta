const day = 86400000;
export function responseCalendarDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((key) => parts.find((p) => p.type === key)!.value)
    .join("-");
}
export function endOfResponseDay(date: string, timezone: string) {
  const utc = Date.parse(`${date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(utc) ||
    new Date(utc).toISOString().slice(0, 10) !== date
  )
    throw new Error("Indica una fecha válida.");
  // Buscar el límite del calendario respeta cambios de horario, incluso días de 23 o 25 horas.
  let low = utc - 2 * day,
    high = utc + 2 * day;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (responseCalendarDate(new Date(middle), timezone) <= date) low = middle;
    else high = middle;
  }
  if (responseCalendarDate(new Date(low), timezone) !== date)
    throw new Error("La fecha no existe en la zona horaria configurada.");
  return new Date(low).toISOString();
}
export function responseDueLabel(
  value: string | null | undefined,
  timezone: string,
  now = new Date(),
) {
  if (!value) return "";
  const date = new Date(value);
  const difference = Math.round(
    (Date.parse(responseCalendarDate(date, timezone)) -
      Date.parse(responseCalendarDate(now, timezone))) /
      day,
  );
  const full = new Intl.DateTimeFormat("es-MX", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return difference < 0
    ? `Venció el ${full}`
    : difference === 0
      ? `Vence hoy · ${full}`
      : difference <= 7
        ? `Vence en ${difference} ${difference === 1 ? "día" : "días"} · ${full}`
        : `Vence el ${full}`;
}
