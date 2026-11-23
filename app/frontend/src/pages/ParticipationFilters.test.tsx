import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ParticipationView } from "@requirements/contracts";
import { exchangeRequest } from "../api";
import { Participation } from "./Participation";

vi.mock("../api", () => ({ api: vi.fn(), exchangeRequest: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const data: ParticipationView = {
  projectName: "Diagnóstico ficticio",
  role: "ANALYST",
  responseDueAt: null,
  participants: [
    {
      memberId: "a",
      name: "Ana Ejemplo",
      area: "Atención",
      assigned: 21,
      required: 21,
      drafts: 1,
      sent: 17,
      pending: 4,
      lastActivity: null,
      state: "Envió parte",
    },
    {
      memberId: "b",
      name: "Beatriz Ejemplo",
      area: "Archivo",
      assigned: 21,
      required: 21,
      drafts: 0,
      sent: 0,
      pending: 21,
      lastActivity: null,
      state: "Sin iniciar",
    },
    {
      memberId: "c",
      name: "Clara Ejemplo",
      area: "Archivo",
      assigned: 3,
      required: 3,
      drafts: 0,
      sent: 3,
      pending: 0,
      lastActivity: null,
      state: "Completo",
    },
  ],
};
function setup(search = "", value = data) {
  vi.mocked(exchangeRequest).mockResolvedValue(value);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      {
        path: "/projects/:projectId/participation",
        element: <Participation />,
      },
    ],
    { initialEntries: ["/projects/p/participation" + search] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
it("restaura estado, orden y búsqueda al abrir una URL filtrada", async () => {
  setup("?state=Sin+iniciar&order=pending&q=archivo");
  await screen.findByRole("table");
  expect(screen.getByLabelText("Filtrar participación")).toHaveValue(
    "Sin iniciar",
  );
  expect(screen.getByLabelText("Ordenar participación")).toHaveValue("pending");
  expect(
    screen.getByRole("searchbox", { name: "Buscar participantes" }),
  ).toHaveValue("archivo");
  expect(screen.getAllByRole("row")).toHaveLength(2);
  expect(screen.getByRole("row", { name: /Beatriz Ejemplo/ })).toBeVisible();
  expect(exchangeRequest).toHaveBeenCalledTimes(1);
});
it("busca por nombre o área sin otra consulta y conserva los filtros en la URL", async () => {
  const router = setup();
  await screen.findByRole("table");
  const search = screen.getByRole("searchbox", {
    name: "Buscar participantes",
  });
  search.focus();
  fireEvent.change(search, { target: { value: "Archivo" } });
  expect(screen.getAllByRole("row")).toHaveLength(3);
  expect(new URLSearchParams(router.state.location.search).get("q")).toBe(
    "Archivo",
  );
  expect(search).toHaveFocus();
  fireEvent.change(search, { target: { value: "Ana Ejemplo" } });
  expect(screen.getAllByRole("row")).toHaveLength(2);
  expect(screen.getByRole("row", { name: /Ana Ejemplo/ })).toBeVisible();
  expect(exchangeRequest).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
  expect(screen.getAllByRole("row")).toHaveLength(4);
  expect(router.state.location.search).toBe("");
  expect(exchangeRequest).toHaveBeenCalledTimes(1);
});
it("explica el avance enviado y cuenta personas pendientes en el recordatorio", async () => {
  setup();
  const row = await screen.findByRole("row", { name: /Ana Ejemplo/ });
  expect(within(row).getByText("Enviadas 17 de 21 · 81 %")).toBeVisible();
  expect(
    screen.getByRole("button", {
      name: "Copiar recordatorio (2 personas con pendientes)",
    }),
  ).toBeEnabled();
});

it.each([
  [17, 21, "Enviadas 17 de 21 · 81 %"],
  [299, 300, "Enviadas 299 de 300 · 99 %"],
  [300, 300, "Enviadas 300 de 300 · 100 %"],
])(
  "separa el porcentaje de envíos %i/%i del estado Completo",
  async (sent, assigned, label) => {
    setup("", {
      ...data,
      participants: [
        {
          ...data.participants[0]!,
          assigned,
          sent,
          required: 1,
          pending: 0,
          drafts: 1,
          state: "Completo",
        },
      ],
    });
    const row = await screen.findByRole("row", { name: /Ana Ejemplo/ });
    expect(within(row).getByText(label)).toBeVisible();
    expect(within(row).getByText("Completo")).toBeVisible();
    expect(within(row).getByText("Obligatorias pendientes: 0")).toBeVisible();
    expect(within(row).getByText("Con cambios sin enviar: 1")).toBeVisible();
    const bar = within(row).getByRole("progressbar", { name: label });
    expect(bar).toHaveAttribute("aria-valuenow", String(sent));
    expect(bar).toHaveAttribute("aria-valuemax", String(assigned));
  },
);
it("sin asignaciones muestra raya, sin barra ni porcentaje", async () => {
  setup("", {
    ...data,
    participants: [
      {
        ...data.participants[0]!,
        assigned: 0,
        sent: 0,
        required: 0,
        pending: 0,
        drafts: 0,
        state: "Completo",
      },
    ],
  });
  const row = await screen.findByRole("row", { name: /Ana Ejemplo/ });
  expect(within(row).getByText("—")).toBeVisible();
  expect(within(row).queryByRole("progressbar")).not.toBeInTheDocument();
  expect(row).not.toHaveTextContent(/NaN|%/);
});
