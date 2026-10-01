import { useId } from "react";
import { ResponseContent, ResponseQuestionView } from "@requirements/contracts";
import { Button, Checkbox, Input, Radio, Select, Textarea } from "../ui";
type Value = ResponseContent["answer"];
export function answerText(q: ResponseQuestionView, a: Value): string {
  if (a === null) return "Sin valor; consulta el comentario.";
  if (typeof a === "boolean") return a ? "Sí" : "No";
  if (q.type === "SINGLE_CHOICE")
    return q.options.find((o) => o.value === a)?.label ?? String(a);
  if (Array.isArray(a))
    return (
      a
        .map((v) => q.options.find((o) => o.value === v)?.label ?? v)
        .join(", ") || "Sin selección"
    );
  if (typeof a === "object") {
    const cfg = q.config as {
      rows: { key: string; label: string }[];
      columns: { key: string; label: string }[];
    };
    return cfg.rows
      .map(
        (r) =>
          `${r.label}: ${cfg.columns.find((c) => c.key === a[r.key])?.label ?? "Sin selección"}`,
      )
      .join("\n");
  }
  return String(a);
}
export function AnswerControl({
  question: q,
  value,
  onChange,
  error,
  disabled = false,
  compact = false,
}: {
  question: ResponseQuestionView;
  value: Value;
  onChange: (a: Value) => void;
  error?: string;
  disabled?: boolean;
  compact?: boolean;
}) {
  const id = useId(),
    cfg = q.config || {};
  const hint =
    compact && q.required
      ? "Obligatoria para enviar."
      : q.required
        ? "Necesaria para enviar. Puedes guardar un borrador incompleto."
        : "Opcional. Si la envías sin valor, explica el motivo en el comentario.";
  if (q.type === "SHORT_TEXT" || q.type === "LONG_TEXT")
    return (
      <Textarea
        label="Tu respuesta"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        maxLength={Number(
          cfg.maxLength ?? (q.type === "SHORT_TEXT" ? 500 : 10000),
        )}
        rows={q.type === "SHORT_TEXT" ? (compact ? 2 : 3) : 7}
        error={error}
        hint={hint}
        disabled={disabled}
      />
    );
  if (q.type === "DATE")
    return (
      <Input
        label="Tu respuesta: fecha"
        type="date"
        value={typeof value === "string" ? value : ""}
        min={typeof cfg.min === "string" ? cfg.min : undefined}
        max={typeof cfg.max === "string" ? cfg.max : undefined}
        onChange={(e) => onChange(e.target.value || null)}
        error={error}
        hint={hint}
        disabled={disabled}
      />
    );
  if (q.type === "NUMBER")
    return (
      <Input
        label="Tu respuesta: número"
        type="text"
        inputMode="decimal"
        value={
          typeof value === "number" || typeof value === "string" ? value : ""
        }
        onChange={(e) => onChange(e.target.value || null)}
        error={error}
        hint={hint + " Usa punto decimal; hasta seis decimales."}
        disabled={disabled}
      />
    );
  if (q.type === "MATRIX") {
    const matrix = cfg as {
      rows: { key: string; label: string }[];
      columns: { key: string; label: string }[];
    };
    const values =
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : {};
    return (
      <fieldset disabled={disabled} aria-describedby={id}>
        <legend>Tu respuesta por fila</legend>
        <p id={id} className={error ? "field-error" : "hint"}>
          {error || hint}
        </p>
        <div className="matrix-fields">
          {matrix.rows.map((row) => (
            <Select
              key={row.key}
              label={row.label}
              value={Object.hasOwn(values, row.key) ? values[row.key] : ""}
              onChange={(e) => {
                const next = { ...values };
                if (e.target.value)
                  Object.defineProperty(next, row.key, {
                    value: e.target.value,
                    enumerable: true,
                    configurable: true,
                    writable: true,
                  });
                else delete next[row.key];
                onChange(next);
              }}
            >
              <option value="">Sin selección</option>
              {matrix.columns.map((col) => (
                <option key={col.key} value={col.key}>
                  {col.label}
                </option>
              ))}
            </Select>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <fieldset
      className={
        compact && q.type === "YES_NO" ? "participant-yesno" : undefined
      }
      disabled={disabled}
      aria-describedby={id}
      aria-invalid={!!error}
    >
      <legend>Tu respuesta</legend>
      <p id={id} className={error ? "field-error" : "hint"}>
        {error || hint}
      </p>
      {q.type === "YES_NO" ? (
        <>
          <Radio
            name={id}
            label="Sí"
            checked={value === true}
            onChange={() => onChange(true)}
          />
          <Radio
            name={id}
            label="No"
            checked={value === false}
            onChange={() => onChange(false)}
          />
          {compact ? (
            value !== null && (
              <Button
                className="participant-text-button participant-clear"
                onClick={() => onChange(null)}
              >
                Quitar selección
              </Button>
            )
          ) : (
            <Radio
              name={id}
              label="Sin selección"
              checked={value === null}
              onChange={() => onChange(null)}
            />
          )}
        </>
      ) : q.type === "SINGLE_CHOICE" ? (
        <>
          {compact ? (
            value !== null && (
              <Button
                className="participant-text-button participant-clear"
                onClick={() => onChange(null)}
              >
                Quitar selección
              </Button>
            )
          ) : (
            <Radio
              name={id}
              label="Sin selección"
              checked={value === null}
              onChange={() => onChange(null)}
            />
          )}
          {q.options.map((o) => (
            <Radio
              key={o.value}
              name={id}
              label={o.label}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
          ))}
        </>
      ) : (
        q.options.map((o) => (
          <Checkbox
            key={o.value}
            label={o.label}
            checked={Array.isArray(value) && value.includes(o.value)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...(Array.isArray(value) ? value : []), o.value]
                  : (Array.isArray(value) ? value : []).filter(
                      (v) => v !== o.value,
                    ),
              )
            }
          />
        ))
      )}
    </fieldset>
  );
}
