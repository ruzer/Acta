import { z } from "zod";
import { publicBrandingView } from "@requirements/contracts";
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  ORGANIZATION_CODE: z
    .string()
    .min(1)
    .max(100)
    .refine((v) => v === v.trim()),
  APP_ORIGIN: z.url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  COOKIE_SECURE: z.enum(["true", "false"]).default("true"),
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().max(120).default(30),
  SESSION_MAX_HOURS: z.coerce.number().int().positive().max(24).default(8),
});
export type AppConfig = z.infer<typeof envSchema>;
export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success)
    throw new Error(
      "Configuración incompleta o inválida. Revisa las variables del README.",
    );
  const c = parsed.data;
  const origin = new URL(c.APP_ORIGIN);
  if (c.NODE_ENV === "production" && c.COOKIE_SECURE !== "true")
    throw new Error("Producción requiere cookies Secure.");
  if (
    c.COOKIE_SECURE === "false" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
  )
    throw new Error("Cookies sin Secure solo se permiten en loopback local.");
  if (c.COOKIE_SECURE === "true" && origin.protocol !== "https:")
    throw new Error("El origen requiere HTTPS con COOKIE_SECURE=true.");
  publicBranding();
  return c;
}

export function publicBranding() {
  const config = publicBrandingView.safeParse({
    appName: process.env.APP_NAME || "Acta",
    shortName: process.env.APP_SHORT_NAME || "Acta",
    organizationName: process.env.ORGANIZATION_NAME || "My organization",
    logo: process.env.APP_LOGO || "",
    favicon: process.env.APP_FAVICON || "",
    accent: process.env.APP_ACCENT || "#2b4d7c",
    locale: process.env.DEFAULT_LOCALE || "es-MX",
    timezone: process.env.DEFAULT_TIMEZONE || "UTC",
  });
  if (!config.success)
    throw new Error("Invalid public branding configuration; values omitted");
  const c = config.data;
  for (const path of [c.logo, c.favicon])
    if (
      path &&
      !/^\/branding\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|ico|svg)$/.test(path)
    )
      throw new Error("Branding assets must be local /branding/ filenames");
  try {
    new Intl.DateTimeFormat(c.locale, { timeZone: c.timezone }).format();
  } catch {
    throw new Error("Invalid locale or timezone");
  }
  // Keep white button text readable; preserve Acta's visual hierarchy.
  const channels = [1, 3, 5]
    .map((i) => parseInt(c.accent.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance =
    0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  if (1.05 / (luminance + 0.05) < 4.5)
    throw new Error(
      "APP_ACCENT must provide contrast of at least 4.5:1 with white",
    );
  return c;
}
