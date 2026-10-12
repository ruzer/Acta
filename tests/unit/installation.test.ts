import { afterEach, describe, expect, it } from "vitest";
import { crc32, deflateSync } from "node:zlib";
import {
  accentContrast,
  minimumAccentContrast,
  setupCompleteInput,
  settingsInput,
} from "@requirements/contracts";
import {
  externalValue,
  resolveAppearance,
} from "../../app/backend/src/settings/appearance";
import { inspectImage } from "../../app/backend/src/settings/branding-image";
import { SettingsService } from "../../app/backend/src/settings/settings.service";
import {
  codeIsValid,
  hashSetupCode,
  setupCodeMatches,
} from "../../app/backend/src/setup/setup-core";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});
const variables = [
  "APP_NAME",
  "APP_SHORT_NAME",
  "APP_ACCENT",
  "DEFAULT_LOCALE",
  "DEFAULT_TIMEZONE",
  "APP_LOGO",
  "APP_FAVICON",
];
function clearEnvironment() {
  for (const variable of variables) delete process.env[variable];
}

describe("accent contrast", () => {
  it("measures white text on a color as WCAG does", () => {
    expect(accentContrast("#000000")).toBeCloseTo(21, 0);
    expect(accentContrast("#ffffff")).toBeCloseTo(1, 1);
    expect(accentContrast("#2b4d7c")).toBeGreaterThan(minimumAccentContrast);
    expect(accentContrast("#999999")).toBeLessThan(minimumAccentContrast);
  });
  it("the same rule guards the wizard and the settings screen", () => {
    expect(
      settingsInput.safeParse({ expectedVersion: 0, accent: "#eeeeee" })
        .success,
    ).toBe(false);
    expect(
      settingsInput.safeParse({ expectedVersion: 0, accent: "#1b4b8c" })
        .success,
    ).toBe(true);
    expect(settingsInput.safeParse({ expectedVersion: 0 }).success).toBe(false);
    expect(
      settingsInput.safeParse({ expectedVersion: 0, css: "x" }).success,
    ).toBe(false);
  });
});

describe("who decides a value", () => {
  it("an environment variable puts the value under external control", () => {
    clearEnvironment();
    process.env.APP_NAME = "  Nombre .env ";
    process.env.APP_SHORT_NAME = "   ";
    const fields = resolveAppearance({
      appName: "Guardado",
      shortName: "Corto guardado",
      accent: "#1b4b8c",
    });
    expect(fields.appName).toEqual({
      value: "Nombre .env",
      source: "external",
      variable: "APP_NAME",
    });
    // A blank variable is "not defined": the saved choice applies.
    expect(fields.shortName).toEqual({
      value: "Corto guardado",
      source: "saved",
      variable: null,
    });
    expect(fields.accent.source).toBe("saved");
    expect(fields.locale).toEqual({
      value: "es-MX",
      source: "default",
      variable: null,
    });
    expect(externalValue("APP_SHORT_NAME")).toBeNull();
  });
  it("without environment or choices the product defaults apply", () => {
    clearEnvironment();
    const fields = resolveAppearance(null);
    expect(Object.values(fields).map((f) => f.source)).toEqual([
      "default",
      "default",
      "default",
      "default",
      "default",
    ]);
    expect([
      fields.appName.value,
      fields.accent.value,
      fields.timezone.value,
    ]).toEqual(["Acta", "#2b4d7c", "UTC"]);
  });
});

describe("setup code", () => {
  const code = "x".repeat(43);
  const row = (minutes: number, hash: string | null = hashSetupCode(code)) => ({
    tokenHash: hash,
    tokenExpiresAt: new Date(Date.now() + minutes * 60000),
  });
  it("only the issued, unexpired code is valid, whatever the spacing around it", () => {
    expect(codeIsValid(row(5), code)).toBe(true);
    expect(codeIsValid(row(5), ` ${code}\n`)).toBe(true);
    expect(codeIsValid(row(-1), code)).toBe(false);
    expect(codeIsValid(row(5), "y".repeat(43))).toBe(false);
    expect(codeIsValid(row(5, null), code)).toBe(false);
    expect(codeIsValid(null, code)).toBe(false);
    expect(setupCodeMatches(code, undefined)).toBe(false);
  });
  it("the wizard accepts a partial appearance and refuses a short code", () => {
    const valid = {
      token: code,
      administrator: {
        username: "admin.uno",
        displayName: "Persona",
        password: "una-clave-larga-1",
      },
      organization: { name: "Institución" },
      appearance: {},
    };
    expect(setupCompleteInput.safeParse(valid).success).toBe(true);
    expect(
      setupCompleteInput.safeParse({ ...valid, token: "corto" }).success,
    ).toBe(false);
    expect(
      setupCompleteInput.safeParse({
        ...valid,
        administrator: { ...valid.administrator, password: "corta" },
      }).success,
    ).toBe(false);
    expect(
      setupCompleteInput.safeParse({
        ...valid,
        appearance: { accent: "#fff000" },
      }).success,
    ).toBe(false);
  });
});

describe("stored images", () => {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const png = (width: number, height = width) => {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header.set([8, 2, 0, 0, 0], 8);
    const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 7)]);
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk(
        "IDAT",
        deflateSync(Buffer.concat(Array.from({ length: height }, () => row))),
      ),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  };
  it("recognizes a type by its bytes, never by what it claims to be", () => {
    const image = inspectImage("logo", png(40, 20));
    expect([image.contentType, image.width, image.height]).toEqual([
      "image/png",
      40,
      20,
    ]);
    expect(image.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(inspectImage("favicon", png(32)).contentType).toBe("image/png");
  });
  it("refuses SVG, scripts, truncated files and the wrong shape", () => {
    const refuse = (kind: "logo" | "favicon", bytes: Buffer, message: RegExp) =>
      expect(() => inspectImage(kind, bytes)).toThrow(message);
    refuse(
      "logo",
      Buffer.from('<?xml version="1.0"?><svg onload="x()"/>'),
      /SVG/,
    );
    refuse("logo", Buffer.from("  <svg><script>1</script></svg>"), /SVG/);
    refuse("logo", Buffer.from("GIF89a....."), /Formato/);
    refuse("logo", png(40).subarray(0, 50), /dañado/);
    refuse("logo", png(8), /pequeña/);
    refuse("favicon", png(64, 32), /cuadrado/);
    refuse("logo", Buffer.alloc(0), /vacío/);
    refuse("logo", Buffer.alloc(600 * 1024, 1), /grande/);
  });
});

describe("public branding without a database", () => {
  it("falls back to the environment: the sign-in never depends on the settings", async () => {
    clearEnvironment();
    Object.assign(process.env, {
      ORGANIZATION_CODE: "DEFAULT",
      ORGANIZATION_NAME: "Desde el entorno",
      APP_NAME: "Nombre .env",
    });
    const broken = {
      organization: {
        findUnique: () => {
          throw new Error("database unavailable");
        },
      },
    };
    const service = new SettingsService(
      broken as never,
      {} as never,
      {} as never,
    );
    const branding = await service.publicBranding();
    expect(branding.appName).toBe("Nombre .env");
    expect(branding.organizationName).toBe("Desde el entorno");
    expect(branding.accent).toBe("#2b4d7c");
  });
});
