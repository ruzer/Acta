import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type ComponentProps,
} from "react";
export function Button({
  tone = "primary",
  ...p
}: ComponentProps<"button"> & {
  tone?: "primary" | "secondary" | "tertiary" | "danger";
}) {
  return <button type="button" className={"button " + tone} {...p} />;
}
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string, description: string | undefined) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id, hint || error ? id + "-help" : undefined)}
      {(hint || error) && (
        <p id={id + "-help"} className={error ? "field-error" : "hint"}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
export function Input({
  label,
  hint,
  error,
  ...p
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, d) => (
        <input id={id} aria-describedby={d} aria-invalid={!!error} {...p} />
      )}
    </Field>
  );
}
export function Select({
  label,
  hint,
  error,
  ...p
}: ComponentProps<"select"> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, d) => (
        <select id={id} aria-describedby={d} aria-invalid={!!error} {...p} />
      )}
    </Field>
  );
}
export function Textarea({
  label,
  hint,
  error,
  ...p
}: ComponentProps<"textarea"> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, d) => (
        <textarea
          id={id}
          aria-describedby={d}
          aria-invalid={!!error}
          rows={3}
          {...p}
        />
      )}
    </Field>
  );
}
export function Checkbox({
  label,
  ...p
}: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="check">
      <input type="checkbox" {...p} />
      <span>{label}</span>
    </label>
  );
}
export function Radio({
  label,
  ...p
}: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="check">
      <input type="radio" {...p} />
      <span>{label}</span>
    </label>
  );
}
export function StatusBadge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function Progress({
  label,
  value,
  max = 100,
}: {
  label: string;
  value: number;
  max?: number;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <progress id={id} value={value} max={max} />
    </div>
  );
}
export function Alert({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={"alert " + (error ? "error" : "")}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function LoadingState() {
  return (
    <p role="status" className="loading">
      Cargando información…
    </p>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <Alert error>
      <p>{error.message}</p>
      {retry && (
        <Button tone="secondary" onClick={retry}>
          Volver a intentar
        </Button>
      )}
    </Alert>
  );
}
export function Table({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
export type DataColumn = {
  label: string;
  /** The first column (who/what the row is) and actions need no label when stacked. */
  bare?: boolean;
  /** Right-aligned, for actions. */
  end?: boolean;
};
/**
 * A data table that stacks into labelled cards on narrow screens. The roles
 * are explicit because changing `display` drops table semantics in some
 * browsers, and the stacked layout must keep them.
 */
export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: DataColumn[];
  rows: { key: string; cells: ReactNode[] }[];
}) {
  return (
    <div className="table-scroll data-table">
      <table role="table">
        <caption className="sr-only">{caption}</caption>
        <thead role="rowgroup">
          <tr role="row">
            {columns.map((c) => (
              <th
                key={c.label}
                role="columnheader"
                scope="col"
                data-end={c.end ? "" : undefined}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row) => (
            <tr key={row.key} role="row">
              {row.cells.map((cell, i) => (
                <td
                  key={columns[i]!.label}
                  role="cell"
                  data-label={columns[i]!.bare ? undefined : columns[i]!.label}
                  data-end={columns[i]!.end ? "" : undefined}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    el?.showModal();
    return () => {
      el?.close();
      // A dialog React removes from the page does not hand focus back by
      // itself: return it to what opened it, unless the caller already moved it.
      const active = document.activeElement;
      if (
        opener?.isConnected &&
        (!active || active === document.body || el?.contains(active))
      )
        opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-head">
        <h2 id={id}>{title}</h2>
        <Button tone="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
