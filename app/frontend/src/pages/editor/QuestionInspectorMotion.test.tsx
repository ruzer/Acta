import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { questionnaireView } from "@requirements/contracts";
import fixture from "../../../../../tests/fixtures/analyst-visual.json";
import { QuestionInspector } from "./QuestionInspector";
import { QuestionInspectorActions } from "./QuestionInspectorActions";
import { useInspectorViewport } from "./useInspectorViewport";

const data = questionnaireView.parse(fixture.questionnaire);
const first = {
  ...data.questions[0]!,
  publication: "DRAFT" as const,
  groupParentId: null,
  condition: null,
};
const second = { ...first, id: "second", question: "Otra pregunta ficticia" };
let frames: Map<number, FrameRequestCallback>;
let frameId: number;
const action = vi.fn();
function Harness() {
  const [question, setQuestion] = useState<typeof first | null>(null);
  return (
    <>
      <button onClick={() => setQuestion(first)}>Abrir primera</button>
      <button onClick={() => setQuestion(second)}>Abrir segunda</button>
      <button>Destino posterior</button>
      <QuestionInspector
        data={{ ...data, questions: [first, second] }}
        projectId="fictitious"
        question={question}
        onClose={() => setQuestion(null)}
        visibleIds={[first.id, second.id]}
        onNavigate={(id) => setQuestion(id === first.id ? first : second)}
        onEdit={action}
        onAction={action}
        onCreateReference={action}
        onCreateTopic={action}
      />
    </>
  );
}
function nextFrame() {
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(performance.now()));
  });
}
beforeEach(() => {
  frames = new Map();
  frameId = 0;
  action.mockClear();
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const original = getComputedStyle;
  vi.stubGlobal("getComputedStyle", (element: Element) => {
    const style = original(element);
    if (element.classList.contains("qe-inspector-motion")) {
      style.transitionProperty = "opacity, transform";
      style.transitionDuration = "120ms";
      style.transitionDelay = "0s";
    }
    return style;
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("mantiene el panel durante cierre, lo redirige a otra pregunta y devuelve foco sin robarlo", () => {
  render(<Harness />);
  const opener = screen.getByText("Abrir primera");
  opener.focus();
  fireEvent.click(opener);
  const panel = screen.getByRole("complementary");
  nextFrame();
  nextFrame();
  fireEvent.click(
    within(panel).getByRole("button", { name: "Cerrar detalle" }),
  );
  expect(panel).toHaveAttribute("data-phase", "closing");
  expect(panel).toHaveAttribute("inert");
  fireEvent.click(screen.getByText("Abrir segunda"));
  expect(screen.getByRole("complementary")).toBe(panel);
  expect(panel).toHaveAttribute("data-phase", "open");
  act(() => vi.advanceTimersByTime(200));
  expect(within(panel).getByText(second.question)).toBeInTheDocument();
  fireEvent.click(
    within(panel).getByRole("button", { name: "Cerrar detalle" }),
  );
  const other = screen.getByText("Destino posterior");
  other.focus();
  act(() => vi.advanceTimersByTime(170));
  nextFrame();
  expect(panel).not.toBeInTheDocument();
  expect(other).toHaveFocus();
});

it("Editar ejecuta la acción y retira el panel inmediatamente; la principal tiene espacio propio", () => {
  render(<Harness />);
  fireEvent.click(screen.getByText("Abrir primera"));
  const panel = screen.getByRole("complementary");
  expect(panel.querySelector(".qe-inspector-footer .primary")).not.toBeNull();
  fireEvent.click(
    within(panel).getByRole("button", { name: "Editar pregunta" }),
  );
  expect(action).toHaveBeenCalledWith(first);
  expect(panel).not.toBeInTheDocument();
});

it("ajusta el alto disponible al teclado móvil y elimina sus listeners", () => {
  const viewport = new EventTarget();
  Object.assign(viewport, { height: 844, offsetTop: 0 });
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: viewport,
  });
  const removed = vi.spyOn(viewport, "removeEventListener");
  function Viewport() {
    const style = useInspectorViewport(false);
    return <div data-testid="viewport" style={style} />;
  }
  const { unmount } = render(<Viewport />);
  expect(screen.getByTestId("viewport")).toHaveStyle({ height: "844px" });
  Object.assign(viewport, { height: 480, offsetTop: 20 });
  act(() => viewport.dispatchEvent(new Event("resize")));
  expect(screen.getByTestId("viewport")).toHaveStyle({
    height: "480px",
    top: "20px",
  });
  unmount();
  expect(removed).toHaveBeenCalledWith("resize", expect.any(Function));
  expect(removed).toHaveBeenCalledWith("scroll", expect.any(Function));
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: undefined,
  });
});

it("la hoja móvil mantiene el foco en sus acciones y Escape vuelve al detalle", () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  render(
    <div className="qe-inspector-motion">
      <QuestionInspectorActions
        data={{ ...data, questions: [first, second] }}
        projectId="fictitious"
        question={first}
        onEdit={action}
        onAction={action}
        onCreateReference={action}
        onCreateTopic={action}
      />
    </div>,
  );
  const summary = screen.getByText("Más acciones");
  const details = summary.closest("details")!;
  details.open = true;
  fireEvent(details, new Event("toggle"));
  const sheet = screen.getByRole("dialog", { name: "Más acciones" });
  const close = within(sheet).getByRole("button", { name: "Cerrar acciones" });
  expect(close).toHaveFocus();
  const archive = within(sheet).getByRole("button", {
    name: "Archivar",
  });
  archive.focus();
  fireEvent.keyDown(archive, { key: "Tab" });
  expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: "Escape" });
  expect(details.open).toBe(false);
  expect(summary).toHaveFocus();
});
