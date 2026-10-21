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
  ThreadMessage,
  Timeline,
  ProgressCard,
  Callout,
  NextSteps,
  FactGrid,
  RegisterRow,
  ComparisonTable,
  DecisionSheet,
  QueueRow,
  QuestionRow,
  SelectionBar,
  Receipt,
  Letter,
  AppShell,
  ActionMenu,
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
      columns={[
        { key: "Postura A", head: "Postura A", label: "Postura A · Lucía" },
        { key: "Postura B", head: "Postura B" },
      ]}
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
  // The columns carry their own names; each value knows its column for the stacked phone layout.
  expect(
    within(table).getByRole("columnheader", { name: "Postura A · Lucía" }),
  ).toBeVisible();
  expect(within(table).getByText("Segunda")).toHaveAttribute(
    "data-column",
    "Postura B",
  );
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
          <li>Intercambio conservado</li>
        </ThreadInset>
      </ContributionPane>
      <DecisionSheet
        label="Decisión vigente"
        kicker="Decisión validada"
        footer="Fuentes conservadas"
      >
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

// ---- UX-07: accessible "Más acciones" menu ---------------------------------
function Menu({ onSelect }: { onSelect: (value: string) => void }) {
  return (
    <>
      <button type="button">Fuera del menú</button>
      <ActionMenu
        label="Más acciones"
        items={[
          { value: "clarify", label: "Solicitar aclaración" },
          { value: "pending", label: "Marcar pendiente" },
        ]}
        onSelect={onSelect}
      />
    </>
  );
}
it("UX-07: el menú es un botón real que abre una lista de botones con objetivo táctil de 44 px", async () => {
  const user = userEvent.setup();
  render(<Menu onSelect={vi.fn()} />);
  const trigger = screen.getByText("Más acciones");
  expect(trigger.closest("details")).not.toHaveAttribute("open");
  expect(
    screen.getByRole("button", { name: "Solicitar aclaración" }),
  ).not.toBeVisible();
  await user.click(trigger);
  expect(trigger.closest("details")).toHaveAttribute("open");
  expect(
    screen.getAllByRole("button", { name: /Solicitar|Marcar/ }),
  ).toHaveLength(2);
});
it("UX-07: elegir una acción la entrega, cierra el menú y deja el foco en el disparador", async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(<Menu onSelect={onSelect} />);
  await user.click(screen.getByText("Más acciones"));
  await user.click(screen.getByRole("button", { name: "Marcar pendiente" }));
  expect(onSelect).toHaveBeenCalledWith("pending");
  expect(
    screen.getByText("Más acciones").closest("details"),
  ).not.toHaveAttribute("open");
  expect(screen.getByText("Más acciones")).toHaveFocus();
});
it("UX-07: Escape cierra el menú, devuelve el foco al disparador y no propaga", async () => {
  const outer = vi.fn();
  const user = userEvent.setup();
  render(
    <div onKeyDown={(event) => event.key === "Escape" && outer()}>
      <Menu onSelect={vi.fn()} />
    </div>,
  );
  const trigger = screen.getByText("Más acciones");
  await user.click(trigger);
  screen.getByRole("button", { name: "Marcar pendiente" }).focus();
  await user.keyboard("{Escape}");
  expect(trigger.closest("details")).not.toHaveAttribute("open");
  expect(trigger).toHaveFocus();
  expect(outer).not.toHaveBeenCalled();
});
it("UX-07: se maneja solo con teclado (Enter abre, Tab recorre, Enter elige) y un clic fuera lo cierra", async () => {
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(<Menu onSelect={onSelect} />);
  await user.tab(); // "Fuera del menú"
  await user.tab(); // trigger
  expect(screen.getByText("Más acciones")).toHaveFocus();
  await user.keyboard("{Enter}");
  await user.tab();
  expect(
    screen.getByRole("button", { name: "Solicitar aclaración" }),
  ).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(onSelect).toHaveBeenCalledWith("clarify");
  await user.click(screen.getByText("Más acciones"));
  await user.click(screen.getByRole("button", { name: "Fuera del menú" }));
  expect(
    screen.getByText("Más acciones").closest("details"),
  ).not.toHaveAttribute("open");
});
it("UX-06: un indicador de pestaña es decorativo y no cambia el nombre accesible; su descripción se anuncia aparte", () => {
  render(
    <TabNav
      id="t"
      label="Pestañas"
      value="a"
      onChange={() => undefined}
      items={[
        { value: "a", label: "Aportaciones (3)" },
        {
          value: "b",
          label: "Contraste",
          indicator: <span data-testid="flag" />,
          description: "Conflicto abierto",
        },
      ]}
    />,
  );
  const tab = screen.getByRole("tab", { name: "Contraste" });
  expect(tab).toHaveAttribute("aria-description", "Conflicto abierto");
  expect(within(tab).getByTestId("flag")).toBeInTheDocument();
  expect(
    screen.getByRole("tab", { name: "Aportaciones (3)" }),
  ).not.toHaveAttribute("aria-description");
});

it("un hilo distingue quién pregunta y quién responde con palabras y muestra el turno", () => {
  render(
    <ThreadInset
      title="Aclaración · envío #1"
      status={<span>Lista para revisar</span>}
      turn="Te toca a ti: cierra la aclaración o pregunta de nuevo."
      actions={<button type="button">Cerrar aclaración</button>}
    >
      <ThreadMessage
        from="asks"
        author="Elena Rangel"
        date="26 sep 2026"
        dateTime="2026-09-26T11:00:00.000Z"
      >
        ¿Aplica a bienes de importación?
      </ThreadMessage>
      <ThreadMessage from="answers" author="Paula Quintana" date="27 sep 2026">
        Sí, aplica.
      </ThreadMessage>
    </ThreadInset>,
  );
  const region = screen.getByRole("region", { name: "Aclaración · envío #1" });
  const messages = within(region).getAllByRole("listitem");
  expect(messages).toHaveLength(2);
  expect(within(messages[0]!).getByText("Pregunta")).toBeVisible();
  expect(within(messages[1]!).getByText("Respuesta")).toBeVisible();
  expect(within(region).getByText(/Te toca a ti/)).toBeVisible();
  expect(
    within(region).getByRole("button", { name: "Cerrar aclaración" }),
  ).toBeVisible();
});
it("la cronología es una lista ordenada con actor, texto y fecha", () => {
  render(
    <Timeline
      label="Cronología de la pregunta"
      events={[
        {
          id: "1",
          icon: "send",
          actor: "Mateo Ibarra",
          text: "envió su aportación.",
          date: "22 sep 2026",
          dateTime: "2026-09-22T10:15:00.000Z",
        },
        {
          id: "2",
          icon: "flag",
          tone: "danger",
          actor: "Elena Rangel",
          text: "registró un conflicto entre aportaciones.",
          date: "27 sep 2026",
          dateTime: "2026-09-27T12:00:00.000Z",
        },
      ]}
    />,
  );
  const list = screen.getByRole("list", { name: "Cronología de la pregunta" });
  const items = within(list).getAllByRole("listitem");
  expect(items).toHaveLength(2);
  expect(items[0]).toHaveTextContent("Mateo Ibarra envió su aportación.");
  expect(within(items[1]!).getByText("27 sep 2026")).toHaveAttribute(
    "datetime",
    "2026-09-27T12:00:00.000Z",
  );
});
it("la hoja de decisión nombra el registro y deja el pie para identificadores", () => {
  render(
    <DecisionSheet
      label="Decisión vigente"
      kicker="Decisión validada"
      header={<span>Vigente</span>}
      footer={<p>Referencia del registro: abc</p>}
    >
      <p>Se decide algo</p>
    </DecisionSheet>,
  );
  const sheet = screen.getByRole("article", { name: "Decisión vigente" });
  expect(
    within(sheet).getByRole("heading", { name: "Decisión validada" }),
  ).toBeVisible();
  const foot = sheet.querySelector("footer")!;
  expect(foot).toHaveTextContent("Referencia del registro: abc");
  // The identifier is below the result, never above it.
  expect(
    sheet.textContent!.indexOf("Se decide algo") <
      sheet.textContent!.indexOf("Referencia del registro"),
  ).toBe(true);
});

it("el avance se dice con palabras y la barra lo repite con su nombre; los borradores no cuentan como enviados", () => {
  render(
    <ProgressCard sent={3} total={8} drafts={1}>
      Guardar solo conserva un borrador.
    </ProgressCard>,
  );
  expect(screen.getByText("3")).toBeVisible();
  expect(screen.getByText(/de 8 preguntas enviadas/)).toBeVisible();
  expect(
    screen.getByRole("img", {
      name: "3 de 8 preguntas enviadas; 1 en borrador",
    }),
  ).toBeVisible();
  expect(screen.getByText("Guardar solo conserva un borrador.")).toBeVisible();
});
it("la tarjeta de atención es un solo enlace a donde se atiende", () => {
  render(
    <Callout
      title="Una aclaración espera tu respuesta"
      action={
        <a href="/aclaracion" aria-label="Responder aclaración">
          →
        </a>
      }
    >
      ¿Quién autoriza?
    </Callout>,
  );
  expect(
    screen.getByRole("link", { name: "Responder aclaración" }),
  ).toHaveAttribute("href", "/aclaracion");
  expect(
    screen.getByRole("heading", { name: "Una aclaración espera tu respuesta" }),
  ).toBeVisible();
});
it("«Qué sigue» numera los pasos y anuncia su estado sin depender del color", () => {
  render(
    <NextSteps
      steps={[
        {
          id: "a",
          state: "done",
          title: "Enviaste tu respuesta",
          detail: "1 oct",
        },
        { id: "b", state: "current", title: "Pidieron una aclaración" },
        { id: "c", state: "todo", title: "Decisión validada" },
      ]}
    >
      <p>Vuelve a esta página para ver novedades.</p>
    </NextSteps>,
  );
  const region = screen.getByRole("complementary", { name: "Qué sigue" });
  const items = within(region).getAllByRole("listitem");
  expect(items).toHaveLength(3);
  expect(items[0]).toHaveTextContent("Enviaste tu respuesta (hecho)");
  expect(items[1]).toHaveTextContent("Pidieron una aclaración (ahora)");
  expect(items[2]).toHaveTextContent("Decisión validada (pendiente)");
  expect(
    within(region).getByText("Vuelve a esta página para ver novedades."),
  ).toBeVisible();
});
it("los datos de un vistazo son pares etiqueta/valor, cada uno con su glifo", () => {
  render(
    <FactGrid
      facts={[
        { id: "q", icon: "list", label: "Preguntas", value: 3 },
        { id: "v", icon: "clock", label: "Vence", value: "14 oct 2026" },
      ]}
    />,
  );
  expect(screen.getByText("Preguntas").closest("div")).toHaveTextContent("3");
  expect(screen.getByText("Vence").closest("div")).toHaveTextContent(
    "14 oct 2026",
  );
});
it("una línea de registro lee como documento: referencia, título con su nivel, meta y estado", () => {
  render(
    <ul>
      <RegisterRow
        level={2}
        reference="ADQ-05.01"
        title={<a href="/decision">Plazo máximo de pago</a>}
        meta="Pagos · Finanzas"
        status={<span>Vigente</span>}
      />
    </ul>,
  );
  expect(
    screen.getByRole("heading", { level: 2, name: "Plazo máximo de pago" }),
  ).toBeVisible();
  expect(screen.getByText("ADQ-05.01")).toBeVisible();
  expect(screen.getByText("Pagos · Finanzas")).toBeVisible();
  expect(screen.getByText("Vigente")).toBeVisible();
});
