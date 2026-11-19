import { expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { availableGuides, helpGuides } from "../../app/frontend/src/pages/Help";
import { pendingFirstSteps } from "../../app/frontend/src/pages/FirstSteps";
import {
  questionnaireView,
  type QuestionnaireView,
} from "@requirements/contracts";
const compact = (s: string) => s.replace(/\s+/g, " ").trim();
function sources(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(path, e.name))
      : /\.tsx?$/.test(e.name) && !/\.test\.|^Help\.tsx$/.test(e.name)
        ? [compact(readFileSync(join(path, e.name), "utf8"))]
        : [],
  );
}
it("cada etiqueta de las guías existe en la interfaz y coincide con la ayuda, sin usar la ayuda como prueba de sí misma", () => {
  const code = ["app/frontend/src", "app/backend/src", "packages/contracts/src"]
    .flatMap(sources)
    .join("\n");
  for (const [key, name] of [
    ["participant", "PARTICIPANTE"],
    ["administration", "ADMINISTRACION"],
    ["review", "REVISION"],
  ]) {
    const text = readFileSync(`docs/pilot/GUIA-${name}.md`, "utf8");
    const labels = [
      ...new Set(
        [...text.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => compact(m[1])),
      ),
    ].sort();
    for (const label of labels)
      expect(code, `Etiqueta sin correspondencia: ${label}`).toContain(label);
    const node = document.createElement("div");
    node.innerHTML = renderToStaticMarkup(helpGuides[key].content);
    expect(
      [
        ...new Set(
          [...node.querySelectorAll("strong")].map((e) =>
            compact(e.textContent ?? ""),
          ),
        ),
      ].sort(),
    ).toEqual(labels);
  }
});
it("las guías dependen de los roles actuales; administración institucional puede consultar todas", () => {
  expect(availableGuides(true, [])).toEqual([
    "participant",
    "administration",
    "review",
  ]);
  expect(availableGuides(false, ["STAKEHOLDER"])).toEqual(["participant"]);
  expect(availableGuides(false, ["ANALYST"])).toEqual(["review"]);
  expect(availableGuides(false, ["ADMIN", "STAKEHOLDER", "ADMIN"])).toEqual([
    "administration",
    "participant",
  ]);
  expect(availableGuides(false, ["VIEWER"])).toEqual([]);
});
it("Primeros pasos usa preguntas, miembros y asignaciones activas; los pasos terminados desaparecen", () => {
  const empty = questionnaireView.parse({
    structureVersion: 0,
    sections: [],
    questions: [],
    references: [],
    areas: [],
    members: [],
  });
  expect(Object.values(pendingFirstSteps(empty, false))).toEqual([
    true,
    true,
    true,
    true,
    true,
  ]);
  const data = {
    ...empty,
    members: [{ id: "m", role: "STAKEHOLDER", active: true }],
    questions: [
      {
        publication: "PUBLISHED",
        assignments: [{ active: true, projectMemberId: "m" }],
      },
    ],
  } as QuestionnaireView;
  expect(Object.values(pendingFirstSteps(data, true))).toEqual([
    false,
    false,
    false,
    false,
    false,
  ]);
  data.members[0].active = false;
  expect(pendingFirstSteps(data, false)).toMatchObject({
    people: true,
    assignments: true,
    publish: false,
  });
  data.questions[0].publication = "ARCHIVED";
  expect(pendingFirstSteps(data, false)).toMatchObject({
    questions: true,
    publish: true,
  });
});
