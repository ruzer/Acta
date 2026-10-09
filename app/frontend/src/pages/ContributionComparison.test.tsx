import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { reviewDetailView, type ReviewDetail } from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import * as apiModule from "../api";
import { ContributionComparison } from "./ContributionComparison";

const original = reviewDetailView.parse(fixture.conflict);
function data(count: number): ReviewDetail {
  return {
    ...original,
    submissions: Array.from({ length: count }, (_, i) => ({
      ...original.submissions[i % 2]!,
      id: `source-${i}`,
      respondent: { id: `actor-${i}`, displayName: `Actor ${i + 1}` },
      current: true,
      answer: `Aportación ${i + 1}`,
    })),
  };
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each([0, 1])("%i fuentes no aparentan una comparación posible", (count) => {
  render(<ContributionComparison data={data(count)} />);
  expect(
    screen.getByText("No hay dos aportaciones disponibles para comparar."),
  ).toBeVisible();
  expect(screen.queryAllByRole("region")).toHaveLength(0);
});
it.each([3, 12])(
  "contrasta dos de %i vigentes sin contar historia ni escribir",
  async (count) => {
    const user = userEvent.setup();
    const d = data(count);
    d.submissions.push({
      ...d.submissions[0]!,
      id: "historical",
      current: false,
      number: 19,
    });
    const request = vi.spyOn(apiModule, "api");
    render(<ContributionComparison data={d} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      `Comparando 2 de ${count} aportaciones vigentes.`,
    );
    expect(screen.getAllByRole("region")).toHaveLength(2);
    const a = screen.getByRole("combobox", {
      name: "Aportación para postura A",
    });
    const b = screen.getByRole("combobox", {
      name: "Aportación para postura B",
    });
    expect(within(a).getAllByRole("option")).toHaveLength(count);
    await user.selectOptions(a, `source-${count - 1}`);
    expect(
      within(screen.getByRole("region", { name: "Postura A" })).getByRole(
        "heading",
        { name: `Actor ${count}` },
      ),
    ).toBeVisible();
    expect(
      within(b).getByRole("option", { name: new RegExp(`^Actor ${count} ·`) }),
    ).toBeDisabled();
    await user.selectOptions(b, "source-0");
    expect(
      within(screen.getByRole("region", { name: "Postura B" })).getByText(
        "Aportación 1",
      ),
    ).toBeVisible();
    expect(
      within(a).getByRole("option", { name: /^Actor 1 ·/ }),
    ).toBeDisabled();
    expect(request).not.toHaveBeenCalled();
  },
);
it("el conflicto explica sus dos fuentes sin atribuirlo a las doce aportaciones", () => {
  render(
    <ContributionComparison
      data={data(12)}
      revisionIds={["source-2", "source-7"]}
    />,
  );
  // The scope is the conflict's own sources, never "2 of the 12 current".
  expect(screen.getByRole("status")).toHaveTextContent(
    "Comparando 2 de 2 fuentes registradas en este conflicto.",
  );
  expect(screen.getByRole("status")).not.toHaveTextContent("12");
  expect(screen.getByText(/Este conflicto vincula 2 fuentes/)).toBeVisible();
  expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  expect(
    within(screen.getByRole("region", { name: "Postura A" })).getByText(
      "Aportación 3",
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Postura B" })).getByText(
      "Aportación 8",
    ),
  ).toBeVisible();
});
it("un conflicto con tres de doce fuentes describe su propio alcance", () => {
  render(
    <ContributionComparison
      data={data(12)}
      revisionIds={["source-1", "source-4", "source-9"]}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Comparando 2 de 3 fuentes registradas en este conflicto.",
  );
  expect(screen.getByText(/Este conflicto vincula 3 fuentes/)).toBeVisible();
});
it("si el conflicto abarca exactamente todas las aportaciones vigentes el alcance sigue siendo vigente", () => {
  render(
    <ContributionComparison
      data={data(2)}
      revisionIds={["source-0", "source-1"]}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Comparando 2 de 2 aportaciones vigentes.",
  );
});
it("las fuentes históricas permanecen explícitas y no se sustituyen por otras vigentes", () => {
  const d = data(3);
  d.submissions[0]!.current = false;
  render(
    <ContributionComparison
      data={d}
      revisionIds={["source-0", "unavailable", "source-2"]}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Comparando 2 de 3 fuentes registradas en este conflicto.",
  );
  expect(
    within(screen.getByRole("region", { name: "Postura A" })).getByText(
      /Histórico/,
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Postura B" })).getByText(
      "El detalle de esta respuesta no está disponible.",
    ),
  ).toBeVisible();
});
it("ambas posturas mantienen actor, respuesta, contexto, evidencia y versión en el mismo orden", () => {
  render(<ContributionComparison data={data(2)} />);
  for (const name of ["Postura A", "Postura B"]) {
    const headings = within(screen.getByRole("region", { name })).getAllByRole(
      "heading",
    );
    expect(headings.slice(1).map((h) => h.textContent)).toEqual([
      "Respuesta",
      "Contexto",
      "Evidencia",
      "Versión y fecha",
    ]);
  }
});
it("un refresco que retira una fuente seleccionada mantiene dos fuentes distintas disponibles", async () => {
  const user = userEvent.setup(),
    d = data(3);
  const { rerender } = render(<ContributionComparison data={d} />);
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Aportación para postura A" }),
    "source-2",
  );
  rerender(
    <ContributionComparison
      data={{ ...d, submissions: d.submissions.slice(0, 2) }}
    />,
  );
  expect(
    within(screen.getByRole("region", { name: "Postura A" })).getByText(
      "Aportación 1",
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Postura B" })).getByText(
      "Aportación 2",
    ),
  ).toBeVisible();
});
