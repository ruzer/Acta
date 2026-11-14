// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  bulkUsersInput,
  bulkUsersConfirmInput,
  bulkUsersResult,
} from "@requirements/contracts";
import {
  parseBulkUsers,
  temporaryPassword,
} from "../../app/backend/src/administration/bulk-users";
const header = "Usuario\tNombre\tProyecto\tRol\tÁrea\n";
const row = "persona.demo\tPersona ficticia\tPROYECTO\tParticipante\tAREA";
describe("tabla de usuarios", () => {
  it("normaliza usuario, admite roles legibles y no convierte códigos", () => {
    const p = parseBulkUsers(
      header + row.replace("persona.demo", "Persona.Demo"),
    );
    expect(p.errors).toEqual([]);
    expect(p.rows[0]).toMatchObject({
      username: "persona.demo",
      role: "STAKEHOLDER",
      projectCode: "PROYECTO",
      areaCode: "AREA",
    });
    expect(
      parseBulkUsers(header + "analista.demo\tAnalista\t001\tAnalista\t")
        .rows[0]?.projectCode,
    ).toBe("001");
  });
  it.each([
    "Administración del proyecto",
    "ADMIN",
    "Analista",
    "ANALYST",
    "Participante",
    "Área participante",
    "STAKEHOLDER",
    "Consulta",
    "VIEWER",
  ])("admite %s sin conceder administración institucional", (role) =>
    expect(
      parseBulkUsers(header + row.replace("Participante", role)).errors,
    ).toEqual([]),
  );
  it("acepta un usuario en proyectos diferentes y conserva el número físico de fila", () => {
    const p = parseBulkUsers(
      header + row + "\r\n" + row.replace("PROYECTO", "OTRO") + "\r\n",
    );
    expect(p.errors).toEqual([]);
    expect(p.rows.map((r) => r.line)).toEqual([2, 3]);
  });
  it.each([
    [header + row + "\n" + row, "Proyecto"],
    [
      header +
        row +
        "\n" +
        row
          .replace("Persona ficticia", "Otro nombre")
          .replace("PROYECTO", "OTRO"),
      "Nombre",
    ],
    [header + row.replace("persona.demo", "x"), "Usuario"],
    [header + row.replace("Persona ficticia", ""), "Nombre"],
    [header + row.replace("PROYECTO", ""), "Proyecto"],
    [header + row.replace("Participante", "Superusuario"), "Rol"],
    [header + row.replace(/AREA$/, ""), "Área"],
    [header + row + "\textra", "Fila"],
  ])("rechaza datos inválidos: %s", (text, column) =>
    expect(parseBulkUsers(text).errors.some((e) => e.column === column)).toBe(
      true,
    ),
  );
  it("rechaza cabecera extra, repetida, líneas vacías y más de 50 filas sin descartar", () => {
    expect(
      parseBulkUsers(header.replace("Área", "Contraseña") + row).errors[0]?.row,
    ).toBe(1);
    expect(parseBulkUsers(header.replace("Área", "Nombre") + row).rows).toEqual(
      [],
    );
    expect(
      parseBulkUsers(
        header + row + "\n\n" + row.replace("persona.demo", "otra.demo"),
      ).errors.some((e) => e.row === 3),
    ).toBe(true);
    expect(
      parseBulkUsers(
        header +
          Array.from({ length: 51 }, (_, i) =>
            row.replace("persona.demo", "demo" + i),
          ).join("\n"),
      ).errors[0]?.message,
    ).toContain("50");
    expect(
      parseBulkUsers(
        header +
          Array.from({ length: 50 }, (_, i) =>
            row.replace("persona.demo", "demo" + i),
          ).join("\n"),
      ).errors,
    ).toEqual([]);
  });
  it("limita bytes y rechaza contraseñas/id de institución en el contrato", () => {
    expect(bulkUsersInput.safeParse({ text: "é".repeat(32769) }).success).toBe(
      false,
    );
    expect(
      bulkUsersInput.safeParse({ text: header + row, password: "no" }).success,
    ).toBe(false);
    expect(
      bulkUsersConfirmInput.safeParse({
        text: header + row,
        requestId: crypto.randomUUID(),
        previewHash: "a".repeat(64),
        organizationId: crypto.randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      bulkUsersResult.safeParse({
        delivery: "REPLAY",
        users: [],
        memberships: 0,
        credentials: [],
      }).success,
    ).toBe(false);
  });
  it("genera claves de 16 caracteres sin ambigüedad y agrupadas", () => {
    const passwords = Array.from({ length: 1000 }, temporaryPassword);
    expect(new Set(passwords).size).toBe(1000);
    expect(
      passwords.every((p) =>
        /^[A-HJ-NP-Za-km-z2-9]{4}(?:-[A-HJ-NP-Za-km-z2-9]{4}){3}$/.test(p),
      ),
    ).toBe(true);
  });
});
