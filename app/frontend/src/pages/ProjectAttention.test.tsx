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
  expect(screen.getByRole("link", { name: "Caso 0" })).toHaveAttribute(
    "data-workbench-id",
    "q-0",
  );
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
