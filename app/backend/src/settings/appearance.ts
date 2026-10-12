import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  appearanceKeys,
  type AppearanceFields,
  type AppearanceKey,
  type BrandingAssetKind,
} from "@requirements/contracts";

/*
 * Who decides each value of the look of the installation.
 *
 * Acta supports two ways to install it and they must not fight each other:
 *  - advanced: environment variables (.env, a secret manager, CI/CD). Whatever
 *    the infrastructure defines wins and the application only shows it as
 *    managed externally. Nothing here can overwrite it.
 *  - guided: the first-run wizard and the settings screen. They only write the
 *    values the infrastructure leaves open.
 * An empty or absent variable means "not defined by the infrastructure".
 */
export { appearanceKeys };
export type { AppearanceKey };

export const appearanceVariables: Record<AppearanceKey, string> = {
  appName: "APP_NAME",
  shortName: "APP_SHORT_NAME",
  accent: "APP_ACCENT",
  locale: "DEFAULT_LOCALE",
  timezone: "DEFAULT_TIMEZONE",
};
export const assetVariables: Record<BrandingAssetKind, string> = {
  logo: "APP_LOGO",
  favicon: "APP_FAVICON",
};
export const productDefaults: Record<AppearanceKey, string> = {
  appName: "Acta",
  shortName: "Acta",
  accent: "#2b4d7c",
  locale: "es-MX",
  timezone: "UTC",
};

/** The value the infrastructure defines, or null when it leaves the choice open. */
export function externalValue(variable: string) {
  const value = process.env[variable]?.trim();
  return value ? value : null;
}
export function externalAppearance(key: AppearanceKey) {
  return externalValue(appearanceVariables[key]);
}

export type SavedAppearance = Partial<Record<AppearanceKey, string | null>>;
export function resolveAppearance(
  saved: SavedAppearance | null,
): AppearanceFields {
  const field = (key: AppearanceKey) => {
    const variable = appearanceVariables[key];
    const external = externalValue(variable);
    if (external)
      return { value: external, source: "external" as const, variable };
    const chosen = saved?.[key];
    if (chosen)
      return { value: chosen, source: "saved" as const, variable: null };
    return {
      value: productDefaults[key],
      source: "default" as const,
      variable: null,
    };
  };
  return {
    appName: field("appName"),
    shortName: field("shortName"),
    accent: field("accent"),
    locale: field("locale"),
    timezone: field("timezone"),
  };
}

/** A value the panel was asked to change although the infrastructure controls it. */
export function refuseExternal(keys: readonly AppearanceKey[]) {
  const locked = keys.filter((key) => externalAppearance(key));
  if (locked.length)
    throw new ConflictException({
      message: `${locked.map((key) => appearanceVariables[key]).join(", ")} ${locked.length > 1 ? "están definidas" : "está definida"} por la infraestructura y no se puede cambiar desde Acta.`,
      fieldErrors: Object.fromEntries(
        locked.map((key) => [
          key,
          `Administrado externamente (${appearanceVariables[key]}).`,
        ]),
      ),
    });
}

/** A validation failure the form can show next to its field. */
export function fieldError(field: string, message: string) {
  return new BadRequestException({
    message: "Revisa los campos indicados.",
    fieldErrors: { [field]: message },
  });
}

/** Accept only a real IANA zone; Intl rejects anything else. */
export function assertTimezone(zone: string, field = "timezone") {
  const known = new Set<string>(Intl.supportedValuesOf("timeZone"));
  known.add("UTC");
  if (!known.has(zone))
    throw fieldError(field, "Elige una zona horaria de la lista.");
  try {
    new Intl.DateTimeFormat("es-MX", { timeZone: zone }).format();
  } catch {
    throw fieldError(field, "Elige una zona horaria de la lista.");
  }
}
