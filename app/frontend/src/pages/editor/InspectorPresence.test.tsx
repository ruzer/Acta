import { StrictMode, useEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { useInspectorPresence } from "./useInspectorPresence";

type Question = { id: string; title: string };
const first = { id: "first", title: "Pregunta ficticia uno" };
const second = { id: "second", title: "Pregunta ficticia dos" };
const mounted = vi.fn();
const unmounted = vi.fn();
let frames: Map<number, FrameRequestCallback>;
let frameId: number;
let duration: string;
let properties: string;
let delay: string;
let motionChanged: (() => void) | undefined;

function Content({ question }: { question: Question }) {
  useEffect(() => {
    mounted();
    return unmounted;
  }, []);
  return <span>{question.title}</span>;
}

function Harness({
  question,
  animateExit = true,
}: {
  question: Question | null;
  animateExit?: boolean;
}) {
  const presence = useInspectorPresence(question, { animateExit });
  return presence.question ? (
    <aside ref={presence.elementRef} data-phase={presence.phase}>
      <Content question={presence.question} />
    </aside>
  ) : null;
}

function frame() {
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach((callback) => callback(performance.now()));
  });
}

function transition(
  element: Element,
  propertyName: string,
  type = "transitionend",
) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, "propertyName", { value: propertyName });
  fireEvent(element, event);
}

beforeEach(() => {
  vi.useFakeTimers();
  mounted.mockClear();
  unmounted.mockClear();
  frames = new Map();
  frameId = 0;
  duration = "0.12s";
  properties = "opacity, transform";
  delay = "0s";
  motionChanged = undefined;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("getComputedStyle", () => ({
    transitionDuration: duration,
    transitionProperty: properties,
    transitionDelay: delay,
  }));
  vi.stubGlobal("matchMedia", () => ({
    addEventListener: (_: string, callback: () => void) => {
      motionChanged = callback;
    },
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-presentation-keyboard");
});

it("retiene el contenido al cerrar y termina solo con la transición del panel", () => {
  const { rerender } = render(<Harness question={first} />);
  const panel = screen.getByRole("complementary");
  frame();
  frame();
  expect(panel).toHaveAttribute("data-phase", "open");
  rerender(<Harness question={null} />);
  expect(panel).toHaveAttribute("data-phase", "closing");
  expect(screen.getByText(first.title)).toBeVisible();
  transition(screen.getByText(first.title), "opacity");
  transition(panel, "color");
  expect(panel).toBeInTheDocument();
  transition(panel, "opacity");
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  expect(unmounted).toHaveBeenCalledTimes(1);
});

it("parte cerrado y una apertura después de una salida completa inicia otra entrada", () => {
  const { rerender } = render(<Harness question={null} />);
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  rerender(<Harness question={first} />);
  const initialPanel = screen.getByRole("complementary");
  expect(initialPanel).toHaveAttribute("data-phase", "entering");
  frame();
  frame();
  rerender(<Harness question={null} />);
  transition(initialPanel, "opacity");
  rerender(<Harness question={second} />);
  const newPanel = screen.getByRole("complementary");
  expect(newPanel).not.toBe(initialPanel);
  expect(newPanel).toHaveAttribute("data-phase", "entering");
  expect(screen.getByText(second.title)).toBeVisible();
});

it("cambiar pregunta durante la entrada y abierto conserva nodo, montaje y fase", () => {
  const { rerender } = render(<Harness question={first} />);
  const panel = screen.getByRole("complementary");
  rerender(<Harness question={second} />);
  expect(screen.getByRole("complementary")).toBe(panel);
  expect(panel).toHaveAttribute("data-phase", "entering");
  frame();
  frame();
  rerender(<Harness question={{ ...first, title: "Contenido actualizado" }} />);
  expect(screen.getByRole("complementary")).toBe(panel);
  expect(panel).toHaveAttribute("data-phase", "open");
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(unmounted).not.toHaveBeenCalled();
  expect(frames.size).toBe(0);
});

it("reabrir interrumpe el cierre sin desmontar ni aceptar su temporizador viejo", () => {
  const { rerender } = render(<Harness question={first} />);
  frame();
  frame();
  const panel = screen.getByRole("complementary");
  rerender(<Harness question={null} />);
  act(() => vi.advanceTimersByTime(80));
  rerender(<Harness question={second} />);
  expect(screen.getByRole("complementary")).toBe(panel);
  expect(panel).toHaveAttribute("data-phase", "open");
  transition(panel, "opacity");
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByText(second.title)).toBeVisible();
  expect(mounted).toHaveBeenCalledTimes(1);
  rerender(<Harness question={null} />);
  act(() => vi.advanceTimersByTime(169));
  expect(panel).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(panel).not.toBeInTheDocument();
});

it("cerrar antes del primer fotograma cancela la entrada pendiente", () => {
  const { rerender } = render(<Harness question={first} />);
  rerender(<Harness question={null} />);
  frame();
  frame();
  const panel = screen.getByRole("complementary");
  expect(panel).toHaveAttribute("data-phase", "closing");
  transition(panel, "opacity");
  expect(panel).not.toBeInTheDocument();
});

it.each([0, 1])(
  "un fotograma de entrada cancelado no revive el panel cerrado (fotogramas previos: %s)",
  (previousFrames) => {
    // Deliver even cancelled callbacks, as can happen to already queued work.
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { rerender } = render(<Harness question={first} />);
    if (previousFrames) frame();
    const panel = screen.getByRole("complementary");
    rerender(<Harness question={null} />);
    transition(panel, "opacity");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    frame();
    frame();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(mounted).toHaveBeenCalledTimes(1);
    rerender(<Harness question={second} />);
    const reopened = screen.getByRole("complementary");
    expect(reopened).toHaveAttribute("data-phase", "entering");
    frame();
    frame();
    expect(reopened).toHaveAttribute("data-phase", "open");
    expect(screen.getByText(second.title)).toBeVisible();
  },
);

it("una entrada cancelada no termina prematuramente la entrada de una reapertura", () => {
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const { rerender } = render(<Harness question={first} />);
  frame();
  const oldSecondFrame = [...frames.values()][0]!;
  frames.clear();
  const panel = screen.getByRole("complementary");
  rerender(<Harness question={null} />);
  transition(panel, "opacity");
  rerender(<Harness question={second} />);
  const reopened = screen.getByRole("complementary");
  act(() => oldSecondFrame(performance.now()));
  expect(reopened).toHaveAttribute("data-phase", "entering");
  frame();
  frame();
  expect(reopened).toHaveAttribute("data-phase", "open");
});

it.each(["0s", "0ms", ""])(
  "sin duración (%s) no espera un evento inexistente",
  async (value) => {
    duration = value;
    const { rerender } = render(<Harness question={first} />);
    rerender(<Harness question={null} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  },
);

it("reabrir invalida también una finalización de duración cero pendiente", async () => {
  duration = "0s";
  const { rerender } = render(<Harness question={first} />);
  const panel = screen.getByRole("complementary");
  rerender(<Harness question={null} />);
  rerender(<Harness question={second} />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByRole("complementary")).toBe(panel);
});

it("el respaldo respeta la propiedad más larga y el retraso CSS", () => {
  duration = "80ms, 0.12s";
  delay = "0s, 20ms";
  const { rerender } = render(<Harness question={first} />);
  rerender(<Harness question={null} />);
  const panel = screen.getByRole("complementary");
  transition(panel, "opacity");
  act(() => vi.advanceTimersByTime(189));
  expect(panel).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(1));
  expect(panel).not.toBeInTheDocument();
});

it("movimiento reducido conserva el fundido y finaliza si cambia durante el cierre", async () => {
  properties = "opacity";
  const { rerender } = render(<Harness question={first} />);
  rerender(<Harness question={null} />);
  const panel = screen.getByRole("complementary");
  transition(panel, "transform");
  expect(panel).toBeInTheDocument();
  duration = "0s";
  act(() => motionChanged?.());
  await act(async () => {
    await Promise.resolve();
  });
  expect(panel).not.toBeInTheDocument();
});

it("un cambio a teclado durante el cierre vuelve a consultar la duración", async () => {
  const { rerender } = render(<Harness question={first} />);
  rerender(<Harness question={null} />);
  duration = "0s";
  await act(async () => {
    document.documentElement.setAttribute("data-presentation-keyboard", "true");
    await Promise.resolve();
  });
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});

it("una transición cancelada sin evento final tiene respaldo", () => {
  const { rerender } = render(<Harness question={first} />);
  rerender(<Harness question={null} />);
  const panel = screen.getByRole("complementary");
  transition(panel, "opacity", "transitioncancel");
  act(() => vi.advanceTimersByTime(170));
  expect(panel).not.toBeInTheDocument();
});

it("una acción que abre otra ventana puede omitir la salida decorativa", () => {
  const { rerender } = render(<Harness question={first} />);
  rerender(<Harness question={null} animateExit={false} />);
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  expect(vi.getTimerCount()).toBe(0);
});

it("puede terminar inmediatamente una salida ya iniciada sin alterar el foco", () => {
  const destination = document.createElement("button");
  document.body.append(destination);
  const { rerender } = render(<Harness question={first} />);
  rerender(<Harness question={null} />);
  destination.focus();
  rerender(<Harness question={null} animateExit={false} />);
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  expect(destination).toHaveFocus();
  act(() => vi.advanceTimersByTime(1000));
  expect(destination).toHaveFocus();
  destination.remove();
});

it("StrictMode y desmontar la ruta cancelan fotogramas y temporizadores", () => {
  const { rerender, unmount } = render(
    <StrictMode>
      <Harness question={first} />
    </StrictMode>,
  );
  frame();
  frame();
  expect(screen.getByRole("complementary")).toHaveAttribute(
    "data-phase",
    "open",
  );
  rerender(
    <StrictMode>
      <Harness question={null} />
    </StrictMode>,
  );
  unmount();
  expect(frames.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
