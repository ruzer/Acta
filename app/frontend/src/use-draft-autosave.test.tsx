import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useDraftAutosave } from "./use-draft-autosave";
import {
  clearDraftTexts,
  draftKey,
  draftText,
  readDraftText,
  writeDraftText,
} from "./draft-recovery";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-18T12:00:00Z"));
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const base = { changed: "a", dirty: true, enabled: true, savedAt: 0 };
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
it("espera ocho segundos sin cambios y no escribe contenido intacto", async () => {
  const save = vi.fn(async () => {});
  const { rerender } = renderHook(
    (props) => useDraftAutosave({ ...props, save }),
    { initialProps: { ...base, dirty: false } },
  );
  await advance(30000);
  expect(save).not.toHaveBeenCalled();
  rerender({ ...base, changed: "b" });
  await advance(7999);
  expect(save).not.toHaveBeenCalled();
  rerender({ ...base, changed: "c" });
  await advance(7999);
  expect(save).not.toHaveBeenCalled();
  await advance(1);
  expect(save).toHaveBeenCalledTimes(1);
});
it("diez minutos de cambios y ocultaciones no superan veinte intentos ni dos por minuto", async () => {
  const times: number[] = [];
  const save = vi.fn(async () => {
    times.push(Date.now());
  });
  const { rerender } = renderHook(
    (props) => useDraftAutosave({ ...props, save }),
    { initialProps: base },
  );
  const start = Date.now();
  for (let second = 0; second < 600; second++) {
    if (second % 12 === 0) rerender({ ...base, changed: String(second) });
    if (second % 17 === 0)
      await act(async () => {
        window.dispatchEvent(new Event("pagehide"));
      });
    await advance(1000);
  }
  expect(times.length).toBeGreaterThan(10);
  expect(times.length).toBeLessThanOrEqual(20);
  for (let minute = 0; minute < 10; minute++)
    expect(
      times.filter(
        (t) => t >= start + minute * 60000 && t < start + (minute + 1) * 60000,
      ).length,
    ).toBeLessThanOrEqual(2);
  for (let i = 1; i < times.length; i++)
    expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(30000);
});
it("serializa un guardado lento aunque cambie el texto o se oculte la página", async () => {
  let release!: () => void;
  const save = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const { rerender } = renderHook(
    (props) => useDraftAutosave({ ...props, save }),
    { initialProps: base },
  );
  await advance(8000);
  expect(save).toHaveBeenCalledTimes(1);
  rerender({ ...base, changed: "nuevo" });
  await advance(30000);
  await act(async () => {
    window.dispatchEvent(new Event("pagehide"));
  });
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () => release());
  await advance(8000);
  expect(save).toHaveBeenCalledTimes(2);
});
it("no guarda tras desactivar la sesión ni después de desmontar", async () => {
  const save = vi.fn(async () => {});
  const { rerender, unmount } = renderHook(
    (props) => useDraftAutosave({ ...props, save }),
    { initialProps: base },
  );
  rerender({ ...base, enabled: false });
  await advance(40000);
  window.dispatchEvent(new Event("pagehide"));
  expect(save).not.toHaveBeenCalled();
  rerender(base);
  unmount();
  await advance(40000);
  expect(save).not.toHaveBeenCalled();
});
it("la copia solo guarda campos de texto, separa identidades y rechaza contenido ajeno al formato", () => {
  const content = {
    answer: ["option-id"],
    comment: "Comentario propio",
    example: "Ejemplo",
    consultationRequested: true,
  };
  const key = draftKey("user-a", "project", "question");
  expect(writeDraftText(key, draftText("MULTIPLE_CHOICE", content))).toBe(true);
  expect(readDraftText(key)).toEqual({
    comment: "Comentario propio",
    example: "Ejemplo",
  });
  expect(readDraftText(draftKey("user-b", "project", "question"))).toBeNull();
  sessionStorage.setItem(
    key,
    JSON.stringify({ ...content, password: "no-permitida" }),
  );
  expect(readDraftText(key)).toBeNull();
  expect(
    writeDraftText(
      key,
      draftText("LONG_TEXT", { ...content, answer: "Texto propio" }),
    ),
  ).toBe(true);
  clearDraftTexts("user-b");
  expect(readDraftText(key)).toBeNull();
  writeDraftText(
    key,
    draftText("LONG_TEXT", { ...content, answer: "Texto propio" }),
  );
  clearDraftTexts();
  expect(sessionStorage.length).toBe(0);
});
