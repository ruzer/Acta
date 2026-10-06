import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  type QuestionView,
  type BulkOperation,
  typeLabels,
} from "@requirements/contracts";
import { Button, Input, Select, EmptyState } from "../../ui";
import {
  Publication,
  QuestionActions,
  TopicActions,
  publications,
  type EditorProps,
} from "./EditorWorkspace";
import { BulkDialog } from "./BulkDialog";
import { questionGroup } from "./bulk-selection";
function InspectorFrame({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const [wide, setWide] = useState(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(min-width:1280px)").matches,
  );
  const ref = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const m = window.matchMedia?.("(min-width:1280px)");
    if (!m) return;
    const update = () => setWide(m.matches);
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement;
    const dialog = ref.current;
    if (!wide) dialog?.showModal();
    else heading.current?.focus();
    return () => {
      dialog?.close();
      requestAnimationFrame(() => {
        // A deferred return must not steal focus from a newer user action.
        const active = document.activeElement;
        if (
          trigger?.isConnected &&
          (active === document.body || active === trigger) &&
          !document.querySelector("dialog[open]")
        )
          trigger.focus();
      });
    };
  }, [wide]);
  const content = (
    <>
      <header className="qe-inspector-head">
        <h3 ref={heading} tabIndex={-1}>
          Detalle de pregunta
        </h3>
        <Button tone="secondary" onClick={onClose}>
          Cerrar detalle
        </Button>
      </header>
      {children}
    </>
  );
  return wide ? (
    <aside className="qe-inspector" aria-label="Detalle de pregunta">
      {content}
    </aside>
  ) : (
    <dialog
      className="qe-inspector qe-inspector-dialog av-scope"
      aria-label="Detalle de pregunta"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {content}
    </dialog>
  );
}
export function QuestionInspector({
  question: q,
  onClose,
  onSelectGroup,
  ...props
}: EditorProps & {
  question: QuestionView;
  onClose: () => void;
  onSelectGroup?: () => void;
}) {
  const { data } = props;
  const area = data.areas.find((a) => a.id === q.responsibleAreaId);
  const parent = data.questions.find(
    (p) => p.id === q.condition?.parentQuestionId,
  );
  return (
    <InspectorFrame onClose={onClose}>
      <p className="hint">
        {data.sections.find((s) => s.id === q.sectionId)?.title}
      </p>
      <h4>{q.question}</h4>
      <div className="qe-row-meta">
        <span>{typeLabels[q.type]}</span>
        <Publication question={q} />
      </div>
      {q.helpText && <p>{q.helpText}</p>}
      <p>{q.required ? "Pregunta obligatoria" : "Pregunta opcional"}</p>
      {onSelectGroup && q.publication !== "ARCHIVED" && (
        <div className="qe-group-select">
          <p>
            Se seleccionarán {questionGroup(data.questions, q.id).length}{" "}
            preguntas: esta pregunta y sus seguimientos, incluso fuera de la
            página o los filtros actuales.
          </p>
          <Button tone="secondary" onClick={onSelectGroup}>
            Seleccionar grupo completo
          </Button>
        </div>
      )}
      <QuestionActions
        {...props}
        question={q}
        onEdit={(...args) => {
          onClose();
          props.onEdit(...args);
        }}
        onAction={(...args) => {
          onClose();
          props.onAction(...args);
        }}
      />
      <details className="qe-inspector-advanced">
        <summary>Configuración avanzada</summary>
        <dl>
          <dt>Identificador externo</dt>
          <dd>{q.externalId}</dd>
          <dt>Prioridad</dt>
          <dd>{q.priority}</dd>
          <dt>Área responsable</dt>
          <dd>{area?.name ?? "Área no disponible"}</dd>
          <dt>Participantes asignados</dt>
          <dd>
            {q.assignments
              .filter((a) => a.active)
              .map(
                (a) =>
                  data.members.find((m) => m.id === a.projectMemberId)
                    ?.displayName ?? "Participante no disponible",
              )
              .join(", ") || "Sin participantes asignados"}
          </dd>
        </dl>
        <p className="hint">
          El área responsable no asigna participantes automáticamente.
        </p>
        {q.groupParentId && (
          <p>
            Seguimiento de:{" "}
            {data.questions.find((p) => p.id === q.groupParentId)?.title ??
              "Pregunta no disponible"}
            . La agrupación no implica una condición.
          </p>
        )}
        {q.condition && (
          <p>
            Mostrar si «{parent?.question ?? "Pregunta no disponible"}»{" "}
            {
              {
                EQUALS: "es igual a",
                NOT_EQUALS: "es diferente de",
                CONTAINS: "incluye",
              }[q.condition.operator]
            }{" "}
            «
            {typeof q.condition.value === "boolean"
              ? q.condition.value
                ? "Sí"
                : "No"
              : (parent?.options.find((o) => o.value === q.condition?.value)
                  ?.label ?? q.condition.value)}
            ».
          </p>
        )}
        <details>
          <summary>Trazabilidad</summary>
          <ul>
            {q.references.map((r) => {
              const reference = data.references.find(
                (x) => x.id === r.referenceId,
              );
              return (
                <li key={r.referenceId}>
                  {reference?.externalId} · {reference?.label}
                  {r.scopeNote && <p>{r.scopeNote}</p>}
                </li>
              );
            })}
          </ul>
          {!q.references.length && <p>Sin referencias relacionadas.</p>}
          <p className="hint">
            Relacionar una referencia no la convierte en validada.
          </p>
          <Button
            tone="secondary"
            onClick={() => {
              onClose();
              props.onCreateReference();
            }}
          >
            Crear referencia
          </Button>
        </details>
      </details>
    </InspectorFrame>
  );
}
export function Organize(props: EditorProps & { initialSelected?: string }) {
  const { data } = props;
  const [topic, setTopic] = useState("");
  const [search, setSearch] = useState("");
  const [publication, setPublication] = useState("");
  const [area, setArea] = useState("");
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
  const [bulkOperation, setBulkOperation] = useState<BulkOperation | null>(
    null,
  );
  const [selectionNotice, setSelectionNotice] = useState("");
  const bulkTrigger = useRef<HTMLElement | null>(null);
  const selectionStatus = useRef<HTMLParagraphElement>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(
    props.initialSelected ?? null,
  );
  const questions = data.questions
    .filter(
      (q) =>
        (!topic || q.sectionId === topic) &&
        (!publication || q.publication === publication) &&
        (!area || q.responsibleAreaId === area) &&
        `${q.question} ${q.title} ${q.externalId}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    )
    .sort(
      (a, b) =>
        (data.sections.find((s) => s.id === a.sectionId)?.order ?? 0) -
          (data.sections.find((s) => s.id === b.sectionId)?.order ?? 0) ||
        a.order - b.order,
    );
  const pages = Math.ceil(questions.length / 40);
  const currentPage = Math.min(page, Math.max(0, pages - 1));
  const selection = data.questions.find((q) => q.id === selected);
  const change = () => {
    if (bulkIds.size)
      setSelectionNotice(
        "Se limpió la selección al cambiar los filtros. Selecciona las preguntas que deseas modificar.",
      );
    setBulkIds(new Set());
    setPage(0);
    setSelected(null);
  };
  const eligible = (rows: QuestionView[]) =>
    rows.filter((q) => q.publication !== "ARCHIVED");
  const pageRows = questions.slice(currentPage * 40, (currentPage + 1) * 40);
  const selectedQuestions = data.questions.filter((q) => bulkIds.has(q.id));
  function addSelection(rows: QuestionView[]) {
    setBulkIds(
      (previous) => new Set([...previous, ...eligible(rows).map((q) => q.id)]),
    );
    setSelectionNotice("");
  }
  function closeBulk() {
    setBulkOperation(null);
    requestAnimationFrame(() => {
      if (bulkTrigger.current?.isConnected) bulkTrigger.current.focus();
      else selectionStatus.current?.focus();
    });
  }
  function openBulk(operation: BulkOperation) {
    bulkTrigger.current = document.activeElement as HTMLElement;
    setBulkOperation(operation);
  }
  return (
    <div className={"qe-organize" + (selection ? " qe-has-inspector" : "")}>
      <nav className="qe-outline" aria-label="Temas del cuestionario">
        <details open>
          <summary>Temas</summary>
          <button
            aria-current={!topic ? "true" : undefined}
            onClick={() => {
              setTopic("");
              change();
            }}
          >
            Todos los temas <span>{data.questions.length}</span>
          </button>
          {[...data.sections]
            .sort((a, b) => a.order - b.order)
            .map((s) => (
              <button
                key={s.id}
                aria-current={topic === s.id ? "true" : undefined}
                onClick={() => {
                  setTopic(s.id);
                  change();
                }}
              >
                {s.title}
                <span>
                  {data.questions.filter((q) => q.sectionId === s.id).length}
                </span>
              </button>
            ))}
        </details>
        {topic && <TopicActions {...props} id={topic} />}
        <Button tone="secondary" onClick={props.onCreateTopic}>
          + Agregar tema
        </Button>
      </nav>
      <section className="qe-compact" aria-label="Preguntas del cuestionario">
        <div className="qe-filters">
          <Input
            label="Buscar preguntas"
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              change();
            }}
          />
          <Select
            label="Área responsable"
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              change();
            }}
          >
            <option value="">Todas las áreas</option>
            {data.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {!a.active ? " (inactiva)" : ""}
              </option>
            ))}
          </Select>
          <Select
            label="Estado de publicación"
            value={publication}
            onChange={(e) => {
              setPublication(e.target.value);
              change();
            }}
          >
            <option value="">Todos los estados</option>
            {Object.entries(publications).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <p role="status" className="hint">
          {questions.length} preguntas encontradas
          {questions.length > 40
            ? ` · Página ${currentPage + 1} de ${pages}`
            : ""}
        </p>
        <div
          className="qe-selection-controls"
          role="group"
          aria-label="Alcance de selección"
        >
          <Button
            tone="secondary"
            disabled={!eligible(pageRows).length}
            onClick={() => addSelection(pageRows)}
          >
            Seleccionar esta página ({eligible(pageRows).length})
          </Button>
          <Button
            tone="secondary"
            disabled={!eligible(questions).length}
            onClick={() => addSelection(questions)}
          >
            Seleccionar todos los resultados ({eligible(questions).length})
          </Button>
          {topic && (
            <Button
              tone="secondary"
              onClick={() => {
                const rows = eligible(
                  data.questions.filter((q) => q.sectionId === topic),
                );
                addSelection(rows);
                setSelectionNotice(
                  `Se seleccionó el tema completo: ${rows.length} preguntas, incluidas las que quedan fuera de los filtros.`,
                );
              }}
            >
              Seleccionar tema completo (
              {
                eligible(data.questions.filter((q) => q.sectionId === topic))
                  .length
              }
              )
            </Button>
          )}
        </div>
        <p
          ref={selectionStatus}
          tabIndex={-1}
          role="status"
          className="qe-selection-status"
        >
          {bulkIds.size === 1
            ? "1 pregunta seleccionada"
            : `${bulkIds.size} preguntas seleccionadas`}
        </p>
        {selectionNotice && (
          <p role="status" className="hint">
            {selectionNotice}
          </p>
        )}
        {bulkIds.size > 0 && (
          <div
            className="qe-bulk-bar"
            role="group"
            aria-label="Acciones para las preguntas seleccionadas"
          >
            <Button tone="secondary" onClick={() => openBulk("ASSIGN_AREA")}>
              Asignar área
            </Button>
            <Button
              tone="secondary"
              onClick={() => openBulk("ADD_PARTICIPANTS")}
            >
              Agregar participantes
            </Button>
            <Button onClick={() => openBulk("PUBLISH")}>
              Publicar seleccionadas
            </Button>
            <Button
              tone="secondary"
              onClick={() => {
                setBulkIds(new Set());
                setSelectionNotice("");
                selectionStatus.current?.focus();
              }}
            >
              Limpiar selección
            </Button>
          </div>
        )}
        {pageRows.map((q) => (
          <div className="qe-selectable-row" key={q.id}>
            <label className="qe-row-checkbox">
              <input
                type="checkbox"
                aria-label={`Seleccionar pregunta: ${q.question}`}
                checked={bulkIds.has(q.id)}
                disabled={q.publication === "ARCHIVED"}
                onChange={(e) => {
                  setBulkIds((previous) => {
                    const next = new Set(previous);
                    if (e.target.checked) next.add(q.id);
                    else next.delete(q.id);
                    return next;
                  });
                  setSelectionNotice("");
                }}
              />
            </label>
            <button
              className="qe-compact-row"
              data-question-id={q.id}
              key={q.id}
              aria-pressed={selected === q.id}
              onClick={() => setSelected(q.id)}
            >
              <span>
                <strong>{q.question}</strong>
                {q.groupParentId && (
                  <small>
                    ↳ Seguimiento de{" "}
                    {
                      data.questions.find((p) => p.id === q.groupParentId)
                        ?.title
                    }
                  </small>
                )}
                <small>
                  {data.sections.find((s) => s.id === q.sectionId)?.title}
                </small>
              </span>
              <span>{typeLabels[q.type]}</span>
              <Publication question={q} />
            </button>
          </div>
        ))}
        {!questions.length && (
          <EmptyState title="No encontramos preguntas con estos filtros.">
            Cambia el tema o elimina los filtros.
          </EmptyState>
        )}
        {pages > 1 && (
          <div className="qe-pagination">
            <Button
              tone="secondary"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Página anterior
            </Button>
            <Button
              tone="secondary"
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Página siguiente
            </Button>
          </div>
        )}
        {topic && (
          <Button
            tone="secondary"
            disabled={!data.areas.some((a) => a.active)}
            onClick={() => props.onEdit(undefined, topic)}
          >
            + Agregar pregunta
          </Button>
        )}
      </section>
      {bulkOperation && (
        <BulkDialog
          data={data}
          projectId={props.projectId}
          operation={bulkOperation}
          onRefresh={props.onRefresh}
          questions={selectedQuestions}
          onClose={closeBulk}
          onAddDependency={(id) =>
            setBulkIds((previous) => new Set([...previous, id]))
          }
          onCorrect={(id, field) => {
            const question = data.questions.find((q) => q.id === id);
            setBulkOperation(null);
            if (question && field === "assignments")
              props.onAction("assign", question);
            else if (question?.publication === "DRAFT")
              props.onEdit(question, question.sectionId, field);
            else setSelected(id);
          }}
          onComplete={(result) => {
            closeBulk();
            setBulkIds(new Set());
            const message = `Operación aplicada: ${result.changedIds.length} preguntas actualizadas; ${result.ignoredIds.length} sin cambios.`;
            setSelectionNotice(message);
            props.onBulkComplete?.(message);
          }}
        />
      )}
      {selection && (
        <QuestionInspector
          {...props}
          question={selection}
          onSelectGroup={() => {
            const group = questionGroup(data.questions, selection.id);
            addSelection(group);
            setSelectionNotice(
              `Grupo seleccionado: ${group.length} preguntas. La selección incluye seguimientos fuera de la página o los filtros actuales.`,
            );
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
