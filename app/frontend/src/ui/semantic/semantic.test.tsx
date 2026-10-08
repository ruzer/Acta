import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { Button } from "../index";
import {
  StatusChip,
  MetaLine,
  QuestionBand,
  StateCard,
  TabNav,
  TabPanel,
  ContributionRail,
  ContributionPane,
  EvidenceFile,
  ThreadInset,
  ComparisonTable,
  DecisionSheet,
  QueueRow,
  QuestionRow,
  SelectionBar,
  Receipt,
  Letter,
  AppShell,
  type StatusTone,
} from "./index";

afterEach(cleanup);
it.each<[StatusTone, string]>([
  ["neutral", "Sin revisar"],
  ["info", "Respondida"],
  ["warning", "Requiere aclaración"],
  ["danger", "Conflicto"],
  ["success", "Validada"],
])("estado %s conserva palabra y glifo decorativo", (tone, label) => {
  render(<StatusChip tone={tone}>{label}</StatusChip>);
  const chip = screen.getByText(label).parentElement!;
  expect(chip).toHaveClass(`ac-status-${tone}`);
  expect(chip.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
});
it("la pregunta precede a sus metadatos; el estado no introduce otra acción primaria", () => {
  render(
    <>
      <QuestionBand
        title="Criterio de entrega"
        question="¿Cómo se revisa la entrega?"
        metadata={<MetaLine items={["ADQ-01", null, "Texto largo"]} />}
      />
      <StateCard
        title="Lista para revisar"
        status={<StatusChip tone="info">Respondida</StatusChip>}
        action={<Button>Registrar decisión</Button>}
        otherActions={<Button tone="tertiary">Otras acciones</Button>}
      >
        Revisa la aportación y sus fuentes.
      </StateCard>
    </>,
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "¿Cómo se revisa la entrega?",
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(document.querySelectorAll("button.primary")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Otras acciones" })).toHaveClass(
    "tertiary",
  );
});
it("las pestañas enlazan paneles y admiten flechas, Inicio y Fin", async () => {
  const user = userEvent.setup();
  const items = [
    { value: "answers", label: "Aportaciones" },
    { value: "compare", label: "Contraste" },
    { value: "decision", label: "Decisión" },
    { value: "history", label: "Historial" },
  ];
  function Example() {
    const [value, setValue] = useState("answers");
    return (
      <>
        <TabNav
          id="review"
          label="Contenido de revisión"
          items={items}
          value={value}
          onChange={setValue}
        />
        {items.map((item) => (
          <TabPanel
            key={item.value}
            id="review"
            value={item.value}
            active={value === item.value}
          >
            {item.label}
          </TabPanel>
        ))}
      </>
    );
  }
  render(<Example />);
  await user.tab();
  expect(screen.getByRole("tab", { name: "Aportaciones" })).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Contraste" })).toHaveFocus();
  expect(screen.getByRole("tabpanel", { name: "Contraste" })).toBeVisible();
  expect(screen.getByRole("tab", { name: "Contraste" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await user.keyboard("{End}");
  expect(screen.getByRole("tab", { name: "Historial" })).toHaveFocus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Aportaciones" })).toHaveFocus();
  await user.keyboard("{ArrowLeft}{Home}");
  expect(screen.getByRole("tab", { name: "Aportaciones" })).toHaveFocus();
});
it("el riel conserva selección y mueve foco sin activar por accidente", async () => {
  const user = userEvent.setup(),
    select = vi.fn();
  render(
    <ContributionRail
      label="Aportaciones vigentes"
      selected="a"
      onSelect={select}
      items={[
        { id: "a", content: "Participante A" },
        { id: "b", content: "Participante B" },
        { id: "c", content: "Participante C" },
      ]}
    />,
  );
  expect(
    screen.getByRole("complementary", { name: "Aportaciones vigentes" }),
  ).toBeVisible();
  const first = screen.getByRole("button", { name: "Participante A" });
  expect(first).toHaveAttribute("aria-pressed", "true");
  first.focus();
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("button", { name: "Participante B" })).toHaveFocus();
  expect(select).not.toHaveBeenCalled();
  await user.keyboard("{Enter}");
  expect(select).toHaveBeenCalledWith("b");
  await user.keyboard("{End}");
  expect(screen.getByRole("button", { name: "Participante C" })).toHaveFocus();
  await user.keyboard("{Home}");
  expect(first).toHaveFocus();
});
it("la evidencia muestra nombre completo, tamaño y descarga; respeta bloqueo del llamador", async () => {
  const download = vi.fn();
  const { rerender } = render(
    <EvidenceFile
      name="Acta_de_recepción_documental.pdf"
      size="214 KB"
      onDownload={download}
    />,
  );
  expect(screen.getByText("Acta_de_recepción_documental.pdf")).toBeVisible();
  expect(screen.getByText("214 KB")).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", {
      name: "Descargar Acta_de_recepción_documental.pdf",
    }),
  );
  expect(download).toHaveBeenCalledOnce();
  rerender(
    <EvidenceFile
      name="Acta_de_recepción_documental.pdf"
      size="214 KB"
      onDownload={download}
      disabled
      description="Archivo todavía no disponible"
    />,
  );
  const button = screen.getByRole("button", {
    name: "Descargar Acta_de_recepción_documental.pdf",
  });
  expect(button).toBeDisabled();
  expect(button).toHaveAccessibleDescription("Archivo todavía no disponible");
});
it("la comparación tiene campos únicos y encabezados explícitos", () => {
  render(
    <ComparisonTable
      caption="Contraste de aportaciones"
      columns={["Postura A", "Postura B"]}
      rows={[
        { id: "answer", label: "Respuesta", values: ["Primera", "Segunda"] },
        {
          id: "comment",
          label: "Comentario",
          values: ["Contexto A", "Contexto B"],
        },
      ]}
    />,
  );
  const table = screen.getByRole("table", {
    name: "Contraste de aportaciones",
  });
  expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
  expect(
    within(table).getByRole("rowheader", { name: "Respuesta" }),
  ).toHaveAttribute("scope", "row");
  expect(within(table).getAllByText("Respuesta")).toHaveLength(1);
});
it("contenedores documentales y de soporte conservan contenido y nombres semánticos", () => {
  render(
    <>
      <ContributionPane
        title="Aportación vigente"
        metadata={<MetaLine items={["Envío 2"]} />}
      >
        <p>Respuesta completa</p>
        <ThreadInset title="Aclaración">
          <p>Intercambio conservado</p>
        </ThreadInset>
      </ContributionPane>
      <DecisionSheet title="Decisión vigente" footer="Fuentes conservadas">
        <p>Resultado</p>
      </DecisionSheet>
      <Receipt title="Respuesta enviada">Envío registrado</Receipt>
      <Letter organization="Organización de ejemplo">
        Invitación ficticia
      </Letter>
      <SelectionBar summary="4 preguntas seleccionadas">
        <Button tone="secondary">Asignar área</Button>
      </SelectionBar>
    </>,
  );
  expect(
    screen.getByRole("article", { name: "Aportación vigente" }),
  ).toHaveTextContent("Respuesta completa");
  expect(screen.getByRole("region", { name: "Aclaración" })).toHaveTextContent(
    "Intercambio conservado",
  );
  expect(
    screen.getByRole("article", { name: "Decisión vigente" }),
  ).toHaveTextContent("Fuentes conservadas");
  expect(
    screen.getByRole("region", { name: "Respuesta enviada" }),
  ).toBeVisible();
  expect(
    screen.getByRole("article", { name: "Organización de ejemplo" }),
  ).toBeVisible();
  expect(screen.getByRole("status")).toHaveTextContent(
    "4 preguntas seleccionadas",
  );
});
it("shell y filas no duplican landmarks ni cambian navegación del llamador", () => {
  render(
    <AppShell
      navigation={<nav aria-label="Proyecto">Navegación</nav>}
      context="Atención"
      mobileNavigation={<nav aria-label="Proyecto móvil">Navegación móvil</nav>}
    >
      <main aria-label="Contenido">
        <h1>Atención</h1>
        <ul>
          <QueueRow action={<a href="/review">Abrir revisión</a>}>
            Pregunta accionable
          </QueueRow>
        </ul>
        <table>
          <caption>Cuestionario</caption>
          <tbody>
            <QuestionRow>
              <td>Pregunta conservada</td>
            </QuestionRow>
          </tbody>
        </table>
      </main>
    </AppShell>,
  );
  expect(screen.getAllByRole("main")).toHaveLength(1);
  expect(screen.getByRole("navigation", { name: "Proyecto" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Abrir revisión" })).toHaveAttribute(
    "href",
    "/review",
  );
  expect(
    screen.getByRole("cell", { name: "Pregunta conservada" }),
  ).toBeVisible();
});
