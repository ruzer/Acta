import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api } from "../api";
import { ReviewInbox } from "./ReviewInbox";

vi.mock("../api", () => ({ api: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const p1 = "00000000-0000-4000-8000-000000000001";
const p2 = "00000000-0000-4000-8000-000000000002";
const section = "00000000-0000-4000-8000-000000000003";
const area = "00000000-0000-4000-8000-000000000004";
const person = "00000000-0000-4000-8000-000000000005";
const result = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
  filters: {
    projects: [
      { id: p1, name: "Proyecto uno" },
      { id: p2, name: "Proyecto dos" },
    ],
    sections: [{ id: section, name: "Tema compartido" }],
    areas: [{ id: area, name: "Área de prueba" }],
    participants: [{ id: person, name: "Persona de prueba" }],
  },
};
function Location() {
  const value = useLocation();
  return (
    <output aria-label="Ruta de prueba">{value.pathname + value.search}</output>
  );
}
function setup(search = "") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/review" + search]}>
        <ReviewInbox />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("conserva los filtros y el foco mientras llega la nueva lista", async () => {
  let finish!: (value: typeof result) => void;
  const next = new Promise<typeof result>((resolve) => {
    finish = resolve;
  });
  vi.mocked(api)
    .mockResolvedValueOnce(result)
    .mockImplementationOnce(() => next);
  setup();
  const project = await screen.findByLabelText("Proyecto");
  project.focus();
  fireEvent.change(project, { target: { value: p2 } });
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  for (const label of [
    "Proyecto",
    "Tema",
    "Área responsable",
    "Participante asignado",
  ])
    expect(screen.getByLabelText(label)).toBeVisible();
  expect(project).toHaveFocus();
  expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  finish({ ...result, filters: { ...result.filters, sections: [] } });
  await waitFor(() =>
    expect(document.querySelector('[aria-busy="true"]')).toBeNull(),
  );
  expect(api).toHaveBeenCalledTimes(2);
  expect(project).toHaveFocus();
});
