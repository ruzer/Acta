import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, useMemo, useRef } from "react";
import { progressLayers, progressRatio, useBarMotion } from "./useBarMotion";
import {
  usePresentationSession,
  presentationKey,
  readPresentationSnapshot,
  writePresentationSnapshot,
} from "../session-presentation";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each([
  [0, 0, 0],
  [9, 0, 0],
  [-2, 10, 0],
  [12, 10, 1],
  [3, 4, 0.75],
  [Infinity, 10, 0],
])("limita %s/%s sin NaN", (value, total, expected) => {
  expect(progressRatio(value!, total!)).toBe(expected);
});
it.each([238, 308, 630])(
  "conserva segmentos y separación de dos píxeles con ancho %s",
  (width) => {
    const layers = progressLayers(1, 1, 4, width);
    expect(layers.sent * width).toBeCloseTo(width / 4);
    expect(layers.gap).toBeCloseTo(width / 4);
    expect(layers.drafts * width - layers.gap - 2).toBeCloseTo(width / 4);
    const full = progressLayers(2, 2, 4, width);
    expect(full.sent * width).toBeCloseTo((width - 2) / 2);
    expect(full.drafts).toBe(1);
  },
);
it("memoria compartida con F3: versión inválida, contenido dañado o almacenamiento bloqueado no impiden mostrar la barra", () => {
  const key = presentationKey("u", "p", "position");
  for (const value of [
    "{",
    '{"version":2,"values":{}}',
    '{"version":1,"values":{"x":{"value":-1,"total":4}}}',
  ]) {
    sessionStorage.setItem(key, value);
    expect(readPresentationSnapshot(key)).toBeNull();
  }
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("denegado");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("denegado");
  });
  expect(readPresentationSnapshot(key)).toBeNull();
  expect(() =>
    writePresentationSnapshot(key, { position: { value: 1, total: 4 } }),
  ).not.toThrow();
});

it("StrictMode: sesión por cuenta/proyecto, primera carga quieta, un cambio y ningún replay", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    frames.set(++id, fn);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const animate = vi.fn(() => ({
    cancel: vi.fn(),
    finished: Promise.resolve(),
  }));
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  function Example({ value, account }: { value: number; account: string }) {
    usePresentationSession(account, false, false);
    const root = useRef<HTMLDivElement>(null);
    const snapshot = useMemo(
      () => ({ position: { value, total: 4 } }),
      [value],
    );
    useBarMotion(root, { projectId: "p", bar: "position" }, snapshot);
    return (
      <div
        ref={root}
        style={
          {
            "--ac-ease-out": "cubic-bezier(0.22,1,0.36,1)",
          } as React.CSSProperties
        }
      >
        <span data-testid="fill" data-bar-part="position" />
      </div>
    );
  }
  const flush = () =>
    act(() => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((fn) => fn(0));
    });
  const view = render(
    <StrictMode>
      <Example value={1} account="one" />
    </StrictMode>,
  );
  flush();
  expect(animate).not.toHaveBeenCalled();
  expect(
    readPresentationSnapshot(presentationKey("one", "p", "position"))?.position
      ?.value,
  ).toBe(1);
  view.rerender(
    <StrictMode>
      <Example value={2} account="one" />
    </StrictMode>,
  );
  flush();
  expect(animate).toHaveBeenCalledTimes(1);
  expect(animate).toHaveBeenLastCalledWith(
    [{ transform: "scaleX(0.25)" }, { transform: "scaleX(0.5)" }],
    expect.objectContaining({ duration: 280 }),
  );
  expect(screen.getByTestId("fill").style.transform).toBe("scaleX(0.5)");
  view.rerender(
    <StrictMode>
      <Example value={2} account="one" />
    </StrictMode>,
  );
  flush();
  expect(animate).toHaveBeenCalledTimes(1);
  view.rerender(
    <StrictMode>
      <Example value={3} account="two" />
    </StrictMode>,
  );
  flush();
  expect(animate).toHaveBeenCalledTimes(1);
});
