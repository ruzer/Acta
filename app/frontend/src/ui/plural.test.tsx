import { expect, it } from "vitest";
import { plural } from "./plural";
it("uses the singular only for exactly one", () => {
  expect(plural(1, "pregunta")).toBe("1 pregunta");
  expect(plural(0, "pregunta")).toBe("0 preguntas");
  expect(plural(2, "pregunta")).toBe("2 preguntas");
});
it("takes an explicit plural when it is not the singular plus s", () => {
  expect(plural(1, "aportación", "aportaciones")).toBe("1 aportación");
  expect(plural(3, "aportación", "aportaciones")).toBe("3 aportaciones");
});
it("lets an adjective agree with the noun", () => {
  expect(plural(1, "pregunta seleccionada", "preguntas seleccionadas")).toBe(
    "1 pregunta seleccionada",
  );
  expect(plural(4, "pregunta seleccionada", "preguntas seleccionadas")).toBe(
    "4 preguntas seleccionadas",
  );
});
