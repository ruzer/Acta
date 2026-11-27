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
