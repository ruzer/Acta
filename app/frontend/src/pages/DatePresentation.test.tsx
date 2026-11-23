import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import {
  historyView,
  type ResponseQuestionView,
  type ResponseView,
} from "@requirements/contracts";
import * as apiModule from "../api";
import { BrandingProvider, formatDate } from "../branding";
import { History } from "./Visibility";
import { Respond } from "./Respond";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});
const stamp = "2031-03-16T03:15:00.000Z";
const question: ResponseQuestionView = {
  id: "00000000-0000-4000-8000-000000000001",
  sectionId: "00000000-0000-4000-8000-000000000002",
  sectionTitle: "Tema ficticio",
  title: "Fecha",
  question: "¿Cuándo termina la actividad?",
  helpText: "",
  type: "DATE",
  config: null,
  options: [],
  required: true,
  position: 1,
  total: 1,
  applicability: "ENABLED",
};
function branded(path: string, element: ReactNode, timezone: string) {
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
        <RouterProvider
          router={createMemoryRouter(
            [
              { path: "/projects/:projectId/history", element },
              { path: "/projects/:projectId/respond/:id", element },
            ],
            { initialEntries: [path] },
          )}
        />
      </BrandingProvider>
    </QueryClientProvider>,
  );
}
for (const organizationZone of ["UTC", "America/Mexico_City"]) {
  it(`Bitácora usa la fecha/hora de ${organizationZone} aunque el navegador esté en ${process.env.TZ}`, async () => {
    vi.spyOn(apiModule, "exchangeRequest").mockResolvedValue(
      historyView.parse({
        items: [
          {
            id: "00000000-0000-4000-8000-000000000003",
            actorId: "00000000-0000-4000-8000-000000000004",
            actorName: "Analista ficticio",
            action: "RESPONSE_VALIDATED",
            objectType: "Question",
            objectId: question.id,
            occurredAt: stamp,
            requestId: "ficticio",
            exportType: null,
            scope: null,
            subject: null,
          },
        ],
        actors: [],
        invitationActors: 0,
        total: 1,
        page: 1,
        pageSize: 25,
      }) as never,
    );
    branded("/projects/p/history", <History />, organizationZone);
    expect(
      await screen.findByRole("cell", { name: formatDate(stamp) }),
    ).toBeVisible();
    expect(formatDate(stamp)).toBe(
      new Intl.DateTimeFormat("es-MX", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: organizationZone,
      }).format(new Date(stamp)),
    );
  });
  it(`la hora de Borrador guardado respeta ${organizationZone}, navegador ${process.env.TZ}`, async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const data: ResponseView = {
      id: "r",
      lockVersion: 1,
      revisions: [],
      nextQuestionId: null,
      reviewStatus: "NOT_REVIEWED",
      evidencePolicy: { maxBytes: 20971520, maxAttachments: 10 },
      question,
      draft: {
        id: "d",
        lockVersion: 1,
        basedOnRevisionId: null,
        updatedAt: stamp,
        answer: "2031-03-15",
        comment: "",
        example: "",
        consultationRequested: false,
        evidence: [],
      },
    };
    vi.spyOn(apiModule, "api").mockResolvedValue(data as never);
    branded(
      "/projects/p/respond/q",
      <Respond userId="persona-ficticia" />,
      organizationZone,
    );
    const expected = new Intl.DateTimeFormat("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: organizationZone,
    }).format(new Date(stamp));
    expect(
      await screen.findByText(`Borrador guardado a las ${expected}`),
    ).toBeVisible();
  });
}
