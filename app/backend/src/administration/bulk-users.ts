import { randomInt } from "node:crypto";
import {
  bulkUsersInput,
  createUserInput,
  roleLabels,
  type BulkUsersPreview,
} from "@requirements/contracts";

const columns = ["Usuario", "Nombre", "Proyecto", "Rol", "Área"] as const;
const key = (value: string) =>
  value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
export function parseBulkUsers(text: string) {
  bulkUsersInput.parse({ text });
  const lines = text.replace(/^\ufeff/, "").split(/\r\n|\n|\r/);
  if (lines.at(-1) === "") lines.pop();
  const headers = lines.shift()!.split("\t");
  const errors: BulkUsersPreview["errors"] = [];
  const rows: BulkUsersPreview["rows"] = [];
  const error = (
    row: number,
    column: (typeof columns)[number] | "Fila",
    message: string,
  ) => errors.push({ row, column, message });
  if (
    headers.length !== columns.length ||
    new Set(headers.map(key)).size !== columns.length ||
    columns.some((c) => !headers.some((h) => key(h) === key(c)))
  ) {
    error(
      1,
      "Fila",
      "Usa solo los encabezados Usuario, Nombre, Proyecto, Rol y Área, separados por tabuladores; nunca contraseñas.",
    );
    return { rows, errors };
  }
  if (!lines.length || lines.length > 50) {
    error(0, "Fila", "Pega entre 1 y 50 filas de membresías.");
    return { rows, errors };
  }
  const names = new Map<string, string>();
  const memberships = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const number = index + 2;
    const cells = line.split("\t");
    const [username, displayName, projectCode, roleText, areaCode] =
      columns.map(
        (c) => cells[headers.findIndex((h) => key(h) === key(c))] ?? "",
      ) as [string, string, string, string, string];
    if (cells.length !== 5)
      error(
        number,
        "Fila",
        "Se requieren cinco celdas separadas por tabuladores (Área puede quedar vacía salvo para Participante).",
      );
    const role =
      Object.entries(roleLabels).find(
        ([code, label]) =>
          key(roleText) === key(code) || key(roleText) === key(label),
      )?.[0] ??
      (key(roleText) === "administracion del proyecto"
        ? "ADMIN"
        : key(roleText) === "participante"
          ? "STAKEHOLDER"
          : "");
    if (!createUserInput.shape.username.safeParse(username).success)
      error(
        number,
        "Usuario",
        "Usa de 3 a 64 letras, números, puntos, guiones o guiones bajos, sin espacios.",
      );
    if (
      !createUserInput.shape.displayName.safeParse(displayName).success ||
      !displayName.trim()
    )
      error(number, "Nombre", "Indica un nombre de 1 a 200 caracteres.");
    if (!projectCode)
      error(number, "Proyecto", "Indica el código del proyecto.");
    if (!role)
      error(
        number,
        "Rol",
        "Usa Administración del proyecto, Analista, Participante o Consulta.",
      );
    if (role === "STAKEHOLDER" && !areaCode)
      error(number, "Área", "Indica el código del área del participante.");
    const user = username.toLowerCase();
    if (names.has(user) && names.get(user) !== displayName)
      error(number, "Nombre", "Este usuario aparece con nombres diferentes.");
    names.set(user, displayName);
    const membership = JSON.stringify([user, projectCode]);
    if (memberships.has(membership))
      error(
        number,
        "Proyecto",
        "Este usuario y proyecto ya aparecen en otra fila.",
      );
    memberships.add(membership);
    rows.push({
      line: number,
      username: user,
      displayName,
      projectCode,
      projectName: "",
      role,
      areaCode,
      areaName: "",
    });
  }
  return { rows, errors };
}
export function temporaryPassword() {
  // 57 símbolos y 16 elecciones uniformes: más de 93 bits; los guiones no añaden entropía.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(
      "",
    ),
  ).join("-");
}
