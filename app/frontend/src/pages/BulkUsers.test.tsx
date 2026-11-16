import { afterEach, beforeAll, expect, it, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { api } from "../api";
import { BulkUsers } from "./BulkUsers";
vi.mock("../api", () => ({ api: vi.fn() }));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.mocked(api).mockReset();
});
const preview = {
  rows: [
    {
      line: 2,
      username: "demo.user",
      displayName: "Persona ficticia",
      projectCode: "DEMO",
      projectName: "Proyecto",
      role: "VIEWER",
      areaCode: "",
      areaName: "",
    },
  ],
  errors: [],
  users: 1,
  memberships: 1,
  canConfirm: true,
  previewHash: "a".repeat(64),
};
const receipt = {
  users: [
    {
      id: crypto.randomUUID(),
      username: "demo.user",
      displayName: "Persona ficticia",
    },
  ],
  memberships: 1,
};
function setup() {
  const client = new QueryClient();
  const close = vi.fn();
  const rendered = render(
    <QueryClientProvider client={client}>
      <BulkUsers onClose={close} onCreated={() => undefined} />
    </QueryClientProvider>,
  );
  return { client, close, ...rendered };
}
async function review() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Tabla de usuarios"), "tabla ficticia");
  await user.click(screen.getByRole("button", { name: "Revisar usuarios" }));
  await screen.findByRole("heading", { name: "Revisar el lote" });
  return user;
}
it("muestra errores por fila vinculados a sus celdas e impide confirmar", async () => {
  vi.mocked(api).mockResolvedValue({
    ...preview,
    canConfirm: false,
    errors: [
      { row: 2, column: "Usuario", message: "Ya existe" },
      { row: 2, column: "Fila", message: "Fila incompleta" },
      { row: 1, column: "Fila", message: "Encabezados incorrectos" },
    ],
  });
  setup();
  await review();
  expect(
    screen.getByRole("link", { name: "Fila 2, Usuario: Ya existe" }),
  ).toHaveAttribute("href", "#bulk-cell-2-Usuario");
  expect(
    screen.getByRole("link", { name: "Fila 2, Fila: Fila incompleta" }),
  ).toHaveAttribute("href", "#bulk-cell-2-Usuario");
  expect(
    screen.getByText("Fila 1, Fila: Encabezados incorrectos").closest("a"),
  ).toBeNull();
  expect(document.getElementById("bulk-cell-2-Usuario")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(
    screen.getByRole("button", { name: "Crear 1 cuentas y sus membresías" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("heading", { name: "Revisar el lote" }),
  ).toHaveFocus();
});
it("entrega efímera sin caché ni almacenamiento e imprime solo por petición, una hoja por persona", async () => {
  const secret = crypto.randomUUID();
  vi.mocked(api)
    .mockResolvedValueOnce(preview)
    .mockResolvedValueOnce({
      ...receipt,
      delivery: "NEW",
      credentials: [{ username: "demo.user", temporaryPassword: secret }],
    });
  const print = vi.spyOn(window, "print").mockImplementation(() => {
    expect(document.querySelectorAll(".bulk-users-sheet")).toHaveLength(1);
    expect(
      document.querySelector(".bulk-users-sheet")?.textContent.includes(secret),
    ).toBe(true);
  });
  const { client, unmount } = setup();
  const user = await review();
  await user.click(
    screen.getByRole("button", { name: "Crear 1 cuentas y sus membresías" }),
  );
  await screen.findByRole("heading", { name: "Entrega de acceso" });
  expect(print).not.toHaveBeenCalled();
  expect(document.querySelector(".bulk-users-print")).toBeNull();
  expect(
    [
      JSON.stringify(client.getQueryCache().getAll()),
      JSON.stringify(client.getMutationCache().getAll()),
      JSON.stringify(localStorage),
      JSON.stringify(sessionStorage),
      JSON.stringify(history.state),
      location.href,
    ].every((v) => !v?.includes(secret)),
  ).toBe(true);
  await user.click(
    screen.getByRole("button", { name: "Imprimir hoja de entrega" }),
  );
  expect(print).toHaveBeenCalledTimes(1);
  expect(document.querySelector(".bulk-users-print")).toBeNull();
  unmount();
  expect(document.body.textContent?.includes(secret)).toBe(false);
});
it("reintento conserva requestId y el recibo no ofrece una nueva entrega", async () => {
  vi.mocked(api)
    .mockResolvedValueOnce(preview)
    .mockRejectedValueOnce(new Error("Sin conexión"))
    .mockResolvedValueOnce({ ...receipt, delivery: "REPLAY" });
  setup();
  const user = await review();
  await user.click(
    screen.getByRole("button", { name: "Crear 1 cuentas y sus membresías" }),
  );
  await screen.findByText("Sin conexión");
  await user.click(
    screen.getByRole("button", { name: "Crear 1 cuentas y sus membresías" }),
  );
  await screen.findByRole("heading", { name: "Entrega de acceso" });
  const calls = vi
    .mocked(api)
    .mock.calls.filter((c) => c[0] === "bulkUsersConfirm");
  expect(calls[0]?.[2]).toEqual(calls[1]?.[2]);
  expect(
    screen.queryByRole("button", { name: "Imprimir hoja de entrega" }),
  ).toBeNull();
});
it.each(["pagehide", "session-expired"])(
  "borra entrega con %s y descarta una respuesta tardía",
  async (event) => {
    let finish!: (v: unknown) => void;
    vi.mocked(api)
      .mockResolvedValueOnce(preview)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve as (v: unknown) => void;
          }),
      );
    setup();
    const user = await review();
    await user.click(
      screen.getByRole("button", { name: "Crear 1 cuentas y sus membresías" }),
    );
    act(() => {
      window.dispatchEvent(new Event(event));
      window.dispatchEvent(new Event("pageshow"));
    });
    await act(async () =>
      finish({
        ...receipt,
        delivery: "NEW",
        credentials: [
          { username: "demo.user", temporaryPassword: crypto.randomUUID() },
        ],
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Entrega de acceso" }),
      ).toBeNull(),
    );
    expect(screen.getByLabelText("Tabla de usuarios")).toHaveValue("");
  },
);

it("el ejemplo tiene columnas reales y desplazamiento con nombre accesible", () => {
  setup();
  const example = screen.getByRole("table", {
    name: "Ejemplo de tabla de usuarios",
  });
  expect(within(example).getAllByRole("columnheader")).toHaveLength(5);
  for (const heading of within(example).getAllByRole("columnheader"))
    expect(heading).toHaveAttribute("scope", "col");
  expect(
    screen.getByRole("region", { name: "Ejemplo de tabla de usuarios" }),
  ).toHaveAttribute("tabindex", "0");
});
it("la vista previa conserva 50 filas en una tabla y un solo nombre para Participante", async () => {
  vi.mocked(api).mockResolvedValue({
    ...preview,
    users: 50,
    memberships: 50,
    rows: Array.from({ length: 50 }, (_, i) => ({
      ...preview.rows[0]!,
      line: i + 2,
      username: `persona${i}`,
      role: "STAKEHOLDER",
    })),
  });
  setup();
  await review();
  const table = screen.getByRole("table", {
    name: "Usuarios y membresías por crear",
  });
  expect(within(table).getAllByRole("row")).toHaveLength(51);
  expect(
    within(table).getAllByText("Participante", { exact: true }),
  ).toHaveLength(50);
  expect(within(table).queryByText("Área participante")).toBeNull();
});
it("nombra al rol como Participante también en la vista previa", async () => {
  vi.mocked(api).mockResolvedValue({
    ...preview,
    rows: [{ ...preview.rows[0]!, role: "STAKEHOLDER" }],
  });
  setup();
  await review();
  expect(document.getElementById("bulk-cell-2-Rol")).toHaveTextContent(
    /^Participante$/,
  );
});
