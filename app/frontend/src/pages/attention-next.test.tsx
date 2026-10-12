import { expect, it } from "vitest";
import { dashboardView } from "@requirements/contracts";
import fixture from "../../../../tests/fixtures/analyst-visual.json";
import { nextToReview } from "./attention-data";

const base = dashboardView.parse(fixture.dashboard).questions[0]!;
const question = (id: string, status: typeof base.status) => ({
  ...base,
  id,
  status,
});
// Atención shows conflicts first, then ready to decide, in the dashboard order.
const questions = [
  question("answer-1", "ANSWERED"),
  question("conflict-1", "CONFLICT"),
  question("answer-2", "ANSWERED"),
  question("waiting", "PENDING"),
  question("conflict-2", "CONFLICT"),
];
const next = (search: string, id: string) =>
  nextToReview(questions, search, id)?.id;

it("sigue el orden de «Te toca a ti»: conflictos primero, después las listas para decidir", () => {
  expect(next("", "conflict-1")).toBe("conflict-2");
  expect(next("", "conflict-2")).toBe("answer-1");
  expect(next("", "answer-1")).toBe("answer-2");
});
it("nunca devuelve la pregunta actual y vuelve al principio al llegar al final", () => {
  expect(next("", "answer-2")).toBe("conflict-1");
  expect(
    nextToReview([question("solo", "ANSWERED")], "", "solo"),
  ).toBeUndefined();
});
it("avanza aunque la actual ya no figure en la lista (decidida y actualizada)", () => {
  expect(next("", "decidida")).toBe("conflict-1");
});
it("respeta los filtros con los que se abrió la revisión", () => {
  expect(next("task=ready", "answer-1")).toBe("answer-2");
  expect(next("task=ready", "answer-2")).toBe("answer-1");
  expect(next("task=conflicts", "conflict-1")).toBe("conflict-2");
  expect(next("status=CONFLICT", "conflict-2")).toBe("conflict-1");
});
it("no ofrece nada cuando el filtro necesita datos que esta página no tiene o no hay más", () => {
  expect(next("task=clarifications", "conflict-1")).toBeUndefined();
  expect(next("status=PENDING", "waiting")).toBeUndefined();
  expect(next("status=VALIDATED", "answer-1")).toBeUndefined();
});
it("ignora parámetros desconocidos en lugar de filtrar con ellos", () => {
  expect(next("task=otra&status=inventado", "conflict-1")).toBe("conflict-2");
});
