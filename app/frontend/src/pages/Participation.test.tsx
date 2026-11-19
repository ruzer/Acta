import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import type { ParticipationView } from "@requirements/contracts";
import { exchangeRequest } from "../api";
import { Participation } from "./Participation";
vi.mock("../api", () => ({ api: vi.fn(), exchangeRequest: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});
const data: ParticipationView = {
  projectName: "Proyecto ficticio",
  role: "ANALYST",
  responseDueAt: "2026-12-01T23:59:59.999Z",
  participants: [
    {
      memberId: "a",
      name: "Ana Ejemplo",
      area: "Área privada A",
      assigned: 4,
      required: 4,
      drafts: 0,
      sent: 0,
      pending: 4,
      lastActivity: null,
      state: "Sin iniciar",
    },
    {
      memberId: "b",
      name: "Beatriz Ejemplo",
      area: "Área privada B",
      assigned: 4,
      required: 4,
      drafts: 1,
      sent: 1,
      pending: 3,
      lastActivity: null,
      state: "Envió parte",
    },
  ],
};
it("ordena por avance y resuelve empates por nombre", async () => {
  await setup({
    ...data,
    participants: [
      {
        ...data.participants[0]!,
        memberId: "complete",
        name: "A completa",
        state: "Completo",
        pending: 0,
      },
      {
        ...data.participants[0]!,
        memberId: "partial",
        name: "B parte",
        state: "Envió parte",
      },
      {
        ...data.participants[0]!,
        memberId: "draft",
        name: "C borrador",
        state: "En borrador",
      },
      {
        ...data.participants[0]!,
        memberId: "new-z",
        name: "Z inicio",
        state: "Sin iniciar",
      },
      {
        ...data.participants[0]!,
        memberId: "new-a",
        name: "D inicio",
        state: "Sin iniciar",
      },
    ],
  });
  fireEvent.change(screen.getByLabelText("Ordenar participación"), {
    target: { value: "state" },
  });
  const names = screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0]!.textContent);
  expect(names).toEqual([
    "D inicio",
    "Z inicio",
    "C borrador",
    "B parte",
    "A completa",
  ]);
});
async function setup(value = data) {
  vi.mocked(exchangeRequest).mockResolvedValue(value);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/projects/p/participation"]}>
        <Routes>
          <Route
            path="/projects/:projectId/participation"
            element={<Participation />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByRole("table");
}
it.each([false, true])(
  "el recordatorio individual no incluye a otra persona (fallo de portapapeles: %s)",
  async (fails) => {
    const writeText = fails
      ? vi.fn().mockRejectedValue(new Error("No disponible"))
      : vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await setup();
    const row = screen.getByRole("row", { name: /Ana Ejemplo/ });
    fireEvent.click(
      within(row).getByRole("button", { name: /Copiar recordatorio/ }),
    );
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const text = writeText.mock.calls[0]![0] as string;
    expect(text).toContain("Ana Ejemplo: 4 preguntas obligatorias pendientes");
    expect(text).toContain(data.projectName);
    expect(text).toContain("1 de diciembre");
    expect(text).toContain(window.location.origin);
    expect(text).not.toMatch(/Beatriz|Área privada|3 preguntas/);
    if (fails) {
      const fallback = await screen.findByLabelText(
        "Texto del recordatorio para copiar",
      );
      expect(fallback).toHaveValue(text);
      expect(fallback).toHaveFocus();
      expect((fallback as HTMLTextAreaElement).selectionEnd).toBe(text.length);
    } else
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Recordatorio copiado",
        ),
      );
    vi.unstubAllGlobals();
  },
);
