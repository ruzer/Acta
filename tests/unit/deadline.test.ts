// @vitest-environment node
import { expect, it } from "vitest";
import {
  endOfResponseDay,
  responseDueLabel,
} from "../../packages/contracts/src/deadline.js";
it.each([
  ["UTC", "2026-11-25T23:59:59.999Z"],
  ["America/Mexico_City", "2026-11-26T05:59:59.999Z"],
  ["America/New_York", "2026-11-26T04:59:59.999Z"],
])("termina el día indicado en %s", (timezone, expected) => {
  expect(endOfResponseDay("2026-11-25", timezone)).toBe(expected);
});
it("respeta días de 23 y 25 horas sin imponer 24 horas locales", () => {
  expect(endOfResponseDay("2026-03-08", "America/New_York")).toBe(
    "2026-03-09T03:59:59.999Z",
  );
  expect(endOfResponseDay("2026-11-01", "America/New_York")).toBe(
    "2026-11-02T04:59:59.999Z",
  );
});
it("sin fecha no muestra plazo; muestra futuro, hoy y vencido por el calendario configurado", () => {
  const due = endOfResponseDay("2026-11-25", "America/Mexico_City");
  expect(responseDueLabel(null, "UTC")).toBe("");
  expect(
    responseDueLabel(
      due,
      "America/Mexico_City",
      new Date("2026-11-22T18:00:00Z"),
    ),
  ).toBe("Vence en 3 días · 25 de noviembre de 2026");
  expect(
    responseDueLabel(
      due,
      "America/Mexico_City",
      new Date("2026-11-26T02:00:00Z"),
    ),
  ).toBe("Vence hoy · 25 de noviembre de 2026");
  expect(
    responseDueLabel(
      due,
      "America/Mexico_City",
      new Date("2026-11-26T06:00:00Z"),
    ),
  ).toBe("Venció el 25 de noviembre de 2026");
  expect(
    responseDueLabel(
      endOfResponseDay("2026-11-25", "UTC"),
      "UTC",
      new Date("2026-11-26T02:00:00Z"),
    ),
  ).toBe("Venció el 25 de noviembre de 2026");
});
it("rechaza fechas inválidas", () => {
  for (const value of ["", "2026-02-30", "ayer", "2026-13-01"])
    expect(() => endOfResponseDay(value, "UTC")).toThrow();
});
