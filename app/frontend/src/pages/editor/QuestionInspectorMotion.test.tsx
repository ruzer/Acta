import { StrictMode, useState } from "react";
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
let restoreDialogMethods: (() => void) | undefined;
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
function responsiveDialogs(initialWidth: number) {
  let wide = initialWidth >= 900;
  const media = new EventTarget();
  Object.defineProperty(media, "matches", { get: () => wide });
  vi.stubGlobal("matchMedia", (query: string) =>
    query === "(min-width:900px)"
      ? media
      : {
          matches: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
  );
  const prototype = HTMLDialogElement.prototype;
  const originalShow = Object.getOwnPropertyDescriptor(prototype, "showModal");
  const originalClose = Object.getOwnPropertyDescriptor(prototype, "close");
  // jsdom does not implement the browser's top layer. Track its native lifecycle
  // calls and open state here; the real focus trap is covered in browser tests.
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  });
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  });
  Object.defineProperties(prototype, {
    showModal: { configurable: true, writable: true, value: showModal },
    close: { configurable: true, writable: true, value: close },
  });
  restoreDialogMethods = () => {
    if (originalShow)
      Object.defineProperty(prototype, "showModal", originalShow);
    else Reflect.deleteProperty(prototype, "showModal");
    if (originalClose) Object.defineProperty(prototype, "close", originalClose);
    else Reflect.deleteProperty(prototype, "close");
  };
  return {
    showModal,
    close,
    resize(width: number) {
      act(() => {
        wide = width >= 900;
        media.dispatchEvent(new Event("change"));
      });
    },
  };
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
      const transitions: Record<string, string> = {
        transitionProperty: "opacity, transform",
        transitionDuration: "120ms",
        transitionDelay: "0s",
      };
      return new Proxy(style, {
        get(target, property) {
          if (typeof property === "string" && property in transitions)
            return transitions[property];
          const value = Reflect.get(target, property, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    }
    return style;
  });
});
afterEach(() => {
  cleanup();
  restoreDialogMethods?.();
  restoreDialogMethods = undefined;
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

it("cerrar libera la modalidad móvil antes de terminar la salida visual", () => {
  const { close } = responsiveDialogs(390);
  render(<Harness />);
  const opener = screen.getByText("Abrir primera");
  opener.focus();
  fireEvent.click(opener);
  const panel = screen.getByRole("dialog", { name: "Detalle de pregunta" });
  expect(panel).toHaveAttribute("open");
  nextFrame();
  nextFrame();
  close.mockClear();
  fireEvent.click(
    within(panel).getByRole("button", { name: "Cerrar detalle" }),
  );
  expect(panel).toBeInTheDocument();
  expect(panel).toHaveAttribute("data-phase", "closing");
  expect(panel).toHaveAttribute("inert");
  expect(panel).not.toHaveAttribute("open");
  expect(close).toHaveBeenCalledTimes(1);
  const destination = screen.getByText("Destino posterior");
  destination.focus();
  nextFrame();
  expect(destination).toHaveFocus();
  act(() => vi.advanceTimersByTime(170));
  nextFrame();
  expect(panel).not.toBeInTheDocument();
  expect(destination).toHaveFocus();
});

it.each([
  [390, 1440, false],
  [1440, 390, false],
  [390, 1440, true],
  [1440, 390, true],
] as const)(
  "redimensionar de %i a %i durante el cierre no abre modal ni roba foco (StrictMode: %s)",
  (from, to, strict) => {
    const { resize, showModal } = responsiveDialogs(from);
    const { container } = render(
      strict ? (
        <StrictMode>
          <Harness />
        </StrictMode>
      ) : (
        <Harness />
      ),
    );
    const opener = screen.getByText("Abrir primera");
    opener.focus();
    fireEvent.click(opener);
    nextFrame();
    nextFrame();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));
    const destination = screen.getByText("Destino posterior");
    destination.focus();
    showModal.mockClear();
    resize(to);
    const retained = container.querySelector(".qe-inspector-motion");
    expect(retained).toBeInTheDocument();
    expect(retained).toHaveAttribute("data-phase", "closing");
    expect(retained).toHaveAttribute("inert");
    expect(container.querySelector("dialog[open]")).toBeNull();
    expect(showModal).not.toHaveBeenCalled();
    expect(destination).toHaveFocus();
    nextFrame();
    expect(destination).toHaveFocus();
    act(() => vi.advanceTimersByTime(170));
    nextFrame();
    expect(container.querySelector(".qe-inspector-motion")).toBeNull();
    expect(destination).toHaveFocus();
  },
);

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
