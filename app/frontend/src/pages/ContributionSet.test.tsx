import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { reviewDetailView, type ReviewDetail } from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import { ContributionSet } from "./ContributionSet";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import * as apiModule from "../api";
import { ReviewDetail as ReviewDetailPage } from "./ReviewDetail";

const original = reviewDetailView.parse(fixture.conflict);
function data(count: number): ReviewDetail {
  return {
    ...original,
    submissions: Array.from({ length: count }, (_, i) => ({
      ...original.submissions[i % 2]!,
      id: `submission-${i}`,
      respondent: { id: `actor-${i}`, displayName: `Actor ${i + 1}` },
      area: {
        id: `area-${i}`,
        name: i === 9 ? "Operación regional" : "Atención",
      },
      answer: `Respuesta ${i + 1}`,
      comment: `Contexto completo ${i + 1}`,
      current: true,
    })),
    threads: [],
    conflicts: [],
    validations: [],
  };
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("volver desde una aportación abierta en Cuestionario conserva el destino del editor", async () => {
  const detail = data(3);
  vi.spyOn(apiModule, "api").mockImplementation(
    async (key) => (key === "projects" ? [] : detail) as never,
  );
  const router = createMemoryRouter(
    [
      {
        path: "/projects/:projectId/review/:id",
        element: <ReviewDetailPage />,
      },
    ],
    {
      initialEntries: [
        {
          pathname: `/projects/${detail.projectId}/review/${detail.question.id}`,
          state: { questionnaireReturn: true, reviewSearch: "status=CONFLICT" },
        },
      ],
    },
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole("link", { name: "← Cuestionario" }),
  ).toHaveAttribute("href", `/projects/${detail.projectId}/editor`);
  expect(
    screen.queryByRole("link", { name: "← Revisar respuestas" }),
  ).not.toBeInTheDocument();
});

it("0 aportaciones distingue espera, ausencia de asignación e historia", () => {
  const empty = data(0);
  const { rerender } = render(<ContributionSet data={empty} />);
  expect(screen.getByRole("heading", { name: "0 aportaciones" })).toBeVisible();
  expect(
    screen.getByText(/Los borradores privados no se muestran/),
  ).toBeVisible();
  rerender(<ContributionSet data={{ ...empty, participants: [] }} />);
  expect(screen.getByText(/no tiene participantes asignados/)).toBeVisible();
  rerender(
    <ContributionSet
      data={{
        ...empty,
        submissions: [{ ...data(1).submissions[0]!, current: false }],
      }}
    />,
  );
  expect(screen.getByText(/Hay envíos históricos/)).toBeVisible();
  expect(screen.getByText("Envíos históricos (1)")).toBeVisible();
  expect(screen.getByText("Contexto completo 1")).not.toBeVisible();
});

it("1 aportación abre directamente el envío vigente y conserva evidencia", () => {
  const one = data(1);
  one.submissions[0]!.evidence = original.submissions[1]!.evidence;
  render(<ContributionSet data={one} />);
  expect(screen.getByRole("heading", { name: "1 aportación" })).toBeVisible();
  expect(
    screen.getByText("Contexto completo 1", { exact: false }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Descargar guia-ficticia.pdf" }),
  ).toBeEnabled();
  expect(
    screen.queryByRole("button", { name: /Abrir aportación/ }),
  ).not.toBeInTheDocument();
});

it.each([3, 10, 12])(
  "%i aportaciones abre primero el conjunto, sin contar historia ni archivos",
  (count) => {
    const many = data(count);
    many.submissions.push({
      ...many.submissions[0]!,
      id: "older",
      number: 2,
      current: false,
    });
    render(<ContributionSet data={many} />);
    const list = screen.getByRole("list", { name: "Aportaciones vigentes" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(count);
    expect(
      screen.getByRole("heading", { name: `${count} aportaciones` }),
    ).toBeVisible();
    expect(
      screen.queryByText("Contexto completo 2", { exact: false }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Envíos históricos (1)")).toBeVisible();
    expect(screen.getByText(/La cantidad no significa consenso/)).toBeVisible();
  },
);

it("las señales corresponden a la revisión vinculada, sin atribuir el conflicto a todas", async () => {
  const many = data(3);
  many.conflicts = [
    {
      ...original.conflicts[0]!,
      participants: [
        { id: "source", responseRevisionId: many.submissions[0]!.id },
      ],
    },
  ];
  many.threads = [
    {
      id: "thread",
      responseRevisionId: many.submissions[1]!.id,
      respondentId: "actor-1",
      status: "WAITING_ANALYST",
      lockVersion: 0,
      createdAt: "2026-10-01T00:00:00.000Z",
      closedAt: null,
      closedBy: null,
      closeReason: null,
      messages: [],
    },
  ];
  render(<ContributionSet data={many} />);
  // UX-06: a narrow screen opens on the relevant contribution; ask for the set.
  await userEvent.click(
    screen.getByRole("button", { name: "← Volver a 3 aportaciones" }),
  );
  const rows = within(
    screen.getByRole("list", { name: "Aportaciones vigentes" }),
  ).getAllByRole("listitem");
  expect(within(rows[0]!).getByText("En conflicto abierto")).toBeVisible();
  expect(
    within(rows[1]!).getByText(/1 aclaración abierta · espera al analista/),
  ).toBeVisible();
  expect(
    within(rows[2]!).queryByText(/conflicto|aclaración/),
  ).not.toBeInTheDocument();
  expect(within(rows[1]!).getByText("1 archivo adjunto")).toBeVisible();
});

it("abrir por teclado muestra una sola aportación y volver restaura foco y filtros", async () => {
  const user = userEvent.setup();
  render(<ContributionSet data={data(12)} />);
  await user.type(
    screen.getByRole("searchbox", { name: "Buscar por actor o área" }),
    "operacion",
  );
  expect(screen.getByRole("status")).toHaveTextContent("1 de 12 aportaciones");
  const trigger = screen.getByRole("button", {
    name: "Abrir aportación de Actor 10",
  });
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("heading", { name: "Actor 10" })).toHaveFocus();
  expect(
    screen.getByText("Contexto completo 10", { exact: false }),
  ).toBeVisible();
  expect(
    screen.queryByRole("list", { name: "Aportaciones vigentes" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "← Volver a 12 aportaciones" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Abrir aportación de Actor 10" }),
    ).toHaveFocus(),
  );
  expect(screen.getByRole("searchbox")).toHaveValue("operacion");
  expect(screen.getByRole("status")).toHaveTextContent("1 de 12 aportaciones");
});

it("filtro sin coincidencias conserva N y permite recuperar el conjunto", async () => {
  const user = userEvent.setup();
  render(<ContributionSet data={data(10)} />);
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Situación de la aportación" }),
    "conflict",
  );
  expect(
    screen.getByRole("heading", { name: "10 aportaciones" }),
  ).toBeVisible();
  expect(screen.getByText("Sin aportaciones para estos filtros")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
  expect(
    screen.getAllByRole("button", { name: /Abrir aportación/ }),
  ).toHaveLength(10);
});

it("una revisión que pierde vigencia sale del conjunto y queda disponible en historia", async () => {
  const user = userEvent.setup();
  const many = data(3);
  const { rerender } = render(<ContributionSet data={many} />);
  await user.click(
    screen.getByRole("button", { name: "Abrir aportación de Actor 1" }),
  );
  rerender(
    <ContributionSet
      data={{
        ...many,
        submissions: many.submissions.map((s, i) => ({
          ...s,
          current: i !== 0,
        })),
      }}
    />,
  );
  expect(screen.getByRole("heading", { name: "2 aportaciones" })).toHaveFocus();
  expect(
    screen.queryByRole("button", { name: "Abrir aportación de Actor 1" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Envíos históricos (1)")).toBeVisible();
});

it("el filtro sigue visible si una actualización reduce el conjunto a menos de diez", async () => {
  const user = userEvent.setup();
  const many = data(10);
  const { rerender } = render(<ContributionSet data={many} />);
  await user.type(screen.getByRole("searchbox"), "operacion");
  rerender(
    <ContributionSet
      data={{ ...many, submissions: many.submissions.slice(0, 3) }}
    />,
  );
  expect(screen.getByRole("searchbox")).toHaveValue("operacion");
  await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
  expect(
    screen.getAllByRole("button", { name: /Abrir aportación/ }),
  ).toHaveLength(3);
});

it("volver enfoca el conjunto cuando la aportación dejó de coincidir con el filtro", async () => {
  const user = userEvent.setup();
  const many = data(10);
  many.conflicts = [
    {
      ...original.conflicts[0]!,
      participants: [
        { id: "source", responseRevisionId: many.submissions[0]!.id },
      ],
    },
  ];
  const { rerender } = render(<ContributionSet data={many} />);
  // UX-06: a narrow screen opens on the relevant contribution; ask for the set.
  await user.click(
    screen.getByRole("button", { name: "← Volver a 10 aportaciones" }),
  );
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Situación de la aportación" }),
    "conflict",
  );
  await user.click(
    screen.getByRole("button", { name: "Abrir aportación de Actor 1" }),
  );
  rerender(<ContributionSet data={{ ...many, conflicts: [] }} />);
  await user.click(
    screen.getByRole("button", { name: "← Volver a 10 aportaciones" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: "10 aportaciones" }),
    ).toHaveFocus(),
  );
  expect(screen.getByText("Sin aportaciones para estos filtros")).toBeVisible();
});

it("comparar y volver conserva el filtro del conjunto y devuelve foco al disparador", async () => {
  const user = userEvent.setup();
  render(<ContributionSet data={data(12)} />);
  await user.type(screen.getByRole("searchbox"), "operacion");
  await user.click(
    screen.getByRole("button", { name: "Comparar aportaciones" }),
  );
  expect(
    screen.getByRole("heading", { name: "Contrastar aportaciones" }),
  ).toHaveFocus();
  expect(screen.getByRole("status")).toHaveTextContent("Comparando 2 de 12");
  await user.click(
    screen.getByRole("button", { name: "← Volver a 12 aportaciones" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Comparar aportaciones" }),
    ).toHaveFocus(),
  );
  expect(screen.getByRole("searchbox")).toHaveValue("operacion");
  expect(
    screen.getAllByRole("button", { name: /Abrir aportación de/ }),
  ).toHaveLength(1);
  expect(
    screen.getByRole("button", { name: "Abrir aportación de Actor 10" }),
  ).toBeVisible();
});

it("C: en escritorio 50 aportaciones preselecciona una sola respuesta completa y conserva filtros e historia", async () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const many = data(50);
  many.submissions.push({
    ...many.submissions[0]!,
    id: "historical-50",
    current: false,
  });
  const user = userEvent.setup();
  render(<ContributionSet data={many} />);
  const list = screen.getByRole("list", { name: "Aportaciones vigentes" });
  expect(within(list).getAllByRole("listitem")).toHaveLength(50);
  expect(screen.getByRole("status")).toHaveTextContent("50 de 50 aportaciones");
  expect(screen.getByRole("article", { name: "Actor 1" })).toBeVisible();
  expect(
    screen.queryByText("Contexto completo 2", { exact: false }),
  ).not.toBeInTheDocument();
  const first = screen.getByRole("button", {
    name: "Abrir aportación de Actor 1",
  });
  first.focus();
  await user.keyboard("{ArrowDown}{Enter}");
  expect(screen.getByRole("heading", { name: "Actor 2" })).toHaveFocus();
  expect(
    screen.getByRole("button", { name: "Abrir aportación de Actor 2" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByText("Contexto completo 2", { exact: false }),
  ).toBeVisible();
  await user.type(screen.getByRole("searchbox"), "operacion");
  expect(screen.getByRole("status")).toHaveTextContent("1 de 50 aportaciones");
  expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  // The selected detail remains available while filtering the rail.
  expect(screen.getByRole("article", { name: "Actor 2" })).toBeVisible();
  expect(screen.getByText("Envíos históricos (1)")).toBeVisible();
});

it("C: el envío histórico conserva número, fecha, área y contenido sin inflar N", async () => {
  const historical = {
    ...data(1).submissions[0]!,
    id: "past",
    number: 7,
    current: false,
  };
  render(<ContributionSet data={{ ...data(0), submissions: [historical] }} />);
  const user = userEvent.setup();
  await user.click(screen.getByText("Envíos históricos (1)"));
  const article = screen.getByRole("article");
  expect(
    within(article).getByRole("heading", { name: "Actor 1 · envío #7" }),
  ).toBeVisible();
  expect(within(article).getByText("Histórico")).toBeVisible();
  expect(within(article).getByText(historical.area.name)).toBeVisible();
  expect(article.querySelectorAll(".ac-meta li")).toHaveLength(3);
  expect(article.querySelectorAll(".ac-meta li")[1]!.textContent).toMatch(
    /2026/,
  );
  expect(
    within(article).getByText("Contexto completo 1", { exact: false }),
  ).toBeVisible();
  expect(screen.getByRole("heading", { name: "0 aportaciones" })).toBeVisible();
});

// ---- UX-06: open on the contribution the clarification or conflict is about ----
function wide() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: /min-width:\s*900px/.test(query),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}
function withThread(
  many: ReviewDetail,
  index: number,
  status: "WAITING_ANALYST" | "WAITING_STAKEHOLDER",
): ReviewDetail {
  return {
    ...many,
    threads: [
      {
        id: `thread-${index}`,
        responseRevisionId: many.submissions[index]!.id,
        respondentId: `actor-${index}`,
        status,
        lockVersion: 0,
        createdAt: "2026-10-01T00:00:00.000Z",
        closedAt: null,
        closedBy: null,
        closeReason: null,
        messages: [],
      },
    ],
  };
}
const openName = () =>
  screen.getByRole("article").getAttribute("aria-labelledby");
const shownPerson = () => document.getElementById(openName()!)!.textContent;
it("UX-06: en escritorio abre la aportación con la aclaración pendiente, no la primera", () => {
  wide();
  render(<ContributionSet data={withThread(data(12), 7, "WAITING_ANALYST")} />);
  expect(shownPerson()).toBe("Actor 8");
  expect(
    screen.getByRole("button", { name: "Abrir aportación de Actor 8" }),
  ).toHaveAttribute("aria-pressed", "true");
});
it("UX-06: sin aclaración usa el conflicto abierto, y sin ninguno conserva el orden actual", () => {
  wide();
  const conflicted = data(5);
  conflicted.conflicts = [
    {
      ...original.conflicts[0]!,
      participants: [
        { id: "p1", responseRevisionId: conflicted.submissions[3]!.id },
        { id: "p2", responseRevisionId: conflicted.submissions[4]!.id },
      ],
    },
  ];
  const { unmount } = render(<ContributionSet data={conflicted} />);
  expect(shownPerson()).toBe("Actor 4");
  unmount();
  render(<ContributionSet data={data(5)} />);
  expect(shownPerson()).toBe("Actor 1");
});
it("UX-06: si un filtro oculta la aportación relevante, se abre la primera visible", async () => {
  wide();
  const user = userEvent.setup();
  render(<ContributionSet data={withThread(data(12), 7, "WAITING_ANALYST")} />);
  await user.type(screen.getByRole("searchbox"), "Actor 2");
  expect(shownPerson()).toBe("Actor 2");
});
it("UX-06: una elección explícita de la persona se respeta y no la deshace la preferencia", async () => {
  wide();
  const user = userEvent.setup();
  render(<ContributionSet data={withThread(data(12), 7, "WAITING_ANALYST")} />);
  await user.click(
    screen.getByRole("button", { name: "Abrir aportación de Actor 3" }),
  );
  expect(shownPerson()).toBe("Actor 3");
});
it("UX-06: en pantallas estrechas abre directo en la aportación relevante y «← Volver» muestra el conjunto sin volver a saltar", async () => {
  const user = userEvent.setup();
  render(<ContributionSet data={withThread(data(12), 7, "WAITING_ANALYST")} />);
  expect(shownPerson()).toBe("Actor 8");
  expect(
    screen.queryByRole("list", { name: "Aportaciones vigentes" }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: "← Volver a 12 aportaciones" }),
  );
  expect(
    screen.getByRole("list", { name: "Aportaciones vigentes" }),
  ).toBeVisible();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
  // The way back lands on the contribution that was open.
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Abrir aportación de Actor 8" }),
    ).toHaveFocus(),
  );
});
it("UX-07: con la aportación abierta en pantalla estrecha el titular del conjunto solo queda para lectores de pantalla", async () => {
  const user = userEvent.setup();
  render(<ContributionSet data={withThread(data(12), 7, "WAITING_ANALYST")} />);
  const heading = screen.getByRole("heading", { name: "12 aportaciones" });
  // The count is still in "← Volver a 12 aportaciones"; the section keeps its name.
  expect(heading.closest(".next-contributions-heading")).toHaveClass("sr-only");
  expect(screen.getByRole("region", { name: "12 aportaciones" })).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "← Volver a 12 aportaciones" }),
  );
  expect(
    screen
      .getByRole("heading", { name: "12 aportaciones" })
      .closest(".next-contributions-heading"),
  ).not.toHaveClass("sr-only");
});
it("UX-07: en escritorio el titular del conjunto sigue visible junto a la lista", () => {
  wide();
  render(<ContributionSet data={withThread(data(12), 7, "WAITING_ANALYST")} />);
  expect(
    screen
      .getByRole("heading", { name: "12 aportaciones" })
      .closest(".next-contributions-heading"),
  ).not.toHaveClass("sr-only");
});
it("UX-06: sin relación con una aportación vigente nada cambia en pantallas estrechas (lista primero)", () => {
  render(<ContributionSet data={data(4)} />);
  expect(
    screen.getByRole("list", { name: "Aportaciones vigentes" }),
  ).toBeVisible();
  expect(screen.queryByRole("article")).not.toBeInTheDocument();
});
