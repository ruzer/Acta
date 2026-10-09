import "@vitejs/plugin-react/preamble";
// Development-only verification entry. Not part of Vite's production entry points.
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  Input,
  Select,
  Textarea,
  Dialog,
} from "../../app/frontend/src/ui";
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
  ComparisonTable,
  DecisionSheet,
  Receipt,
  Letter,
  SelectionBar,
} from "../../app/frontend/src/ui/semantic";
import "../../app/frontend/src/ui/fonts.css";
import "../../app/frontend/src/ui/tokens.css";
import "../../app/frontend/src/styles.css";
import "../../app/frontend/src/ui/semantic/semantic.css";
import "./direction-c.css";

function Showcase() {
  const decisionButton = useRef<HTMLButtonElement>(null);
  function closeDialog() {
    setDialog(false);
    requestAnimationFrame(() => decisionButton.current?.focus());
  }
  const [tab, setTab] = useState("answers"),
    [selected, setSelected] = useState("a"),
    [dialog, setDialog] = useState(false),
    [notice, setNotice] = useState("");
  const tabs = [
    { value: "answers", label: "Aportaciones" },
    { value: "comparison", label: "Contraste" },
    { value: "decision", label: "Decisión" },
    { value: "history", label: "Historial" },
  ];
  const levels = [
    ["Contexto de página", "Dónde estoy"],
    ["Objeto principal", "La pregunta o la decisión"],
    ["Contenido principal", "La respuesta o el resultado"],
    ["Contenido secundario", "Comentario, ejemplo, alcance"],
    ["Soporte", "Evidencia, aclaraciones, historial"],
    ["Metadatos", "Quién, cuándo, versión"],
    ["Estado", "Glifo y palabra"],
    ["Acciones", "Una principal; el resto secundarias"],
  ];
  return (
    <main aria-label="Verificación de componentes" className="visual-check">
      <header>
        <QuestionBand question="Jerarquía y componentes de Dirección C" />
        <p>
          Datos ficticios. Hoja de verificación fuera de las rutas del producto.
        </p>
      </header>
      <section className="visual-surface" aria-labelledby="hierarchy">
        <h2 id="hierarchy">1 · Niveles de jerarquía</h2>
        <dl className="visual-levels">
          {levels.map(([term, description], index) => (
            <div key={term}>
              <dt>
                <span aria-hidden="true">{index}</span>
                {term}
              </dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="visual-surface" aria-labelledby="states">
        <h2 id="states">2 · Estados con glifo y palabra</h2>
        <div className="visual-statuses">
          <StatusChip>Sin revisar</StatusChip>
          <StatusChip tone="info">Respondida</StatusChip>
          <StatusChip tone="warning">Requiere aclaración</StatusChip>
          <StatusChip tone="danger">Conflicto</StatusChip>
          <StatusChip tone="success">Validada</StatusChip>
        </div>
      </section>
      <section className="visual-surface" aria-labelledby="controls">
        <h2 id="controls">3 · Acciones y formularios</h2>
        <div className="visual-actions">
          <Button ref={decisionButton} onClick={() => setDialog(true)}>
            Registrar decisión
          </Button>
          <Button tone="secondary">Solicitar aclaración</Button>
          <Button tone="tertiary">Ver historial</Button>
          <Button tone="danger">Revocar invitación</Button>
        </div>
        <div className="visual-fields">
          <Input
            label="Título breve"
            defaultValue="Criterio de entrega"
            hint="Una referencia para encontrar la pregunta."
          />
          <Select label="Área responsable" defaultValue="example">
            <option value="example">Área de ejemplo</option>
          </Select>
          <Textarea
            label="Pregunta"
            defaultValue="¿Cómo se revisa la entrega antes de recibirla?"
          />
          <Input label="Referencia" error="Completa la referencia" />
        </div>
      </section>
      <section aria-label="Composición de revisión" className="visual-review">
        <header className="ac-question-band">
          <p className="ac-overline">Criterio de entrega</p>
          <h2>¿Cómo se revisa la entrega antes de recibirla?</h2>
          <MetaLine items={["ADQ-01", "Texto largo", "Área de ejemplo"]} />
        </header>
        <StateCard
          title="Lista para revisar"
          status={<StatusChip tone="info">Respondida</StatusChip>}
        >
          La aportación está disponible con sus fuentes.
        </StateCard>
        <TabNav
          id="check"
          label="Contenido de revisión"
          items={tabs}
          value={tab}
          onChange={setTab}
        />
        <TabPanel id="check" value="answers" active={tab === "answers"}>
          <div className="visual-contributions">
            <ContributionRail
              label="Aportaciones vigentes"
              items={[
                {
                  id: "a",
                  content: (
                    <>
                      <strong>Participante A</strong>
                      <span>Área de ejemplo</span>
                    </>
                  ),
                },
                {
                  id: "b",
                  content: (
                    <>
                      <strong>Participante B</strong>
                      <span>Área de ejemplo</span>
                    </>
                  ),
                },
              ]}
              selected={selected}
              onSelect={setSelected}
            />
            <ContributionPane
              title={selected === "a" ? "Participante A" : "Participante B"}
              metadata={
                <MetaLine items={["Envío 1 · Vigente", "8 oct 2026"]} />
              }
            >
              <p className="ac-answer">
                La entrega se coteja con la solicitud y se registra cualquier
                diferencia antes de aceptarla.
              </p>
              <EvidenceFile
                name="Acta_de_recepción_documental_y_validación_de_entrega.pdf"
                size="214 KB"
                onDownload={() => setNotice("Descarga de ejemplo seleccionada")}
              />
              <ThreadInset title="Aclaración">
                <ThreadMessage
                  from="asks"
                  author="Elena Rangel"
                  date="8 oct 2026"
                >
                  Se solicita precisar quién conserva el registro.
                </ThreadMessage>
              </ThreadInset>
            </ContributionPane>
          </div>
        </TabPanel>
        <TabPanel id="check" value="comparison" active={tab === "comparison"}>
          <ComparisonTable
            caption="Contraste de aportaciones"
            columns={[
              { key: "Postura A", head: "Postura A" },
              { key: "Postura B", head: "Postura B" },
            ]}
            rows={[
              {
                id: "answer",
                label: "Respuesta",
                values: [
                  "Se revisa al recibir.",
                  "Se revisa antes de aceptar.",
                ],
              },
            ]}
          />
        </TabPanel>
        <TabPanel id="check" value="decision" active={tab === "decision"}>
          <DecisionSheet
            label="Decisión vigente"
            kicker="Decisión validada"
            footer="No es firma electrónica ni atribuye efectos jurídicos adicionales."
          >
            <p className="ac-document-decision">Se decide</p>
            <p>Conservar el cotejo y sus fuentes.</p>
            <p>
              <em>Alcance de ejemplo.</em>
            </p>
          </DecisionSheet>
        </TabPanel>
        <TabPanel id="check" value="history" active={tab === "history"}>
          <p>Historial ficticio de la revisión.</p>
        </TabPanel>
      </section>
      <section className="visual-documents" aria-label="Documentos">
        <Receipt title="Respuesta enviada">
          <p>El envío conserva sus fuentes.</p>
        </Receipt>
        <Letter organization="Organización de ejemplo">
          <p>Invitación para aportar información.</p>
        </Letter>
      </section>
      <SelectionBar summary="4 preguntas seleccionadas">
        <Button tone="secondary">Asignar área</Button>
        <Button tone="secondary">Agregar participantes</Button>
      </SelectionBar>
      <p role="status">{notice}</p>
      {dialog && (
        <Dialog title="Registrar decisión" onClose={closeDialog}>
          <p>Verificación de foco y cierre. No se registra información.</p>
        </Dialog>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Showcase />);
