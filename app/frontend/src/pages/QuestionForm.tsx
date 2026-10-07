import "../analyst-visual.css";
import "../next-authoring.css";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import {
  priorities,
  questionInput,
  questionTypes,
  typeLabels,
  type QuestionInput,
  type QuestionView,
  type QuestionnaireView,
} from "@requirements/contracts";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Input,
  Select,
  Textarea,
} from "../ui";
import { ApiFailure } from "../api";

const typeDescriptions: Record<QuestionInput["type"], string> = {
  YES_NO: "El participante elige entre sí y no.",
  SINGLE_CHOICE: "El participante selecciona una opción de la lista.",
  MULTIPLE_CHOICE: "El participante puede seleccionar varias opciones.",
  SHORT_TEXT: "Una respuesta breve en texto.",
  LONG_TEXT: "Una respuesta en texto con espacio para desarrollar el tema.",
  DATE: "El participante indica una fecha.",
  NUMBER: "El participante indica un valor numérico.",
  MATRIX: "Organiza la respuesta mediante filas y columnas.",
};
export function QuestionForm({
  data,
  initial,
  defaultSectionId,
  focusField,
  onSave,
  onCancel,
}: {
  data: QuestionnaireView;
  initial?: QuestionView;
  defaultSectionId?: string;
  focusField?: string;
  onSave: (d: QuestionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<QuestionInput>(
    initial
      ? {
          externalId: initial.externalId,
          sectionId: initial.sectionId,
          title: initial.title,
          question: initial.question,
          helpText: initial.helpText,
          type: initial.type,
          required: initial.required,
          priority: initial.priority,
          responsibleAreaId: initial.responsibleAreaId,
          order: initial.order,
          groupParentId: initial.groupParentId,
          supersedesQuestionId: initial.supersedesQuestionId,
          config: initial.config,
          options: initial.options,
          condition: initial.condition,
          references: initial.references,
        }
      : {
          externalId: "",
          sectionId: defaultSectionId ?? data.sections[0]?.id ?? "",
          title: "",
          question: "",
          helpText: "",
          type: "SHORT_TEXT",
          required: true,
          priority: "P1",
          responsibleAreaId: data.areas[0]?.id || "",
          order:
            Math.max(
              0,
              ...data.questions
                .filter(
                  (q) =>
                    q.sectionId === (defaultSectionId ?? data.sections[0]?.id),
                )
                .map((q) => q.order),
            ) + 1,
          groupParentId: null,
          supersedesQuestionId: null,
          config: null,
          options: [],
          condition: null,
          references: [],
        },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    formRef.current
      ?.querySelector<HTMLTextAreaElement>('[name="question"]')
      ?.focus();
    return () => {
      dialog?.close();
      requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus();
      });
    };
  }, []);
  const [advanced, setAdvanced] = useState(false);
  const [dirty, setDirty] = useState(false);
  const blocker = useBlocker(dirty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  useBeforeUnload((e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  function patch(p: Partial<QuestionInput>) {
    setValue((v) => ({ ...v, ...p }));
    setDirty(true);
  }
  function fieldLabel(name: string) {
    const control = Array.from(formRef.current?.elements ?? []).find(
      (el) => el.getAttribute("name") === name,
    ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | undefined;
    const label = control?.labels?.[0]?.textContent?.trim();
    if (label) return label;
    const labels: Record<string, string> = {
      question: "Pregunta",
      title: "Título breve",
      externalId: "Identificador externo",
      type: "Tipo de respuesta",
      sectionId: "Tema",
      options: "Opciones",
      config: "Configuración de respuesta",
      references: "Trazabilidad",
      condition: "Condición",
      groupParentId: "Seguimiento",
      priority: "Prioridad",
      responsibleAreaId: "Área responsable",
      supersedesQuestionId: "Pregunta anterior",
    };
    return labels[name.split(".")[0]!] ?? "Configuración de pregunta";
  }
  function revealField(name: string, focus = true) {
    const form = formRef.current;
    const controls = Array.from(form?.elements ?? []);
    let target = (controls.find((el) => el.getAttribute("name") === name) ??
      controls.find((el) => {
        const field = el.getAttribute("name");
        return (
          !!field &&
          (field.startsWith(name + ".") || name.startsWith(field + "."))
        );
      })) as HTMLElement | undefined;
    if (!target)
      target = Array.from(
        form?.querySelectorAll<HTMLElement>("[data-field]") ?? [],
      ).find(
        (el) =>
          name === el.dataset.field || name.startsWith(el.dataset.field + "."),
      );
    if (target) {
      let ancestor = target.parentElement;
      while (ancestor && ancestor !== form) {
        if (ancestor instanceof HTMLDetailsElement) {
          ancestor.open = true;
          if (ancestor.classList.contains("av-advanced")) setAdvanced(true);
        }
        ancestor = ancestor.parentElement;
      }
      if (focus) target.focus();
    } else if (focus)
      form?.querySelector<HTMLElement>(".av-form-errors")?.focus();
  }
  function showErrors(next: Record<string, string>) {
    setFields(next);
    requestAnimationFrame(() => {
      for (const key of Object.keys(next)) revealField(key, false);
      revealField(Object.keys(next)[0] ?? "");
    });
  }
  useEffect(() => {
    if (focusField) requestAnimationFrame(() => revealField(focusField));
  }, [focusField]);
  const fieldError = (key: string) =>
    fields[key] ??
    Object.entries(fields).find(([path]) => path.startsWith(key + "."))?.[1];
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setFields({});
    const invalid: Record<string, string> = {};
    for (const el of Array.from(formRef.current?.elements ?? [])) {
      if (
        (el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement) &&
        !el.validity.valid
      )
        invalid[el.name] = el.validationMessage;
    }
    if (Object.keys(invalid).length) {
      showErrors(invalid);
      return;
    }
    const parsed = questionInput.safeParse(value);
    if (!parsed.success) {
      showErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join("."),
            issue.message,
          ]),
        ),
      );
      return;
    }
    setBusy(true);
    try {
      await onSave(value);
      setDirty(false);
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof ApiFailure) showErrors(e.fields);
    } finally {
      setBusy(false);
    }
  }
  function cancel() {
    if (
      !dirty ||
      window.confirm("Hay cambios sin guardar en esta pregunta. ¿Descartarlos?")
    )
      onCancel();
  }
  const parent = data.questions.find(
    (q) => q.id === value.condition?.parentQuestionId,
  );
  const candidates = data.questions.filter(
    (q) => q.id !== initial?.id && q.publication !== "ARCHIVED",
  );
  const matrix = value.config as {
    rows?: { key: string; label: string }[];
    columns?: { key: string; label: string }[];
  } | null;
  const areaName =
    data.areas.find((area) => area.id === value.responsibleAreaId)?.name ??
    "Área por seleccionar";
  const groupQuestion = data.questions.find(
    (q) => q.id === value.groupParentId,
  );
  const previousQuestion = data.questions.find(
    (q) => q.id === value.supersedesQuestionId,
  );
  const limitSummary =
    value.config?.maxLength != null
      ? `${value.config.maxLength} caracteres como máximo`
      : [
          value.config?.min != null ? `Mínimo: ${value.config.min}` : "",
          value.config?.max != null ? `Máximo: ${value.config.max}` : "",
        ]
          .filter(Boolean)
          .join(" · ") || "Sin límites adicionales";
  const advancedSummary = [
    areaName,
    `Prioridad ${value.priority}`,
    value.groupParentId ? "Con seguimiento" : "",
    value.condition ? "Con condición" : "",
    value.references.length
      ? `${value.references.length} ${value.references.length === 1 ? "referencia" : "referencias"}`
      : "",
    value.supersedesQuestionId ? "Sustituye una pregunta" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <dialog
      ref={dialogRef}
      className="av-question-dialog av-scope next-authoring"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) cancel();
      }}
    >
      {blocker.state === "blocked" && (
        <Dialog title="Cambios sin guardar" onClose={() => blocker.reset()}>
          <p>
            Hay cambios pendientes en esta pregunta. Puedes seguir editando o
            salir y descartarlos.
          </p>
          <div className="actions">
            <Button onClick={() => blocker.reset()}>Seguir editando</Button>
            <Button tone="danger" onClick={() => blocker.proceed()}>
              Descartar y salir
            </Button>
          </div>
        </Dialog>
      )}
      <form
        ref={formRef}
        noValidate
        className="editor-form av-scope av-composer-form"
        onSubmit={submit}
      >
        <header className="av-composer-head">
          <h2 id={titleId}>
            {initial ? "Editar pregunta" : "Agregar pregunta al cuestionario"}
          </h2>
          <Button tone="secondary" disabled={busy} onClick={cancel}>
            Cerrar
          </Button>
        </header>
        <fieldset disabled={busy}>
          <legend className="sr-only">Contenido de la pregunta</legend>
          <div className="next-authoring-prompt">
            <Textarea
              label="Pregunta"
              name="question"
              value={value.question}
              required
              error={fieldError("question")}
              onChange={(e) => patch({ question: e.target.value })}
            />
          </div>
          <details className="av-help" open={!!initial?.helpText}>
            <summary>Ayuda o contexto (opcional)</summary>
            <Textarea
              label="Ayuda para el participante"
              error={fieldError("helpText")}
              name="helpText"
              value={value.helpText}
              onChange={(e) => patch({ helpText: e.target.value })}
            />
          </details>
          <div className="next-authoring-context">
            <Select
              label="Tema al que pertenece"
              error={fieldError("sectionId")}
              name="sectionId"
              disabled={!!initial}
              value={value.sectionId}
              required
              onChange={(e) =>
                patch({
                  sectionId: e.target.value,
                  order:
                    e.target.value === initial?.sectionId
                      ? initial.order
                      : Math.max(
                          0,
                          ...data.questions
                            .filter((q) => q.sectionId === e.target.value)
                            .map((q) => q.order),
                        ) + 1,
                })
              }
            >
              {data.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
            <Checkbox
              label="Pregunta obligatoria"
              name="required"
              checked={value.required}
              onChange={(e) => patch({ required: e.target.checked })}
            />
          </div>
          <fieldset
            className="av-type-picker"
            aria-describedby={
              fieldError("type")
                ? titleId + "-type-error"
                : titleId + "-type-help"
            }
          >
            <legend>Tipo de respuesta esperada</legend>
            <div className="av-type-options">
              {questionTypes.map((type) => (
                <label className="av-type-option" key={type}>
                  <input
                    type="radio"
                    name="type"
                    value={type}
                    checked={value.type === type}
                    aria-invalid={!!fieldError("type")}
                    aria-describedby={
                      fieldError("type") ? titleId + "-type-error" : undefined
                    }
                    onChange={() => patch({ type, config: null, options: [] })}
                  />
                  <span>{typeLabels[type]}</span>
                </label>
              ))}
            </div>
            <p
              className="hint next-authoring-type-help"
              id={titleId + "-type-help"}
            >
              {typeDescriptions[value.type]}
            </p>
            {fieldError("type") && (
              <p className="field-error" id={titleId + "-type-error"}>
                {fieldError("type")}
              </p>
            )}
          </fieldset>
        </fieldset>
        {["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(value.type) && (
          <fieldset
            className="next-authoring-response-config"
            data-field="options"
            tabIndex={-1}
            aria-invalid={!!fieldError("options")}
            aria-describedby={
              fieldError("options") ? titleId + "-options-error" : undefined
            }
          >
            <legend>Opciones disponibles</legend>
            {fieldError("options") && (
              <p className="field-error" id={titleId + "-options-error"}>
                {fieldError("options")}
              </p>
            )}
            {value.options.map((o, i) => (
              <div className="option-row" key={i}>
                <Input
                  label={"Código de opción " + (i + 1)}
                  name={`options.${i}.value`}
                  error={fieldError(`options.${i}.value`)}
                  value={o.value}
                  required
                  onChange={(e) =>
                    patch({
                      options: value.options.map((x, j) =>
                        i === j ? { ...x, value: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Input
                  label={"Texto de opción " + (i + 1)}
                  name={`options.${i}.label`}
                  error={fieldError(`options.${i}.label`)}
                  value={o.label}
                  required
                  onChange={(e) =>
                    patch({
                      options: value.options.map((x, j) =>
                        i === j ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Button
                  tone="secondary"
                  onClick={() =>
                    patch({
                      options: value.options
                        .filter((_, j) => j !== i)
                        .map((x, j) => ({ ...x, order: j + 1 })),
                    })
                  }
                >
                  Quitar opción {i + 1}
                </Button>
              </div>
            ))}
            <Button
              tone="secondary"
              onClick={() =>
                patch({
                  options: [
                    ...value.options,
                    {
                      value: "OPCION_" + (value.options.length + 1),
                      label: "",
                      order: value.options.length + 1,
                    },
                  ],
                })
              }
            >
              Agregar opción
            </Button>
          </fieldset>
        )}
        {value.type === "MATRIX" && (
          <fieldset
            className="next-authoring-response-config"
            data-field="config"
            tabIndex={-1}
            aria-invalid={!!fieldError("config")}
            aria-describedby={
              fieldError("config") ? titleId + "-config-error" : undefined
            }
          >
            <legend>Filas y columnas de la matriz</legend>
            {fieldError("config") && (
              <p className="field-error" id={titleId + "-config-error"}>
                {fieldError("config")}
              </p>
            )}
            {(["rows", "columns"] as const).map((axis) => (
              <div key={axis}>
                <h3>{axis === "rows" ? "Filas" : "Columnas"}</h3>
                {(matrix?.[axis] || []).map((x, i) => (
                  <div className="option-row" key={i}>
                    <Input
                      label={
                        "Clave de " +
                        (axis === "rows" ? "fila " : "columna ") +
                        (i + 1)
                      }
                      name={`config.${axis}.${i}.key`}
                      error={fieldError(`config.${axis}.${i}.key`)}
                      value={x.key}
                      required
                      onChange={(e) =>
                        patch({
                          config: {
                            ...value.config,
                            [axis]: matrix![axis]!.map((n, j) =>
                              i === j ? { ...n, key: e.target.value } : n,
                            ),
                          },
                        })
                      }
                    />
                    <Input
                      label={
                        "Texto de " +
                        (axis === "rows" ? "fila " : "columna ") +
                        (i + 1)
                      }
                      name={`config.${axis}.${i}.label`}
                      error={fieldError(`config.${axis}.${i}.label`)}
                      value={x.label}
                      required
                      onChange={(e) =>
                        patch({
                          config: {
                            ...value.config,
                            [axis]: matrix![axis]!.map((n, j) =>
                              i === j ? { ...n, label: e.target.value } : n,
                            ),
                          },
                        })
                      }
                    />
                    <Button
                      tone="secondary"
                      onClick={() =>
                        patch({
                          config: {
                            ...value.config,
                            [axis]: matrix![axis]!.filter((_, j) => j !== i),
                          },
                        })
                      }
                    >
                      Quitar {axis === "rows" ? "fila" : "columna"} {i + 1}
                    </Button>
                  </div>
                ))}
                <Button
                  tone="secondary"
                  onClick={() =>
                    patch({
                      config: {
                        ...value.config,
                        [axis]: [
                          ...(matrix?.[axis] || []),
                          {
                            key:
                              (axis === "rows" ? "FILA_" : "COL_") +
                              ((matrix?.[axis]?.length || 0) + 1),
                            label: "",
                          },
                        ],
                      },
                    })
                  }
                >
                  Agregar {axis === "rows" ? "fila" : "columna"}
                </Button>
              </div>
            ))}
          </fieldset>
        )}
        <fieldset disabled={busy} className="next-authoring-identification">
          <legend>Identificación de la pregunta</legend>
          <p className="hint">
            {initial
              ? "El identificador se conserva; puedes ajustar el título breve."
              : "Ambos campos son obligatorios para guardar y reconocer la pregunta."}
          </p>
          <div className="grid2">
            <Input
              label="Identificador externo"
              required
              name="externalId"
              value={value.externalId}
              readOnly={!!initial}
              error={fieldError("externalId")}
              onChange={(e) => patch({ externalId: e.target.value })}
            />

            <Input
              label="Título breve"
              name="title"
              value={value.title}
              required
              error={fieldError("title")}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </div>
        </fieldset>
        <details
          className="av-advanced"
          open={advanced}
          onToggle={(e) => setAdvanced(e.currentTarget.open)}
        >
          <summary>
            <span>Configuración avanzada</span>
            <span className="next-authoring-summary">{advancedSummary}</span>
          </summary>
          <div className="av-advanced-content">
            <p className="hint">
              El área responsable no asigna participantes automáticamente.
            </p>
            {["NUMBER", "DATE", "SHORT_TEXT", "LONG_TEXT"].includes(
              value.type,
            ) && (
              <details className="panel">
                <summary>
                  <span>Límites del campo (opcional)</span>
                  <span className="next-authoring-summary">{limitSummary}</span>
                </summary>
                {value.type === "NUMBER" || value.type === "DATE" ? (
                  <div className="grid2">
                    {(["min", "max"] as const).map((k) => (
                      <Input
                        key={k}
                        label={k === "min" ? "Mínimo" : "Máximo"}
                        type={value.type === "DATE" ? "date" : "number"}
                        name={`config.${k}`}
                        error={fieldError(`config.${k}`)}
                        value={String(value.config?.[k] ?? "")}
                        onChange={(e) => {
                          const config = { ...value.config };
                          if (e.target.value === "") delete config[k];
                          else
                            config[k] =
                              value.type === "NUMBER"
                                ? Number(e.target.value)
                                : e.target.value;
                          patch({ config });
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <Input
                    label="Máximo de caracteres"
                    type="number"
                    min={1}
                    max={value.type === "SHORT_TEXT" ? 500 : 10000}
                    name="config.maxLength"
                    error={fieldError("config")}
                    value={String(value.config?.maxLength ?? "")}
                    onChange={(e) =>
                      patch({
                        config: e.target.value
                          ? { maxLength: Number(e.target.value) }
                          : null,
                      })
                    }
                  />
                )}
              </details>
            )}
            <details className="panel">
              <summary>
                <span>Prioridad y área responsable</span>
                <span className="next-authoring-summary">
                  {areaName} · Prioridad {value.priority}
                </span>
              </summary>
              <div className="grid2">
                <Select
                  label="Prioridad"
                  error={fieldError("priority")}
                  name="priority"
                  value={value.priority}
                  onChange={(e) =>
                    patch({
                      priority: e.target.value as QuestionInput["priority"],
                    })
                  }
                >
                  {priorities.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </Select>
                <Select
                  label="Área responsable"
                  error={fieldError("responsibleAreaId")}
                  name="responsibleAreaId"
                  value={value.responsibleAreaId}
                  required
                  onChange={(e) => patch({ responsibleAreaId: e.target.value })}
                >
                  {data.areas
                    .filter((a) => a.active)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </Select>
              </div>
            </details>
            <details className="panel">
              <summary>
                <span>Seguimiento de una pregunta</span>
                <span className="next-authoring-summary">
                  {groupQuestion
                    ? `${groupQuestion.externalId} · ${groupQuestion.title}`
                    : "Sin agrupación"}
                </span>
              </summary>
              <Select
                label="Pregunta principal del grupo"
                name="groupParentId"
                error={fieldError("groupParentId")}
                value={value.groupParentId || ""}
                onChange={(e) =>
                  patch({ groupParentId: e.target.value || null })
                }
              >
                <option value="">Sin agrupación</option>
                {candidates
                  .filter((q) => q.sectionId === value.sectionId)
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
              </Select>
            </details>
            <details className="panel">
              <summary>
                <span>Condición de visualización</span>
                <span className="next-authoring-summary">
                  {parent
                    ? `Según la respuesta a ${parent.externalId} · ${parent.title}`
                    : "Sin condición"}
                </span>
              </summary>
              <Select
                label="Mostrar según la respuesta a"
                name="condition.parentQuestionId"
                error={fieldError("condition")}
                value={value.condition?.parentQuestionId || ""}
                onChange={(e) => {
                  const p = candidates.find((q) => q.id === e.target.value);
                  patch({
                    condition: p
                      ? {
                          parentQuestionId: p.id,
                          operator:
                            p.type === "MULTIPLE_CHOICE"
                              ? "CONTAINS"
                              : "EQUALS",
                          value:
                            p.type === "YES_NO"
                              ? true
                              : p.options[0]?.value || "",
                        }
                      : null,
                  });
                }}
              >
                <option value="">Sin condición</option>
                {candidates
                  .filter((q) =>
                    ["YES_NO", "SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(
                      q.type,
                    ),
                  )
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
              </Select>
              {value.condition && (
                <div className="grid2">
                  <Select
                    label="Relación"
                    name="condition.operator"
                    error={fieldError("condition.operator")}
                    value={value.condition.operator}
                    onChange={(e) =>
                      patch({
                        condition: {
                          ...value.condition!,
                          operator: e.target.value as
                            "EQUALS" | "NOT_EQUALS" | "CONTAINS",
                        },
                      })
                    }
                  >
                    {parent?.type === "MULTIPLE_CHOICE" ? (
                      <option value="CONTAINS">Incluye</option>
                    ) : (
                      <>
                        <option value="EQUALS">Es igual a</option>
                        <option value="NOT_EQUALS">Es diferente de</option>
                      </>
                    )}
                  </Select>
                  <Select
                    label="Valor esperado"
                    name="condition.value"
                    error={fieldError("condition.value")}
                    value={String(value.condition.value)}
                    onChange={(e) =>
                      patch({
                        condition: {
                          ...value.condition!,
                          value:
                            parent?.type === "YES_NO"
                              ? e.target.value === "true"
                              : e.target.value,
                        },
                      })
                    }
                  >
                    {parent?.type === "YES_NO" ? (
                      <>
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </>
                    ) : (
                      parent?.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))
                    )}
                  </Select>
                </div>
              )}
            </details>
            <details className="panel">
              <summary>
                <span>Referencias de trazabilidad</span>
                <span className="next-authoring-summary">
                  {value.references.length
                    ? `${value.references.length} ${value.references.length === 1 ? "referencia relacionada" : "referencias relacionadas"}`
                    : "Sin referencias relacionadas"}
                  {previousQuestion
                    ? ` · Sustituye a ${previousQuestion.externalId}`
                    : ""}
                </span>
              </summary>
              <Select
                label="Sustituye a una pregunta publicada (opcional)"
                name="supersedesQuestionId"
                error={fieldError("supersedesQuestionId")}
                value={value.supersedesQuestionId || ""}
                onChange={(e) =>
                  patch({ supersedesQuestionId: e.target.value || null })
                }
              >
                <option value="">No sustituye otra pregunta</option>
                {data.questions
                  .filter(
                    (q) =>
                      q.id !== initial?.id && q.publication === "PUBLISHED",
                  )
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title}
                    </option>
                  ))}
              </Select>

              <div
                role="group"
                aria-label="Referencias relacionadas"
                data-field="references"
                tabIndex={-1}
                aria-invalid={!!fieldError("references")}
                aria-describedby={
                  fieldError("references")
                    ? "question-reference-error"
                    : undefined
                }
              >
                {fieldError("references") && (
                  <p id="question-reference-error" className="field-error">
                    {fieldError("references")}
                  </p>
                )}
                <p className="hint">
                  Relacionar una referencia no la valida ni confirma su
                  contenido.
                </p>
                {data.references.length ? (
                  data.references.map((r) => (
                    <div key={r.id}>
                      <Checkbox
                        name="references"
                        aria-invalid={!!fieldError("references")}
                        aria-describedby={
                          fieldError("references")
                            ? "question-reference-error"
                            : undefined
                        }
                        label={r.externalId + " · " + r.label}
                        checked={value.references.some(
                          (x) => x.referenceId === r.id,
                        )}
                        onChange={(e) =>
                          patch({
                            references: e.target.checked
                              ? [
                                  ...value.references,
                                  { referenceId: r.id, scopeNote: "" },
                                ]
                              : value.references.filter(
                                  (x) => x.referenceId !== r.id,
                                ),
                          })
                        }
                      />
                      {value.references.some((x) => x.referenceId === r.id) && (
                        <Input
                          name={`references.${value.references.findIndex((x) => x.referenceId === r.id)}.scopeNote`}
                          error={fieldError("references")}
                          label={"Alcance de " + r.externalId}
                          value={
                            value.references.find(
                              (x) => x.referenceId === r.id,
                            )!.scopeNote
                          }
                          onChange={(e) =>
                            patch({
                              references: value.references.map((x) =>
                                x.referenceId === r.id
                                  ? { ...x, scopeNote: e.target.value }
                                  : x,
                              ),
                            })
                          }
                        />
                      )}
                    </div>
                  ))
                ) : (
                  <p>Crea primero una referencia desde el cuestionario.</p>
                )}
              </div>
            </details>
          </div>
        </details>
        {error && (
          <Alert error>
            <p>{error}</p>
            {Object.keys(fields).length > 0 && (
              <p>
                Revisa los campos del formulario. El contenido sigue disponible
                para corregirlo.
              </p>
            )}
          </Alert>
        )}
        {Object.keys(fields).length > 0 && (
          <div className="av-form-errors" role="alert" tabIndex={-1}>
            <p>Revisa los campos indicados. Conservamos lo que escribiste.</p>
            <ul>
              {Object.entries(fields).map(([key, message]) => (
                <li key={key}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      revealField(key);
                    }}
                  >
                    {fieldLabel(key)}: {message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="sticky-actions">
          <Button type="submit" disabled={busy}>
            {busy
              ? "Guardando pregunta…"
              : initial
                ? "Guardar cambios"
                : "Crear pregunta"}
          </Button>
          <Button tone="secondary" disabled={busy} onClick={cancel}>
            Cancelar
          </Button>
          <span className="hint" role="status">
            {dirty ? "Cambios sin guardar" : "Sin cambios pendientes"}
          </span>
        </div>
      </form>
    </dialog>
  );
}
