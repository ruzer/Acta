import { useEffect, useRef, useState, type ReactNode } from "react";
import { type QuestionView, typeLabels } from "@requirements/contracts";
import { Button, Input, Select, EmptyState } from "../../ui";
import {
  Publication,
  QuestionActions,
  TopicActions,
  publications,
  type EditorProps,
} from "./EditorWorkspace";
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
  ...props
}: EditorProps & { question: QuestionView; onClose: () => void }) {
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
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(
    props.initialSelected ?? null,
  );
  const questions = data.questions
    .filter(
      (q) =>
        (!topic || q.sectionId === topic) &&
        (!publication || q.publication === publication) &&
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
    setPage(0);
    setSelected(null);
  };
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
        {questions.slice(currentPage * 40, (currentPage + 1) * 40).map((q) => (
          <button
            className="qe-compact-row"
            key={q.id}
            aria-pressed={selected === q.id}
            onClick={() => setSelected(q.id)}
          >
            <span>
              <strong>{q.question}</strong>
              {q.groupParentId && (
                <small>
                  ↳ Seguimiento de{" "}
                  {data.questions.find((p) => p.id === q.groupParentId)?.title}
                </small>
              )}
              <small>
                {data.sections.find((s) => s.id === q.sectionId)?.title}
              </small>
            </span>
            <span>{typeLabels[q.type]}</span>
            <Publication question={q} />
          </button>
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
      {selection && (
        <QuestionInspector
          {...props}
          question={selection}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
