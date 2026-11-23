import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { StrictMode } from "react";
import {
  presentationKey,
  presentationUsesKeyboard,
  usePresentationModality,
  usePresentationSession,
} from "./session-presentation";

function SessionProbe({
  userId,
  loading = false,
  expired = false,
}: {
  userId?: string;
  loading?: boolean;
  expired?: boolean;
}) {
  usePresentationModality();
  usePresentationSession(userId, loading, expired);
  return null;
}
const key = presentationKey("analyst", "project", "progress");
function saved() {
  sessionStorage.setItem(key, "cifras ficticias");
  sessionStorage.setItem("unrelated-setting", "conservar");
}
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

it("conserva la última visita al resolver la misma sesión en una recarga", () => {
  saved();
  const view = render(
    <StrictMode>
      <SessionProbe loading />
    </StrictMode>,
  );
  expect(sessionStorage.getItem(key)).toBe("cifras ficticias");
  view.rerender(
    <StrictMode>
      <SessionProbe userId="analyst" />
    </StrictMode>,
  );
  expect(sessionStorage.getItem(key)).toBe("cifras ficticias");
});

it("el resultado inicial sin sesión retira la presentación sin borrar otras claves", () => {
  saved();
  const view = render(<SessionProbe loading />);
  view.rerender(<SessionProbe />);
  expect(sessionStorage.getItem(key)).toBeNull();
  expect(sessionStorage.getItem("unrelated-setting")).toBe("conservar");
});

it("cerrar sesión, expirar y cambiar de cuenta retiran la presentación", () => {
  const view = render(<SessionProbe userId="analyst" />);
  saved();
  view.rerender(<SessionProbe userId="analyst" expired />);
  expect(sessionStorage.getItem(key)).toBeNull();
  view.rerender(<SessionProbe userId="analyst" />);
  saved();
  view.rerender(<SessionProbe userId="another-analyst" />);
  expect(sessionStorage.getItem(key)).toBeNull();
  saved();
  view.rerender(<SessionProbe />);
  expect(sessionStorage.getItem(key)).toBeNull();
});

it("el inicio de sesión posterior a la pantalla de acceso empieza sin cifras anteriores", () => {
  const view = render(<SessionProbe />);
  saved();
  view.rerender(<SessionProbe userId="analyst" />);
  expect(sessionStorage.getItem(key)).toBeNull();
});

it("la modalidad sobrevive a cambios de página y retira listeners al desmontar Session", () => {
  const view = render(<SessionProbe userId="analyst" />);
  fireEvent.keyDown(window, { key: "Enter" });
  expect(presentationUsesKeyboard()).toBe(true);
  view.rerender(<SessionProbe userId="analyst" />);
  expect(presentationUsesKeyboard()).toBe(true);
  fireEvent.pointerDown(window);
  expect(presentationUsesKeyboard()).toBe(false);
  view.unmount();
  fireEvent.keyDown(window, { key: "Tab" });
  expect(presentationUsesKeyboard()).toBe(false);
});
