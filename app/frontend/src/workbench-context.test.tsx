import { useLayoutEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { useWorkbenchContext } from "./workbench-context";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("un scroll causado por la nueva ruta no sobrescribe la posición de la lista anterior", async () => {
  const client = new QueryClient();
  const frames: FrameRequestCallback[] = [];
  let y = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(window, "scrollY", "get").mockImplementation(() => y);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  function List() {
    useWorkbenchContext("project-a", "questionnaire");
    return <h1>Cuestionario</h1>;
  }
  function Frame() {
    const location = useLocation();
    // Changing routes can collapse the document and emit scroll before passive
    // effects clean up. Model that browser event at the actual routing boundary.
    useLayoutEffect(() => {
      y = 0;
      fireEvent.scroll(window);
    }, [location.pathname]);
    return location.pathname.endsWith("/editor") ? <List /> : <h1>Detalle</h1>;
  }
  const router = createMemoryRouter([{ path: "*", element: <Frame /> }], {
    initialEntries: ["/projects/project-a/editor"],
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await act(() => {
    for (let i = 0; i < 2; i++) frames.shift()?.(0);
  });
  await act(() => {
    y = 900;
    fireEvent.scroll(window);
  });
  expect(
    client.getQueryData(["workbench-context", "project-a", "questionnaire"]),
  ).toMatchObject({ scroll: 900 });
  await act(() => router.navigate("/projects/project-a/review/question-a"));
  expect(
    client.getQueryData(["workbench-context", "project-a", "questionnaire"]),
  ).toMatchObject({ scroll: 900 });
});
