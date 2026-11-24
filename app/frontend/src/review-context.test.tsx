import { afterEach, expect, it, vi } from "vitest";
import {
  cleanReviewSearch,
  rememberReviewSearch,
  reviewReturnSearch,
} from "./review-context";
import {
  clearSessionPresentation,
  presentationKey,
} from "./session-presentation";
const project = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const filters = `projectId=${project}&status=PARTIAL&page=3`;
afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});
it("recupera los filtros solo para la cuenta y proyecto actuales", () => {
  rememberReviewSearch("analyst-a", filters);
  expect(reviewReturnSearch("analyst-a", project, null, null)).toBe(filters);
  expect(reviewReturnSearch("analyst-b", project, null, null)).toBe(
    `projectId=${project}`,
  );
  expect(reviewReturnSearch("analyst-a", other, null, null)).toBe(
    `projectId=${other}`,
  );
  expect(reviewReturnSearch("", project, null, null)).toBe(
    `projectId=${project}`,
  );
});
it("la URL manda, conserva volver a todos los proyectos y rechaza valores inválidos", () => {
  rememberReviewSearch("analyst-a", filters);
  expect(
    reviewReturnSearch("analyst-a", project, "status=CONFLICT", filters),
  ).toBe("status=CONFLICT");
  expect(reviewReturnSearch("analyst-a", project, "", filters)).toBe("");
  expect(cleanReviewSearch("status=FAKE&page=-1")).toBeNull();
  expect(
    cleanReviewSearch(
      "status=PARTIAL&answer=privado&redirect=https://evil.example",
    ),
  ).toBe("status=PARTIAL");
  expect(cleanReviewSearch("x".repeat(4097))).toBeNull();
});
it("almacena solo filtros y limpia su espacio al cerrar sesión sin afectar a otros datos", () => {
  rememberReviewSearch("analyst-a", filters + "&answer=privado");
  const key = presentationKey("analyst-a", "review", "filters");
  expect(sessionStorage.getItem(key)).toBe(filters);
  sessionStorage.setItem("otra-preferencia", "conservar");
  clearSessionPresentation();
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(sessionStorage.getItem("otra-preferencia")).toBe("conservar");
});
it("la navegación funciona si el navegador no permite guardar preferencias", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(() => rememberReviewSearch("analyst-a", filters)).not.toThrow();
  expect(reviewReturnSearch("analyst-a", project, filters, null)).toBe(filters);
  expect(reviewReturnSearch("analyst-a", project, null, null)).toBe(
    `projectId=${project}`,
  );
});
