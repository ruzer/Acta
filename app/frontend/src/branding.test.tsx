import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as apiModule from "./api";
import { BrandingProvider, Marks, formatDate } from "./branding";
import { MemoryRouter, Routes, Route, Link } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { Login } from "./pages/Access";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const branding = (overrides: Record<string, string> = {}) => ({
  appName: "Acta",
  shortName: "Acta",
  organizationName: "Fiscalía General",
  logo: "",
  logoSecondary: "",
  secondaryName: "",
  favicon: "",
  accent: "#2b4d7c",
  locale: "es-MX",
  timezone: "UTC",
  ...overrides,
});
function signIn(overrides: Record<string, string> = {}) {
  vi.spyOn(apiModule, "api").mockImplementation((async (key: string) =>
    key === "branding"
      ? branding(overrides)
      : {
          mode: "single-organization",
          institutionName: "Fiscalía General",
        }) as never);
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <BrandingProvider>
        <Login notice="" onLogin={() => {}} />
      </BrandingProvider>
    </QueryClientProvider>,
  );
  return container;
}

it("sin ningún logotipo no se reserva espacio ni se dibuja nada", () => {
  const { container } = render(<Marks logo="" logoSecondary="" />);
  expect(container).toBeEmptyDOMElement();
});

it("el logotipo principal solo no lleva separador; con el segundo, este queda después y subordinado", () => {
  const { container, rerender } = render(
    <Marks logo="/a.png" logoSecondary="" />,
  );
  expect(container.querySelectorAll("img")).toHaveLength(1);
  expect(container.querySelector(".institution-mark-divider")).toBeNull();
  rerender(<Marks logo="/a.png" logoSecondary="/b.png" name="Coordinación" />);
  const images = [...container.querySelectorAll("img")];
  expect(images.map((i) => i.getAttribute("src"))).toEqual([
    "/a.png",
    "/b.png",
  ]);
  expect(images[1]).toHaveClass("institution-mark-secondary");
  expect(images[1]).toHaveAttribute("alt", "Coordinación");
  // El principal es decorativo: el nombre de la institución va escrito al lado.
  expect(images[0]).toHaveAttribute("alt", "");
  expect(container.querySelector(".institution-mark-divider")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

it("un segundo logotipo sin principal también se muestra, sin separador", () => {
  const { container } = render(<Marks logo="" logoSecondary="/b.png" />);
  expect(container.querySelectorAll("img")).toHaveLength(1);
  expect(container.querySelector(".institution-mark-divider")).toBeNull();
});

it("el acceso sin logotipos se ve como siempre: institución y producto", async () => {
  const container = signIn();
  expect(await screen.findByText("Fiscalía General")).toBeVisible();
  expect(container.querySelector(".institution-marks")).toBeNull();
  expect(container.querySelector(".access-secondary")).toBeNull();
  expect(
    screen.getByText(/Preguntas\. Evidencia\. Decisiones\./),
  ).toBeVisible();
});

it("el acceso pone primero la identidad: marcas, institución, entidad y por último el producto", async () => {
  const container = signIn({
    logo: "/logo.png",
    logoSecondary: "/area.png",
    secondaryName: "Coordinación General de Sistemas e Informática",
  });
  await screen.findByText("Fiscalía General");
  const order = [
    ".institution-marks",
    ".access-institution",
    ".access-secondary",
    ".access-product",
  ].map((selector) => container.querySelector(selector));
  expect(order.every(Boolean)).toBe(true);
  order
    .slice(1)
    .forEach((element, i) =>
      expect(
        order[i]!.compareDocumentPosition(element!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy(),
    );
  expect(
    screen.getByText("Coordinación General de Sistemas e Informática"),
  ).toBeVisible();
  // El producto sigue reconocible y su logotipo no se repite en esa línea.
  const product = container.querySelector(".access-product")!;
  expect(product).toHaveTextContent("Acta · Preguntas. Evidencia. Decisiones.");
  expect(product.querySelector("img")).toBeNull();
  // La entidad ya está escrita: su imagen no repite el nombre para lectores de pantalla.
  expect(
    container.querySelector(".institution-mark-secondary"),
  ).toHaveAttribute("alt", "");
});

it("con solo el logotipo principal el acceso lo muestra grande y sin segunda marca", async () => {
  const container = signIn({ logo: "/logo.png" });
  await screen.findByText("Fiscalía General");
  expect(container.querySelectorAll(".institution-marks img")).toHaveLength(1);
  expect(container.querySelector(".institution-mark-secondary")).toBeNull();
});

it.each(["2026-11-17T00:41:00.000Z", "2026-11-17T13:41:00.000Z"])(
  "una fecha al final de una oración lleva un solo punto: %s",
  (date) => {
    const text = formatDate(date, true);
    expect(text).toBe(formatDate(date).replace(/\.$/, "") + ".");
    expect(text).not.toContain("..");
  },
);

it("el título sigue cuatro pantallas y conserva el nombre configurable sin mover el foco", async () => {
  vi.spyOn(apiModule, "api").mockResolvedValue(
    branding({ appName: "Acta demo" }) as never,
  );
  const user = userEvent.setup();
  const pages = ["Atención", "Cuestionario", "Revisión", "Invitaciones"];
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BrandingProvider>
        <MemoryRouter initialEntries={["/0"]}>
          <nav>
            {pages.map((name, i) => (
              <Link key={name} to={`/${i}`}>
                {name}
              </Link>
            ))}
          </nav>
          <main>
            <Routes>
              {pages.map((name, i) => (
                <Route key={name} path={`/${i}`} element={<h1>{name}</h1>} />
              ))}
            </Routes>
          </main>
        </MemoryRouter>
      </BrandingProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { name: pages[0] });
  for (const name of pages) {
    const link = screen.getByRole("link", { name });
    await user.click(link);
    await waitFor(() => expect(document.title).toBe(`${name} · Acta demo`));
    expect(link).toHaveFocus();
  }
});
