import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import {
  dashboardView,
  reviewDetailView,
  type InvitationView,
  type ReviewInbox,
} from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import * as apiModule from "../api";
import { ProjectAttention } from "./ProjectAttention";
import {
  attentionQuestions,
  loadClarificationQuestionIds,
  type AttentionDashboard,
} from "./attention-data";
import { expiringInvitations, loadProjectInvitations } from "./invitation-data";

const base = dashboardView.parse(fixture.dashboard);
const detail = reviewDetailView.parse(fixture.conflict);
const date = Date.parse("2026-10-07T12:00:00.000Z");
const day = 86400000;
function invitation(id: string, expires = date + day): InvitationView {
  return {
    id,
    label: id,
    identity: { name: id },
    nonNominal: false,
    questionIds: [],
    areaId: "area",
    allowEvidence: false,
    createdAt: new Date(date - day).toISOString(),
    expiresAt: new Date(expires).toISOString(),
    revokedAt: null,
    firstOpenedAt: null,
    lockVersion: 0,
    status: "PENDING",
    submitted: 0,
    total: 0,
  };
}
function dashboard(count = 3): AttentionDashboard {
  return {
    ...base,
    role: "ANALYST",
    questions: Array.from({ length: count }, (_, i) => ({
      ...base.questions[0]!,
      id: `q-${i}`,
      title: `Caso ${i}`,
      status:
        i === 0 ? "CONFLICT" : i === 1 ? "CLARIFICATION_REQUIRED" : "ANSWERED",
      submittedRespondents: i + 1,
    })),
  };
}
function inbox(data: AttentionDashboard, page = 1): ReviewInbox {
  return {
    items: data.questions.slice((page - 1) * 100, page * 100).map((q, i) => ({
      questionId: q.id,
      projectId: "project",
      projectName: "Proyecto",
      sectionId: q.sectionId,
      sectionTitle: q.sectionTitle,
      question: q.title,
      status: q.status,
      priority: q.priority,
      areaId: q.areaId,
      areaName: q.areaName,
      respondents: [],
      lastContributionAt: null,
      hasEvidence: false,
      openClarifications:
        i === 0 || q.status === "CLARIFICATION_REQUIRED" ? 1 : 0,
    })),
    total: data.questions.length,
    page,
    pageSize: 100,
    filters: { projects: [], sections: [], areas: [], participants: [] },
  };
}
function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("expiring7 incluye el límite superior y enlaces enviados; excluye vencidos y revocados", () => {
  const upper = invitation("upper", date + 7 * day);
  const submitted = {
    ...invitation("submitted"),
    status: "SUBMITTED" as const,
  };
  expect(
    expiringInvitations(
      [
        invitation("expired", date),
        invitation("past", date - 1),
        upper,
        invitation("after", date + 7 * day + 1),
        submitted,
        {
          ...invitation("revoked"),
          revokedAt: new Date(date - 1).toISOString(),
        },
      ],
      date,
    ).map((row) => row.id),
  ).toEqual(["upper", "submitted"]);
});

it("recoge invitaciones de la segunda página antes de filtrar vigencia", async () => {
  const first = Array.from({ length: 25 }, (_, i) =>
    invitation(String(i), date + 10 * day),
  );
  const api = vi
    .spyOn(apiModule, "api")
    .mockResolvedValueOnce({ items: first, page: 1, total: 26 })
    .mockResolvedValueOnce({ items: [invitation("last")], page: 2, total: 26 });
  const all = await loadProjectInvitations("project");
  expect(all).toHaveLength(26);
  expect(expiringInvitations(all, date).map((row) => row.id)).toEqual(["last"]);
  expect(api).toHaveBeenLastCalledWith(
    "invitations",
    { projectId: "project" },
    { page: 2 },
  );
});

it("un fallo o cambio de conjunto no convierte una página parcial en total de invitaciones", async () => {
  const rows = Array.from({ length: 25 }, (_, i) => invitation(String(i)));
  const api = vi
    .spyOn(apiModule, "api")
    .mockResolvedValueOnce({ items: rows, page: 1, total: 26 })
    .mockRejectedValueOnce(new Error("Sin conexión"));
  await expect(loadProjectInvitations("project")).rejects.toThrow(
    "Sin conexión",
  );
  api
    .mockResolvedValueOnce({ items: rows, page: 1, total: 26 })
    .mockResolvedValueOnce({ items: [], page: 2, total: 25 });
  await expect(loadProjectInvitations("project")).rejects.toThrow("cambiaron");
});

it("304 preguntas ANALYST usan cuatro páginas y cuentan aclaraciones aunque haya conflicto", async () => {
  const data = dashboard(304);
  const api = vi
    .spyOn(apiModule, "api")
    .mockImplementation(async (key, _params, input) => {
      expect(key).toBe("listReviewInbox");
      return inbox(data, (input as { page: number }).page);
    });
  const ids = await loadClarificationQuestionIds(
    client(),
    "project",
    data,
    "ACTIVE",
  );
  expect(ids).toEqual(["q-0", "q-1", "q-100", "q-200", "q-300"]);
  expect(api).toHaveBeenCalledTimes(4);
  expect(
    attentionQuestions(data.questions, "clarifications", "", ids).some(
      (q) => q.status === "CONFLICT",
    ),
  ).toBe(true);
});

it("ADMIN consulta solo conflictos con concurrencia máxima cuatro y guarda los detalles", async () => {
  const data = dashboard(8);
  data.role = "ADMIN";
  data.questions = data.questions.map((q, i) => ({
    ...q,
    status:
      i < 6 ? "CONFLICT" : i === 6 ? "CLARIFICATION_REQUIRED" : "ANSWERED",
  }));
  let active = 0,
    maximum = 0;
  const api = vi
    .spyOn(apiModule, "api")
    .mockImplementation(async (key, params) => {
      expect(key).toBe("getReviewDetail");
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 3));
      active--;
      return {
        ...detail,
        question: { ...detail.question, id: params!.id! },
        threads:
          params!.id === "q-0"
            ? [
                {
                  id: "thread",
                  responseRevisionId: "revision",
                  respondentId: "actor",
                  status: "WAITING_STAKEHOLDER",
                  lockVersion: 0,
                  createdAt: new Date(date).toISOString(),
                  closedAt: null,
                  closedBy: null,
                  closeReason: null,
                  messages: [],
                },
              ]
            : [],
      };
    });
  const cache = client();
  expect(
    (
      await loadClarificationQuestionIds(cache, "project", data, "ACTIVE")
    ).sort(),
  ).toEqual(["q-0", "q-6"]);
  expect(api).toHaveBeenCalledTimes(6);
  expect(maximum).toBeLessThanOrEqual(4);
  expect(cache.getQueryData(["review", "project", "q-0"])).toBeTruthy();
});

it("proyecto archivado no confunde inbox restringido con cero aclaraciones", async () => {
  const data = dashboard(2);
  data.questions[0]!.status = "ANSWERED";
  const api = vi.spyOn(apiModule, "api");
  expect(
    await loadClarificationQuestionIds(client(), "project", data, "ARCHIVED"),
  ).toEqual(["q-1"]);
  expect(api).not.toHaveBeenCalled();
});

function Location() {
  return <output aria-label="Consulta actual">{useLocation().search}</output>;
}
function renderAttention(data = dashboard(), initial = "/?keep=context") {
  render(
    <QueryClientProvider client={client()}>
      <MemoryRouter initialEntries={[initial]}>
        <ProjectAttention projectId="project" data={data} lifecycle="ACTIVE" />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it("entradas filtran casos, preservan otros parámetros y estado existente permite intersección explícita", async () => {
  const data = dashboard();
  vi.spyOn(apiModule, "api").mockImplementation(async (key) =>
    key === "invitations" ? { items: [], page: 1, total: 0 } : inbox(data),
  );
  const user = userEvent.setup();
  renderAttention(data);
  await waitFor(() =>
    expect(
      within(screen.getByRole("article", { name: "Aclaraciones" })).getByText(
        "2",
      ),
    ).toBeVisible(),
  );
  expect(
    within(screen.getByRole("article", { name: "Conflictos" })).getByText("1"),
  ).toBeVisible();
  expect(
    within(
      screen.getByRole("article", { name: "Listas para decidir" }),
    ).getByText("1"),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Ver aclaraciones" }));
  expect(
    within(
      screen.getByRole("region", { name: "Qué requiere atención" }),
    ).getByRole("status"),
  ).toHaveTextContent("2 preguntas");
  expect(screen.getByLabelText("Consulta actual")).toHaveTextContent(
    "keep=context&task=clarifications",
  );
  expect(
    screen.getByRole("link", { name: "Revisar conflicto: Caso 0" }),
  ).toHaveAttribute("data-workbench-id", "q-0");
  await user.selectOptions(screen.getByLabelText("Filtrar estado"), "ANSWERED");
  expect(
    within(
      screen.getByRole("region", { name: "Qué requiere atención" }),
    ).getByRole("status"),
  ).toHaveTextContent("0 preguntas");
  expect(screen.getByText(/cumplen ambos filtros/)).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Ver todas las preguntas" }),
  );
  expect(
    within(
      screen.getByRole("region", { name: "Qué requiere atención" }),
    ).getByRole("status"),
  ).toHaveTextContent("3 preguntas");
  expect(screen.getByLabelText("Consulta actual")).toHaveTextContent(
    "?keep=context",
  );
  expect(
    screen.getByRole("link", { name: "Ver invitaciones por expirar" }),
  ).toHaveAttribute("href", "/projects/project/invitations?expiresWithin=7");
});

it("carga y error de aclaraciones e invitaciones nunca aparecen como cero", async () => {
  let fail: (reason: Error) => void = () => {};
  const pending = new Promise<never>((_resolve, reject) => {
    fail = reject;
  });
  vi.spyOn(apiModule, "api").mockReturnValue(pending);
  const user = userEvent.setup();
  renderAttention();
  const clarification = within(
    screen.getByRole("article", { name: "Aclaraciones" }),
  );
  expect(clarification.getByText("Consultando…")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Ver aclaraciones" }));
  expect(screen.queryByText("0 preguntas")).not.toBeInTheDocument();
  fail(new Error("Falló la segunda página"));
  await waitFor(() =>
    expect(clarification.getByText("Sin dato disponible")).toBeVisible(),
  );
  expect(
    within(
      screen.getByRole("article", { name: "Invitaciones por expirar" }),
    ).getByText("Sin dato disponible"),
  ).toBeVisible();
  expect(screen.queryByText("0 preguntas")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Reintentar aclaraciones" }),
  ).toBeVisible();
});

it("listas para decidir usa ANSWERED, no número de respuestas ni PARTIAL", () => {
  const data = dashboard();
  data.questions[0]!.status = "PARTIAL";
  data.questions[0]!.submittedRespondents = 50;
  expect(
    attentionQuestions(data.questions, "ready", "", []).map((q) => q.id),
  ).toEqual(["q-2"]);
});

// ---- UX-01 / UX-03: the queue at project scale ---------------------------
function scaleDashboard(): AttentionDashboard {
  // 304 questions: 2 conflicts, 22 ready, 13 clarifications (one of them under
  // a conflict), 124 waiting on people, 143 without assigned participants.
  const statuses = (i: number) => {
    if (i < 2) return ["CONFLICT", 2, 1] as const;
    if (i < 24) return ["ANSWERED", 2, 2] as const;
    if (i < 36) return ["CLARIFICATION_REQUIRED", 2, 2] as const;
    if (i < 160) return [i % 2 ? "PARTIAL" : "PENDING", 3, 1] as const;
    return ["PENDING", 0, 0] as const;
  };
  return {
    ...base,
    role: "ANALYST",
    questions: Array.from({ length: 304 }, (_, i) => {
      const [status, required, submitted] = statuses(i);
      return {
        ...base.questions[0]!,
        id: `q-${i}`,
        title: `Caso ${i}`,
        status,
        requiredRespondents: required,
        submittedRespondents: submitted,
      };
    }),
  };
}
function scaleInbox(data: AttentionDashboard, page: number): ReviewInbox {
  const all = inbox(data, 1);
  const items = data.questions.slice((page - 1) * 100, page * 100).map((q) => ({
    ...all.items[0]!,
    questionId: q.id,
    status: q.status,
    question: `¿Pregunta completa ${q.title}?`,
    // q-0 is a conflict that also has an open clarification; q-24..35 only clarify.
    openClarifications:
      q.id === "q-0" || q.status === "CLARIFICATION_REQUIRED" ? 1 : 0,
    hasEvidence: q.id === "q-0" || q.id === "q-24",
    lastContributionAt: q.id === "q-0" ? "2026-10-05T16:30:00.000Z" : null,
  }));
  return { ...all, items, total: data.questions.length, page, pageSize: 100 };
}
function mockScale(data = scaleDashboard()) {
  vi.spyOn(apiModule, "api").mockImplementation(async (key, _params, input) =>
    key === "invitations"
      ? { items: [], page: 1, total: 0 }
      : scaleInbox(data, (input as { page: number }).page),
  );
  return data;
}
function renderScale(
  cache: QueryClient,
  data: AttentionDashboard,
  initial = "/?keep=context",
) {
  return render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[initial]}>
        <ProjectAttention projectId="project" data={data} lifecycle="ACTIVE" />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const queueRows = () => document.querySelectorAll(".ac-queue-row").length;
const rowsIn = (list: HTMLElement) => list.querySelectorAll(":scope > li");
// The clarification count arrives with the inbox; the queue is final after it.
const settled = () =>
  waitFor(() =>
    expect(
      within(screen.getByRole("article", { name: "Aclaraciones" })).getByText(
        "13",
      ),
    ).toBeVisible(),
  );
const fold = (name: RegExp) =>
  screen
    .getAllByText(name)
    .map((node) => node.closest("details"))
    .find(Boolean)!;

it("UX-01: con 304 preguntas el trabajo accionable se ve y lo demás empieza plegado con su conteo", async () => {
  const data = mockScale();
  renderScale(client(), data);
  const working = await screen.findByRole("list", { name: "Te toca a ti" });
  await settled();
  // Conflicts first, then ready to decide; one row per question.
  expect(rowsIn(working)).toHaveLength(24);
  // The waiting group is folded, shows its count and holds no rows yet.
  const waiting = fold(/En espera de otras personas/);
  expect(waiting).not.toHaveAttribute("open");
  expect(within(waiting).getByText("124 preguntas")).toBeVisible();
  expect(waiting.querySelectorAll(".ac-queue-row")).toHaveLength(0);
  expect(fold(/Sin participantes asignados/)).not.toHaveAttribute("open");
  expect(fold(/Todas las preguntas \(304\)/)).not.toHaveAttribute("open");
  // 24 working + 12 clarification rows, not the 304 + 160 of the old queue.
  expect(queueRows()).toBe(24 + 12);
});

it("UX-01: un grupo largo se revela de 50 en 50, conserva el foco en la primera fila nueva y no rinde de más", async () => {
  const data = mockScale();
  const user = userEvent.setup();
  renderScale(client(), data);
  await screen.findByRole("list", { name: "Te toca a ti" });
  await settled();
  const waiting = fold(/En espera de otras personas/);
  await user.click(within(waiting).getByText(/En espera de otras personas/));
  expect(waiting).toHaveAttribute("open");
  const list = within(waiting).getByRole("list", {
    name: "En espera de otras personas",
  });
  expect(rowsIn(list)).toHaveLength(50);
  expect(within(waiting).getByText("Mostrando 50 de 124")).toBeVisible();
  await user.click(
    within(waiting).getByRole("button", { name: "Mostrar 50 más" }),
  );
  expect(rowsIn(list)).toHaveLength(100);
  const first = list.querySelectorAll<HTMLElement>("[data-workbench-id]")[50]!;
  expect(first).toHaveFocus();
  await user.click(
    within(waiting).getByRole("button", { name: "Mostrar 24 más" }),
  );
  expect(rowsIn(list)).toHaveLength(124);
  expect(
    within(waiting).queryByRole("button", { name: /Mostrar/ }),
  ).not.toBeInTheDocument();
  expect(queueRows()).toBe(24 + 12 + 124);
});

it("UX-01: un grupo de trabajo largo se revela de 25 en 25, con el foco en la primera fila nueva", async () => {
  const data = scaleDashboard();
  // 70 more questions ready to decide: 2 conflicts + 22 + 70 = 94 working rows.
  data.questions = data.questions.map((q, i) =>
    i >= 36 && i < 106
      ? {
          ...q,
          status: "ANSWERED" as const,
          requiredRespondents: 2,
          submittedRespondents: 2,
        }
      : q,
  );
  mockScale(data);
  const user = userEvent.setup();
  renderScale(client(), data);
  const working = await screen.findByRole("list", { name: "Te toca a ti" });
  await settled();
  expect(rowsIn(working)).toHaveLength(25);
  expect(screen.getByText("Mostrando 25 de 94")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Mostrar 25 más" }));
  expect(rowsIn(working)).toHaveLength(50);
  expect(
    working.querySelectorAll<HTMLElement>("[data-workbench-id]")[25],
  ).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Mostrar 25 más" }));
  await user.click(screen.getByRole("button", { name: "Mostrar 19 más" }));
  expect(rowsIn(working)).toHaveLength(94);
  expect(
    screen.queryByRole("button", { name: /^Mostrar \d+ más$/ }),
  ).not.toBeInTheDocument();
});

it("UX-04: la fila ya no repite una frase fija: da la fecha de la última aportación cuando se conoce", async () => {
  const data = mockScale();
  renderScale(client(), data);
  await screen.findByRole("list", { name: "Te toca a ti" });
  await settled();
  expect(
    screen.queryByText(/Hay un conflicto registrado entre aportaciones/),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/Se recibieron respuestas; todavía no hay una decisión/),
  ).not.toBeInTheDocument();
  const row = screen
    .getByRole("link", { name: "Resolver conflicto: Caso 0" })
    .closest(".ac-queue-row") as HTMLElement;
  expect(within(row).getByText(/^Última aportación /)).toBeVisible();
  // A row without that fact says nothing instead of inventing it.
  const other = screen
    .getByRole("link", { name: /^Revisar y decidir: Caso 5$/ })
    .closest(".ac-queue-row") as HTMLElement;
  expect(
    within(other).queryByText(/Última aportación/),
  ).not.toBeInTheDocument();
});
it("UX-03: una pregunta con conflicto y aclaración abierta aparece una vez y la fila conserva ambas señales", async () => {
  const data = mockScale();
  renderScale(client(), data);
  await screen.findByRole("list", { name: "Te toca a ti" });
  await settled();
  const links = screen.getAllByRole("link", { name: /: Caso 0$/ });
  expect(links).toHaveLength(1);
  expect(links[0]).toHaveAccessibleName("Resolver conflicto: Caso 0");
  const row = links[0]!.closest(".ac-queue-row") as HTMLElement;
  expect(within(row).getByText("Conflicto")).toBeVisible();
  expect(within(row).getByText("Aclaraciones abiertas")).toBeVisible();
  expect(within(row).getByText("Con evidencia")).toBeVisible();
  // The clarification group lists only questions that are not listed above.
  const clarifications = screen.getByRole("list", {
    name: "Aclaraciones abiertas",
  });
  expect(within(clarifications).queryByText(/Caso 0$/)).not.toBeInTheDocument();
  expect(rowsIn(clarifications)).toHaveLength(12);
  // Counts may overlap by design: the summary still counts it in both entries.
  expect(
    within(screen.getByRole("article", { name: "Conflictos" })).getByText("2"),
  ).toBeVisible();
});

it("UX-01: los filtros se conservan, filtran la lista completa y también se revelan por tramos", async () => {
  const data = mockScale();
  const user = userEvent.setup();
  renderScale(client(), data);
  await screen.findByRole("list", { name: "Te toca a ti" });
  await settled();
  await user.selectOptions(screen.getByLabelText("Filtrar estado"), "PENDING");
  const result = within(
    screen.getByRole("region", { name: "Qué requiere atención" }),
  );
  const pending = data.questions.filter((q) => q.status === "PENDING").length;
  expect(result.getByRole("status")).toHaveTextContent(`${pending} preguntas`);
  const list = screen.getByRole("list", { name: "Casos de atención" });
  expect(rowsIn(list)).toHaveLength(50);
  expect(screen.getByLabelText("Consulta actual")).toHaveTextContent(
    "keep=context&status=PENDING",
  );
  await user.click(screen.getByRole("button", { name: "Mostrar 50 más" }));
  expect(rowsIn(list)).toHaveLength(100);
  // Clearing the filter keeps the rest of the URL and goes back to the queue.
  await user.click(
    screen.getByRole("button", { name: "Ver todas las preguntas" }),
  );
  expect(screen.getByLabelText("Consulta actual")).toHaveTextContent(
    "?keep=context",
  );
  expect(
    await screen.findByRole("list", { name: "Te toca a ti" }),
  ).toBeVisible();
});

it("UX-01: lo abierto y lo revelado se restauran al volver de una revisión, incluida la fila de retorno", async () => {
  const data = mockScale();
  const cache = client();
  const user = userEvent.setup();
  const first = renderScale(cache, data);
  await screen.findByRole("list", { name: "Te toca a ti" });
  await settled();
  await user.click(
    within(fold(/En espera de otras personas/)).getByText(
      /En espera de otras personas/,
    ),
  );
  await user.click(screen.getByRole("button", { name: "Mostrar 50 más" }));
  first.unmount();
  // Back from a review: the same session context, a fresh mount.
  renderScale(cache, data);
  await screen.findByRole("list", { name: "Te toca a ti" });
  const waiting = fold(/En espera de otras personas/);
  expect(waiting).toHaveAttribute("open");
  expect(
    rowsIn(
      within(waiting).getByRole("list", {
        name: "En espera de otras personas",
      }),
    ),
  ).toHaveLength(100);
});

it("UX-01: si el contexto guardado apunta a una fila de un grupo plegado, ese grupo se abre y la fila se rinde", async () => {
  const data = mockScale();
  const cache = client();
  // Row 150 is deep inside the waiting group (index > 100 there).
  cache.setQueryData(["workbench-context", "project", "attention"], {
    search: "",
    scroll: 0,
    focusId: "q-150",
  });
  renderScale(cache, data);
  await screen.findByRole("list", { name: "Te toca a ti" });
  await settled();
  const waiting = fold(/En espera de otras personas/);
  expect(waiting).toHaveAttribute("open");
  expect(
    within(waiting).getByRole("link", { name: /: Caso 150$/ }),
  ).toHaveAttribute("data-workbench-id", "q-150");
  // Only the section that lists the row opens; the full list stays folded and
  // the question is rendered once, so focus restoration has a single target.
  expect(fold(/Todas las preguntas \(304\)/)).not.toHaveAttribute("open");
  expect(screen.getAllByRole("link", { name: /: Caso 150$/ })).toHaveLength(1);
});
