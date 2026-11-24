import { useId } from "react";
import { ResponseContent, ResponseQuestionView } from "@requirements/contracts";
import { Button, Checkbox, Input, Radio, Select, Textarea } from "../ui";
type Value = ResponseContent["answer"];
export { answerText } from "@requirements/contracts";
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
  if (q.type === "SHORT_TEXT" || q.type === "LONG_TEXT") {
    const text = typeof value === "string" ? value : "";
    const maximum = Number(
      cfg.maxLength ?? (q.type === "SHORT_TEXT" ? 500 : 10000),
    );
    const showCount = q.type === "SHORT_TEXT" || text.length >= maximum * 0.8;
    return (
      <>
        <Textarea
          label="Tu respuesta"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maximum}
          rows={q.type === "SHORT_TEXT" ? (compact ? 2 : 3) : 7}
          error={error}
          hint={hint}
          disabled={disabled}
        />
        {showCount && (
          <p className="hint">
            {text.length}/{maximum} caracteres
          </p>
        )}
        <p
          className={text.length >= maximum ? "hint" : "sr-only"}
          aria-live="polite"
        >
          {text.length >= maximum
            ? `Llegaste al máximo de ${maximum} caracteres.`
            : ""}
        </p>
      </>
    );
  }
  if (q.type === "DATE") {
    const calendar = (date: string) => date.split("-").reverse().join("/");
    const bounds = [
      typeof cfg.min === "string" ? `Desde el ${calendar(cfg.min)}.` : "",
      typeof cfg.max === "string" ? `Hasta el ${calendar(cfg.max)}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <>
        <Input
          label="Tu respuesta: fecha"
          type="date"
          value={typeof value === "string" ? value : ""}
          min={typeof cfg.min === "string" ? cfg.min : undefined}
          max={typeof cfg.max === "string" ? cfg.max : undefined}
          onChange={(e) => onChange(e.target.value || null)}
          error={error}
          hint={[hint, bounds].filter(Boolean).join(" ")}
          disabled={disabled}
        />
        {error && bounds && <p className="hint">{bounds}</p>}
      </>
    );
  }
  if (q.type === "NUMBER") {
    const bounds = [
      typeof cfg.min === "number" ? `Mínimo: ${cfg.min}.` : "",
      typeof cfg.max === "number" ? `Máximo: ${cfg.max}.` : "",
      cfg.integer === true ? "Solo números enteros." : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <>
        <Input
          label="Tu respuesta: número"
          type="text"
          inputMode="decimal"
          value={
            typeof value === "number" || typeof value === "string" ? value : ""
          }
          onChange={(e) => onChange(e.target.value || null)}
          error={error}
          hint={[
            hint,
            bounds,
            cfg.integer === true
              ? ""
              : "Usa punto decimal; hasta seis decimales.",
          ]
            .filter(Boolean)
            .join(" ")}
          disabled={disabled}
        />
        {error && bounds && <p className="hint">{bounds}</p>}
      </>
    );
  }
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
  const selected = Array.isArray(value) ? value : [];
  const maximum = Number(cfg.maxSelections ?? q.options.length);
  const minimum = Number(cfg.minSelections ?? 0);
  const atMaximum = q.type === "MULTIPLE_CHOICE" && selected.length >= maximum;
  const selectionRule =
    minimum > 0
      ? `Elige de ${minimum} a ${maximum} opciones.`
      : `Elige hasta ${maximum} ${maximum === 1 ? "opción" : "opciones"}.`;
  return (
    <fieldset
      className={
        compact && q.type === "YES_NO" ? "participant-yesno" : undefined
      }
      disabled={disabled}
      aria-describedby={
        q.type === "MULTIPLE_CHOICE"
          ? `${id} ${id}-rules ${id}-count${atMaximum ? ` ${id}-maximum` : ""}`
          : id
      }
      aria-invalid={!!error}
    >
      <legend>Tu respuesta</legend>
      <p id={id} className={error ? "field-error" : "hint"}>
        {error || hint}
      </p>
      {q.type === "MULTIPLE_CHOICE" && (
        <>
          <p id={id + "-rules"} className="hint">
            {selectionRule}
          </p>
          <p id={id + "-count"} className="hint" aria-live="polite">
            Marcadas {selected.length} de {maximum}
          </p>
          {atMaximum && (
            <p id={id + "-maximum"} className="hint">
              Quita una opción para elegir otra.
            </p>
          )}
        </>
      )}
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
            disabled={atMaximum && !selected.includes(o.value)}
            aria-describedby={atMaximum ? id + "-maximum" : undefined}
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
