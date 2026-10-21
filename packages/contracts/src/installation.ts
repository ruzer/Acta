import { z } from "zod";

/*
 * First-run setup and the administration center (settings, branding, system
 * status). Everything here is a read model or a command: no secret, credential
 * or stored token ever appears in an output.
 */

/** Contrast of white text on an accent color: WCAG relative luminance. */
export const minimumAccentContrast = 4.5;
export function accentContrast(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance =
    0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  return 1.05 / (luminance + 0.05);
}

/** Regional formats the interface can use. The language of the interface itself is Spanish. */
export const localeOptions = [
  { value: "es-MX", label: "Español (México)" },
  { value: "es-ES", label: "Español (España)" },
  { value: "es-CO", label: "Español (Colombia)" },
  { value: "es-AR", label: "Español (Argentina)" },
  { value: "es-CL", label: "Español (Chile)" },
  { value: "es-PE", label: "Español (Perú)" },
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
] as const;
const localeValues = localeOptions.map((o) => o.value) as [string, ...string[]];

const accent = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Usa un color hexadecimal, por ejemplo #2b4d7c.")
  .refine(
    (value) => accentContrast(value) >= minimumAccentContrast,
    "El color es demasiado claro: el texto blanco no se leería bien sobre él.",
  );
const timezone = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/,
    "Zona horaria no válida.",
  );
const appName = z.string().trim().min(1, "Escribe un nombre.").max(100);
const shortName = z.string().trim().min(1, "Escribe un nombre.").max(40);
/** The entity of the optional second logo (an area or a collaborating body). Empty is allowed: it is optional. */
const secondaryName = z.string().trim().max(200);
const organizationName = z
  .string()
  .trim()
  .min(1, "Escribe un nombre.")
  .max(200);

/**
 * Who controls a value. "external": the infrastructure defines it (an environment
 * variable) and the application only shows it. "saved": an administrator chose it
 * here. "default": nobody chose, the product default applies.
 */
export const settingSource = z.enum(["external", "saved", "default"]);
export const appearanceKeys = [
  "appName",
  "shortName",
  "accent",
  "locale",
  "timezone",
  "secondaryName",
] as const;
export const appearanceKey = z.enum(appearanceKeys);
export type AppearanceKey = z.infer<typeof appearanceKey>;
export const settingField = z.strictObject({
  value: z.string(),
  source: settingSource,
  /** The environment variable that controls it when the source is "external". */
  variable: z.string().nullable(),
});
export type SettingField = z.infer<typeof settingField>;
export const appearanceFields = z.strictObject({
  appName: settingField,
  shortName: settingField,
  accent: settingField,
  locale: settingField,
  timezone: settingField,
  secondaryName: settingField,
});
export type AppearanceFields = z.infer<typeof appearanceFields>;

/** What an administrator can choose about the look of the installation. */
export const appearanceChoices = z.strictObject({
  appName,
  shortName,
  accent,
  locale: z.enum(localeValues),
  timezone,
  secondaryName,
});
export type AppearanceChoices = z.infer<typeof appearanceChoices>;

// ---------------------------------------------------------------- first run
/** PENDING: the wizard can run. COMPLETED: an administrator exists. DISABLED: the operator turned the wizard off. */
export const setupStateValue = z.enum(["PENDING", "COMPLETED", "DISABLED"]);
export const setupStatusView = z.strictObject({ state: setupStateValue });
/** The setup code is a random 256-bit value shown only to the operator. */
export const setupCode = z
  .string()
  .trim()
  .min(20, "El código de instalación está incompleto.")
  .max(200);
export const setupVerifyInput = z.strictObject({ token: setupCode });
export const setupDefaultsView = z.strictObject({
  organizationCode: z.string(),
  organizationName: z.string(),
  appearance: appearanceFields,
});
export const setupVerifyView = z.strictObject({ defaults: setupDefaultsView });
export const checkResult = z.enum(["ok", "unavailable"]);
export const setupChecksView = z.strictObject({
  database: checkResult,
  storage: checkResult,
  storageProvider: z.enum(["LOCAL", "S3"]),
  /** True when the browser reaches the installation over HTTPS or loopback. */
  secureOrigin: z.boolean(),
  origin: z.string(),
});
export const setupAdministratorInput = z.strictObject({
  username: z
    .string()
    .regex(
      /^[a-zA-Z0-9._-]{3,64}$/,
      "Usa de 3 a 64 letras, números, punto, guion o guion bajo.",
    ),
  displayName: z.string().trim().min(1, "Escribe tu nombre.").max(200),
  password: z
    .string()
    .min(12, "Usa al menos 12 caracteres.")
    .max(128, "Usa como máximo 128 caracteres."),
});
export const setupCompleteInput = z.strictObject({
  token: setupCode,
  administrator: setupAdministratorInput,
  organization: z.strictObject({ name: organizationName }),
  /** Only values the infrastructure does not control; the server refuses the others. */
  appearance: appearanceChoices.partial(),
});
export type SetupStatus = z.infer<typeof setupStatusView>;
export type SetupDefaults = z.infer<typeof setupDefaultsView>;
export type SetupChecks = z.infer<typeof setupChecksView>;
export type SetupCompleteInput = z.infer<typeof setupCompleteInput>;

// ---------------------------------------------------------------- settings
export const brandingAssetKinds = ["logo", "logoSecondary", "favicon"] as const;
export const brandingAssetKind = z.enum(brandingAssetKinds);
export type BrandingAssetKind = z.infer<typeof brandingAssetKind>;
/** The kinds of image an installation accepts, with the largest size of each. */
export const brandingAssetLimits = {
  logo: { maxBytes: 512 * 1024, types: ["image/png", "image/jpeg"] },
  logoSecondary: { maxBytes: 512 * 1024, types: ["image/png", "image/jpeg"] },
  favicon: { maxBytes: 128 * 1024, types: ["image/png", "image/x-icon"] },
} as const;
export const settingsAssetView = z.strictObject({
  /** Public address of the image, or "" when none is configured. */
  url: z.string(),
  /** "external": APP_LOGO / APP_FAVICON; "saved": uploaded here; "default": none. */
  source: settingSource,
  variable: z.string().nullable(),
  byteSize: z.number().int().nonnegative().nullable(),
});
export const settingsView = z.strictObject({
  version: z.number().int().nonnegative(),
  organizationName: z.string(),
  appName: settingField,
  shortName: settingField,
  accent: settingField,
  locale: settingField,
  timezone: settingField,
  secondaryName: settingField,
  logo: settingsAssetView,
  logoSecondary: settingsAssetView,
  favicon: settingsAssetView,
  /** The lowest contrast accepted, so the form can explain a rejected color. */
  minimumContrast: z.number(),
});
export const settingsInput = z
  .strictObject({
    expectedVersion: z.number().int().nonnegative(),
    organizationName: organizationName.optional(),
    appName: appName.optional(),
    shortName: shortName.optional(),
    accent: accent.optional(),
    locale: z.enum(localeValues).optional(),
    timezone: timezone.optional(),
    secondaryName: secondaryName.optional(),
    /** Saved choices listed here are removed and the default applies again. */
    reset: z.array(appearanceKey).max(5).optional(),
  })
  .refine(
    (input) => Object.keys(input).some((key) => key !== "expectedVersion"),
    "No hay cambios que guardar.",
  );
export const assetCommandView = z.strictObject({
  version: z.number().int().nonnegative(),
  asset: settingsAssetView,
});
export const assetRemoveInput = z.strictObject({
  expectedVersion: z.number().int().nonnegative(),
});
export type SettingsView = z.infer<typeof settingsView>;
export type SettingsInput = z.infer<typeof settingsInput>;
export type SettingsAssetView = z.infer<typeof settingsAssetView>;

// ------------------------------------------------------------------ system
export const systemStatusView = z.strictObject({
  version: z.string(),
  environment: z.enum(["development", "test", "production"]),
  checkedAt: z.iso.datetime(),
  database: z.strictObject({ status: checkResult }),
  storage: z.strictObject({
    status: checkResult,
    provider: z.enum(["LOCAL", "S3"]),
    /** Host of the S3 endpoint, never a credential. "" for local storage. */
    endpointHost: z.string(),
    bucket: z.string(),
    region: z.string(),
    evidenceByBackend: z.array(
      z.strictObject({
        backend: z.enum(["LOCAL", "MINIO", "S3"]),
        files: z.number().int().nonnegative(),
      }),
    ),
  }),
  security: z.strictObject({
    origin: z.string(),
    https: z.boolean(),
    secureCookies: z.boolean(),
    sessionIdleMinutes: z.number().int(),
    sessionMaxHours: z.number().int(),
    invitationIdentity: z.enum(["NONE", "NAME", "EMAIL", "BOTH"]),
    invitationDefaultDays: z.number().int(),
    invitationMaxDays: z.number().int(),
  }),
  limits: z.strictObject({
    evidenceMaxBytes: z.number().int(),
    evidenceMaxAttachments: z.number().int(),
    evidenceProjectBytes: z.number().int(),
    importMaxBytes: z.number().int(),
  }),
});
export const storageTestView = z.strictObject({
  status: checkResult,
  provider: z.enum(["LOCAL", "S3"]),
  checkedAt: z.iso.datetime(),
});
export type SystemStatus = z.infer<typeof systemStatusView>;
