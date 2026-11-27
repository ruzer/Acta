import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { InspectorFrame } from "./InspectorFrame";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function setup() {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Abrir</button>
        <button>Otro destino</button>
        {open && (
          <InspectorFrame onClose={() => setOpen(false)}>
            <button>Acción del panel</button>
          </InspectorFrame>
        )}
      </>
    );
  }
  render(<Harness />);
  const trigger = screen.getByText("Abrir");
  trigger.focus();
  fireEvent.click(trigger);
  return { frames, trigger };
}
it.each([false, true])(
  "foco inicial en encabezado; Esc cierra y no roba foco nuevo: %s",
  (moved) => {
    const { frames, trigger } = setup();
    expect(
      screen.getByRole("heading", { name: "Detalle de pregunta" }),
    ).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    const other = screen.getByText("Otro destino");
    if (moved) other.focus();
    frames.forEach((callback) => callback(performance.now()));
    expect(moved ? other : trigger).toHaveFocus();
  },
);
it("Escape en otra ventana no cierra el inspector y el panel no confina foco", () => {
  setup();
  const other = screen.getByText("Otro destino");
  other.focus();
  expect(other).toHaveFocus();
  const dialog = document.createElement("dialog");
  dialog.setAttribute("open", "");
  document.body.append(dialog);
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.getByRole("complementary")).toBeInTheDocument();
  dialog.remove();
});

it("cerrar tras cambiar de página recupera el nuevo nodo de la pregunta de origen", () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  function Harness() {
    const [open, setOpen] = useState(false);
    const [page, setPage] = useState(1);
    return (
      <>
        <div className="qe-modes">
          <button aria-selected="true">Organizar</button>
        </div>
        <button
          key={page}
          data-question-opener={page === 1 ? "origin" : "next"}
          onClick={() => setOpen(true)}
        >
          {page === 1 ? "Pregunta de origen" : "Pregunta siguiente"}
        </button>
        {open && (
          <InspectorFrame
            questionId={page === 1 ? "origin" : "next"}
            onClose={() => {
              setPage(1);
              setOpen(false);
            }}
          >
            <button onClick={() => setPage(2)}>Recorrer a página dos</button>
          </InspectorFrame>
        )}
      </>
    );
  }
  render(<Harness />);
  const original = screen.getByRole("button", { name: "Pregunta de origen" });
  original.focus();
  fireEvent.click(original);
  fireEvent.click(
    screen.getByRole("button", { name: "Recorrer a página dos" }),
  );
  expect(original).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Pregunta siguiente" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));
  const restored = screen.getByRole("button", { name: "Pregunta de origen" });
  expect(restored).not.toBe(original);
  frames.forEach((callback) => callback(performance.now()));
  expect(restored).toHaveFocus();
});

it("reinicia la lectura al cambiar de pregunta sin remontar el panel ni su cuerpo", () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  const close = vi.fn();
  const view = render(
    <InspectorFrame questionId="first" onClose={close}>
      <p>Primera pregunta extensa</p>
    </InspectorFrame>,
  );
  const panel = screen.getByRole("complementary");
  const body = panel.querySelector<HTMLElement>(".qe-inspector-body")!;
  body.scrollTop = 100;
  view.rerender(
    <InspectorFrame questionId="first" onClose={close}>
      <p>Primera pregunta actualizada</p>
    </InspectorFrame>,
  );
  expect(body.scrollTop).toBe(100);
  view.rerender(
    <InspectorFrame questionId="next" onClose={close}>
      <p>Siguiente pregunta</p>
    </InspectorFrame>,
  );
  expect(screen.getByRole("complementary")).toBe(panel);
  expect(panel.querySelector(".qe-inspector-body")).toBe(body);
  expect(body.scrollTop).toBe(0);
});
