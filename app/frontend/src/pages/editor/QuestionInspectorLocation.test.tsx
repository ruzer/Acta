import { StrictMode } from "react";
import { afterEach, expect, it } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { questionnaireView } from "@requirements/contracts";
import fixture from "../../../../../tests/fixtures/analyst-visual.json";
import { useQuestionInspectorLocation } from "./use-question-inspector-location";
const data = questionnaireView.parse(fixture.questionnaire);
const first = data.questions[0]!;
const second = { ...first, id: "second" };
afterEach(cleanup);
function Harness() {
  const inspector = useQuestionInspectorLocation([first, second]);
  return (
    <>
      <button onClick={() => inspector.open(first.id)}>Abrir primera</button>
      <button onClick={() => inspector.open(second.id)}>Abrir segunda</button>
      {inspector.question && (
        <>
          <p role="status">{inspector.question.id}</p>
          <button onClick={inspector.close}>Cerrar</button>
        </>
      )}
      {inspector.notice && <p role="alert">{inspector.notice}</p>}
    </>
  );
}
function setup(search = "") {
  const router = createMemoryRouter(
    [
      { path: "/editor", element: <Harness /> },
      { path: "/previous", element: <p>Página anterior</p> },
    ],
    { initialEntries: ["/previous", "/editor" + search] },
  );
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  return router;
}
it("abrir añade historial; pasar de pregunta reemplaza y Atrás cierra", async () => {
  const router = setup("?q=consulta&mode=write&custom=keep");
  fireEvent.click(screen.getByText("Abrir primera"));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(first.id),
  );
  expect(router.state.historyAction).toBe("PUSH");
  fireEvent.click(screen.getByText("Abrir segunda"));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(second.id),
  );
  expect(router.state.historyAction).toBe("REPLACE");
  expect(router.state.location.search).toContain("custom=keep");
  await act(() => router.navigate(-1));
  expect(router.state.location.pathname).toBe("/editor");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await act(() => router.navigate(1));
  expect(screen.getByRole("status")).toHaveTextContent(second.id);
});
it("enlace directo crea una única entrada base incluso en StrictMode; Atrás no abandona editor", async () => {
  const router = setup(`?mode=organize&question=${first.id}`);
  await waitFor(() => expect(router.state.historyAction).toBe("PUSH"));
  expect(screen.getByRole("status")).toHaveTextContent(first.id);
  await act(() => router.navigate(-1));
  expect(router.state.location.pathname).toBe("/editor");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await act(() => router.navigate(-1));
  expect(screen.getByText("Página anterior")).toBeVisible();
});
it("cerrar enlace directo conserva el editor y un id inexistente avisa sin panel", async () => {
  const router = setup(`?question=${first.id}&q=consulta`);
  await waitFor(() => expect(router.state.historyAction).toBe("PUSH"));
  fireEvent.click(screen.getByText("Cerrar"));
  await waitFor(() =>
    expect(screen.queryByRole("status")).not.toBeInTheDocument(),
  );
  expect(router.state.location.pathname).toBe("/editor");
  expect(router.state.location.search).toContain("q=consulta");
  await act(() => router.navigate("?question=missing&q=consulta"));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "La pregunta del enlace no está disponible",
    ),
  );
  expect(router.state.location.search).toBe("?q=consulta");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
