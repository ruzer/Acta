import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom/vitest";
import { RouteFocus } from "./App";

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function waitingRoute() {
  const view = render(
    <MemoryRouter>
      <main>
        <button>Control disponible</button>
        <RouteFocus />
      </main>
    </MemoryRouter>,
  );
  const main = screen.getByRole("main");
  return { ...view, main };
}
async function addHeading(main: HTMLElement) {
  const heading = document.createElement("h1");
  heading.textContent = "Título recibido";
  await act(async () => {
    main.append(heading);
  });
  return heading;
}

it("no roba el foco de un control cuando aparece el título", async () => {
  const { main } = waitingRoute();
  const control = screen.getByRole("button");
  control.focus();
  await addHeading(main);
  expect(control).toHaveFocus();
  expect(window.scrollTo).not.toHaveBeenCalled();
});

it("deja de observar en cuanto detecta navegación dentro de main, incluso sin título", async () => {
  const { main } = waitingRoute();
  const control = screen.getByRole("button");
  control.focus();
  await act(async () => {
    main.append(document.createElement("p"));
  });
  control.blur();
  expect(await addHeading(main)).not.toHaveFocus();
});

it.each([4999, 5000])(
  "limita la espera del título a cinco segundos (%i ms)",
  async (elapsed) => {
    const { main } = waitingRoute();
    await act(async () => {
      vi.advanceTimersByTime(elapsed);
    });
    const heading = await addHeading(main);
    if (elapsed < 5000) expect(heading).toHaveFocus();
    else expect(heading).not.toHaveFocus();
  },
);

it("limpia la espera al desmontar la ruta", () => {
  const schedule = vi.spyOn(window, "setTimeout");
  const cancel = vi.spyOn(window, "clearTimeout");
  const { unmount } = waitingRoute();
  const index = schedule.mock.calls.findIndex(([, delay]) => delay === 5000);
  expect(index).toBeGreaterThanOrEqual(0);
  const timeout = schedule.mock.results[index]!.value;
  unmount();
  expect(cancel).toHaveBeenCalledWith(timeout);
});
