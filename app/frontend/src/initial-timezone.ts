import type { SettingField } from "@requirements/contracts";

export function isValidTimezone(value: string) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("es-MX", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** La propuesta del navegador nunca sustituye una elección ya configurada. */
export function initialTimezone(field: SettingField) {
  if (field.source !== "default") return field.value;
  try {
    const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimezone(browserZone) ? browserZone : field.value;
  } catch {
    return field.value;
  }
}
