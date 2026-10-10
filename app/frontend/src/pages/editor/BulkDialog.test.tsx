import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import {
  questionnaireView,
  type BulkOperation,
  type BulkPreview,
} from "@requirements/contracts";
import fixture from "../../../../../tests/fixtures/analyst-visual.json";
import { BulkDialog } from "./BulkDialog";
import { questionGroup } from "./bulk-selection";
const data = questionnaireView.parse(fixture.questionnaire),
  question = data.questions[0]!;
const count = {
  selected: 1,
  applicable: 1,
  ignored: 0,
  blocked: 0,
  warnings: 0,
  newAssignments: 0,
  reactivatedAssignments: 0,
  existingAssignments: 0,
};
function preview(
  operation: BulkOperation,
  body: Record<string, unknown>,
): BulkPreview {
  return {
    operation,
    requestId: body.requestId as string,
    previewHash: "a".repeat(64),
    canConfirm: true,
    counts: count,
    items: [
      {
        questionId: question.id,
        title: question.title,
        state: "READY",
        errors: [],
        warnings: [],
      },
    ],
    dependencies: [],
  };
}
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function mount(
  operation: BulkOperation,
  onRefresh?: () => Promise<typeof data>,
) {
  const complete = vi.fn(),
    close = vi.fn(),
    correct = vi.fn(),
    dependency = vi.fn();
  render(
    <BulkDialog
      data={data}
      onRefresh={onRefresh}
      projectId="project"
      questions={[question]}
      operation={operation}
      onComplete={complete}
      onClose={close}
      onCorrect={correct}
      onAddDependency={dependency}
    />,
  );
  return { user: userEvent.setup(), complete, close, correct, dependency };
}
it("preview does not confirm; cancel preserves data; result and focus are explicit", async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url: String(url), body });
      return Response.json(preview("PUBLISH", body));
    }),
  );
  const { user, close, complete } = mount("PUBLISH");
  await user.click(screen.getByRole("button", { name: "Revisar lote" }));
  expect(
    await screen.findByRole("heading", { name: "Revisión del lote" }),
  ).toHaveFocus();
  expect(calls).toHaveLength(1);
  expect(calls[0]!.url).toMatch(/publish\/preview$/);
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(close).toHaveBeenCalledOnce();
  expect(complete).not.toHaveBeenCalled();
  expect(calls).toHaveLength(1);
});
it("confirm retries exact idempotency payload after connection loss; success only after response", async () => {
  const confirms: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      const body = JSON.parse(options.body);
      if (String(url).endsWith("/preview"))
        return Response.json(preview("PUBLISH", body));
      confirms.push(body);
      if (confirms.length === 1) throw new Error("connection lost");
      return Response.json({
        operation: "PUBLISH",
        requestId: body.requestId,
        changedIds: [question.id],
        ignoredIds: [],
        newAssignments: 0,
        reactivatedAssignments: 0,
      });
    }),
  );
  const { user, complete } = mount("PUBLISH");
  await user.click(screen.getByRole("button", { name: "Revisar lote" }));
  await user.click(
    await screen.findByRole("button", { name: "Confirmar 1 pregunta" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("No hay conexión");
  expect(complete).not.toHaveBeenCalled();
  await user.click(
    screen.getByRole("button", { name: "Confirmar 1 pregunta" }),
  );
  expect(complete).toHaveBeenCalledOnce();
  expect(confirms[1]).toEqual(confirms[0]);
});
it("a conflict requires another review and keeps the selected operation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      const body = JSON.parse(options.body);
      return String(url).endsWith("/preview")
        ? Response.json(preview("PUBLISH", body))
        : Response.json(
            {
              code: "409",
              requestId: crypto.randomUUID(),
              message: "El cuestionario cambió. Actualiza y revisa nuevamente.",
              fieldErrors: {},
            },
            { status: 409 },
          );
    }),
  );
  const { user, complete } = mount("PUBLISH");
  await user.click(screen.getByRole("button", { name: "Revisar lote" }));
  await user.click(
    await screen.findByRole("button", { name: "Confirmar 1 pregunta" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(/cambió/);
  expect(
    screen.getByRole("button", { name: "Confirmar 1 pregunta" }),
  ).toBeDisabled();
  expect(complete).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Actualizar y revisar nuevamente" }),
  ).toBeEnabled();
});
it("refresh uses the shared editor reload and reviews fresh versions with a new request", async () => {
  const commands: Record<string, unknown>[] = [];
  const refreshed = structuredClone(data);
  refreshed.questions[0]!.lockVersion += 1;
  const refresh = vi.fn(async () => refreshed);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url, options) => {
      const body = JSON.parse(options.body);
      if (String(url).endsWith("/preview")) {
        commands.push(body);
        return Response.json(preview("PUBLISH", body));
      }
      return Response.json(
        {
          code: "409",
          requestId: crypto.randomUUID(),
          message: "El cuestionario cambió.",
          fieldErrors: {},
        },
        { status: 409 },
      );
    }),
  );
  const { user, complete } = mount("PUBLISH", refresh);
  await user.click(screen.getByRole("button", { name: "Revisar lote" }));
  await user.click(
    await screen.findByRole("button", { name: "Confirmar 1 pregunta" }),
  );
  await user.click(
    await screen.findByRole("button", {
      name: "Actualizar y revisar nuevamente",
    }),
  );
  expect(refresh).toHaveBeenCalledOnce();
  expect(commands).toHaveLength(2);
  expect(commands[1]!.questions).toEqual([
    { id: question.id, expectedVersion: question.lockVersion + 1 },
  ]);
  expect(commands[1]!.requestId).not.toEqual(commands[0]!.requestId);
  expect(
    screen.getByRole("button", { name: "Confirmar 1 pregunta" }),
  ).toBeEnabled();
  expect(complete).not.toHaveBeenCalled();
});
it("blocked preview provides correction and explicit dependency inclusion without publication", async () => {
  const parent = data.questions[1]!;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body);
      return Response.json({
        ...preview("PUBLISH", body),
        canConfirm: false,
        counts: { ...count, applicable: 0, blocked: 1 },
        items: [
          {
            questionId: question.id,
            title: question.title,
            state: "BLOCKED",
            errors: [
              {
                message: "Publica primero la pregunta principal.",
                field: "groupParentId",
                targetId: parent.id,
              },
            ],
            warnings: [],
          },
        ],
        dependencies: [
          {
            questionId: question.id,
            dependsOnId: parent.id,
            title: parent.title,
            kind: "GROUP",
            inSelection: false,
            publication: "DRAFT",
          },
        ],
      });
    }),
  );
  const { user, dependency } = mount("PUBLISH");
  await user.click(screen.getByRole("button", { name: "Revisar lote" }));
  expect(
    await screen.findByRole("button", { name: "Confirmar 0 preguntas" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: `Ir a corregir: ${question.title}` }),
  ).toBeVisible();
  await user.click(
    screen.getByRole("button", {
      name: `Añadir «${parent.title}» a la selección`,
    }),
  );
  expect(dependency).toHaveBeenCalledWith(parent.id);
  expect(screen.getByRole("button", { name: "Revisar lote" })).toBeVisible();
});
it("area source mode is explicit and changing area never sends unrelated metadata", async () => {
  let sent: Record<string, unknown> | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      sent = JSON.parse(options.body);
      return Response.json(preview("ASSIGN_AREA", sent!));
    }),
  );
  const { user } = mount("ASSIGN_AREA");
  expect(screen.getByRole("button", { name: "Revisar lote" })).toBeDisabled();
  await user.selectOptions(
    screen.getByLabelText("Área origen"),
    question.responsibleAreaId,
  );
  await user.selectOptions(
    screen.getByLabelText("Nueva área responsable"),
    data.areas[0]!.id,
  );
  await user.click(screen.getByRole("button", { name: "Revisar lote" }));
  expect(
    await screen.findByRole("heading", { name: "Revisión del lote" }),
  ).toBeVisible();
  expect(sent).toEqual({
    requestId: expect.any(String),
    questions: [{ id: question.id, expectedVersion: question.lockVersion }],
    sourceAreaId: question.responsibleAreaId,
    targetAreaId: data.areas[0]!.id,
  });
});
it("participants require explicit new-assignment policy and explain existing assignments", async () => {
  let sent: Record<string, unknown> | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) => {
      sent = JSON.parse(options.body);
      return Response.json({
        ...preview("ADD_PARTICIPANTS", sent!),
        counts: { ...count, existingAssignments: 1, newAssignments: 1 },
      });
    }),
  );
  const { user } = mount("ADD_PARTICIPANTS");
  const group = screen.getByRole("group", { name: "Participantes a agregar" });
  const checks = within(group).getAllByRole("checkbox");
  await user.click(checks[0]!);
  expect(screen.getByRole("button", { name: "Revisar lote" })).toBeDisabled();
  await user.selectOptions(
    screen.getByLabelText("Las nuevas asignaciones serán"),
    "no",
  );
  await user.click(screen.getByRole("button", { name: "Revisar lote" }));
  expect(await screen.findByText(/1 existentes sin cambios/)).toBeVisible();
  expect(sent?.participants).toEqual([
    {
      projectMemberId: data.members.find(
        (m) => m.role === "STAKEHOLDER" && m.active,
      )!.id,
      required: false,
    },
  ]);
});
it("group selection follows descendants only, never condition edges, and terminates on a malformed cycle", () => {
  const root = { ...question, id: "root", groupParentId: null };
  const child = { ...question, id: "child", groupParentId: "root" };
  const grandchild = { ...question, id: "grandchild", groupParentId: "child" };
  const conditional = {
    ...question,
    id: "conditional",
    groupParentId: null,
    condition: {
      parentQuestionId: "root",
      operator: "EQUALS" as const,
      value: true,
    },
  };
  expect(
    questionGroup([root, child, grandchild, conditional], "root").map(
      (q) => q.id,
    ),
  ).toEqual(["root", "child", "grandchild"]);
  expect(
    questionGroup([{ ...root, groupParentId: "child" }, child], "root"),
  ).toHaveLength(2);
});
it("UX-14: un lote sin cambios es información; solo los bloqueos son un error", async () => {
  let blocked = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url, options) =>
      Response.json({
        ...preview("PUBLISH", JSON.parse(options.body)),
        canConfirm: false,
        counts: { ...count, applicable: 0, blocked },
      }),
    ),
  );
  const first = mount("PUBLISH");
  await first.user.click(screen.getByRole("button", { name: "Revisar lote" }));
  const info = await screen.findByText("No hay cambios que aplicar.");
  // Nothing to apply is announced politely, not as an alert.
  expect(info.closest("[role]")).toHaveAttribute("role", "status");
  cleanup();
  blocked = 1;
  const second = mount("PUBLISH");
  await second.user.click(screen.getByRole("button", { name: "Revisar lote" }));
  const error = await screen.findByText(
    "Hay errores que debes resolver. No se aplicará ningún cambio.",
  );
  expect(error.closest("[role]")).toHaveAttribute("role", "alert");
});
