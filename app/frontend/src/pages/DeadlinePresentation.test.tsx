import type { ReactNode } from "react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import {
  endOfResponseDay,
  type Me,
  type ParticipationView,
} from "@requirements/contracts";
import * as apiModule from "../api";
import { BrandingProvider } from "../branding";
import { responseDueLabel, timezoneLabel } from "../response-deadline-display";
import { Administration } from "./Administration";
import { ResponseDeadline } from "./ResponseDeadline";
import { participationReminder } from "./Participation";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const data: ParticipationView = {
  projectName: "Proyecto ficticio",
  role: "ANALYST",
  responseDueAt: null,
  participants: [],
};
function mount(children: ReactNode, timezone: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["public-branding"], {
    appName: "Acta",
    shortName: "Acta",
    organizationName: "Organización ficticia",
    logo: "",
    logoSecondary: "",
    secondaryName: "",
    favicon: "",
    accent: "#2b4d7c",
    locale: "es-MX",
    timezone,
  });
  render(
    <QueryClientProvider client={client}>
      <BrandingProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </BrandingProvider>
    </QueryClientProvider>,
  );
}
for (const [timezone, zoneName] of [
  ["America/Mexico_City", "hora de Ciudad de México"],
  ["UTC", "hora universal (UTC)"],
] as const) {
  it(`el plazo y el recordatorio comparten fecha de calendario y ${zoneName}`, async () => {
    const due = endOfResponseDay("2031-03-15", timezone);
    vi.spyOn(apiModule, "exchangeRequest").mockResolvedValue({
      responseDueAt: due,
      lockVersion: 0,
    } as never);
    mount(<ResponseDeadline projectId="p" />, timezone);
    const label = `15/03/2031 · ${zoneName}`;
    expect(
      await screen.findByText((text) => text.includes(label)),
    ).toBeVisible();
    expect(
      participationReminder(
        { ...data, responseDueAt: due },
        "https://example.test",
        timezone,
      ),
    ).toContain(label);
  });
  it(`Administración explica el final del día con ${zoneName} y conserva el día enviado`, async () => {
    const due = endOfResponseDay("2031-03-15", timezone);
    vi.spyOn(apiModule, "api").mockImplementation((async (key: string) =>
      key === "organizationProjects"
        ? [
            {
              id: "p",
              name: "Proyecto ficticio",
              externalId: "P",
              lifecycle: "ACTIVE",
              myRole: "ADMIN",
              admins: [],
              adminCount: 0,
              memberCount: 1,
            },
          ]
        : []) as never);
    vi.spyOn(apiModule, "exchangeRequest").mockResolvedValue({
      responseDueAt: due,
      lockVersion: 0,
    } as never);
    mount(
      <Administration
        me={
          {
            user: { isOrganizationAdmin: true },
            organization: { name: "Organización ficticia" },
          } as Me
        }
      />,
      timezone,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Proyectos" }));
    await user.click(
      await screen.findByRole("button", {
        name: "Fecha límite de Proyecto ficticio",
      }),
    );
    const input = await screen.findByLabelText(
      "Fecha límite para responder (opcional)",
    );
    expect(input).toHaveValue("2031-03-15");
    expect(input).toHaveAccessibleDescription(
      `Hasta el final del día, ${zoneName}. Solo es un aviso; no impide responder. Deja vacío para quitar la fecha.`,
    );
    await user.click(
      screen.getByRole("button", { name: "Guardar fecha límite" }),
    );
    expect(
      vi
        .mocked(apiModule.exchangeRequest)
        .mock.calls.filter((call) => call[3]?.input),
    ).toEqual([
      [
        "p",
        "response-deadline",
        expect.anything(),
        { input: { responseDueDate: "2031-03-15", expectedVersion: 0 } },
      ],
    ]);
  });
}
it.each([
  ["2031-03-12T18:00:00Z", "Vence en 3 días"],
  ["2031-03-15T18:00:00Z", "Vence hoy"],
  ["2031-03-16T06:00:00Z", "Venció el"],
  ["2031-03-01T18:00:00Z", "Vence el"],
])("conserva el cálculo del plazo para %s", (now, expected) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(now));
  const reminder = participationReminder(
    {
      ...data,
      responseDueAt: endOfResponseDay("2031-03-15", "America/Mexico_City"),
    },
    "https://example.test",
    "America/Mexico_City",
  );
  expect(reminder).toContain(expected);
  expect(reminder).toContain("15/03/2031 · hora de Ciudad de México");
});

it("sin plazo no agrega fecha ni zona", () => {
  expect(responseDueLabel(null, "America/Mexico_City")).toBe("");
  expect(responseDueLabel(undefined, "UTC")).toBe("");
});
it.each(["Europe/Paris", "America/New_York", "Asia/Tokyo"])(
  "la zona %s se lee con un nombre en español y no como identificador IANA",
  (timezone) => {
    expect(timezoneLabel(timezone)).not.toMatch(/[/_]/);
    expect(timezoneLabel(timezone)).toMatch(/hora|tiempo/i);
  },
);
it("reconoce los alias válidos de la zona mexicana y UTC", () => {
  expect(timezoneLabel("Mexico/General")).toBe("hora de Ciudad de México");
  expect(timezoneLabel("Etc/UTC")).toBe("hora universal (UTC)");
});
