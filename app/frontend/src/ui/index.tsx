import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ComponentProps,
} from "react";
import {
  descriptionIds,
  requireReason,
  type Unavailable,
} from "./control-availability";
export { UnavailableValue } from "./UnavailableValue";
export function Button({
  tone = "primary",
  unavailable,
  onClick,
  onKeyDown,
  "aria-describedby": describedBy,
  ...p
}: ComponentProps<"button"> & {
  tone?: "primary" | "secondary" | "tertiary" | "danger";
  unavailable?: Unavailable | false;
}) {
  const id = useId();
  requireReason(unavailable);
  const reasonId = unavailable
    ? unavailable.describedBy || id + "-reason"
    : undefined;
  return (
    <>
      <button
        type="button"
        className={"button " + tone}
        {...p}
        aria-disabled={unavailable ? true : p["aria-disabled"]}
        aria-describedby={descriptionIds(reasonId, describedBy)}
        onClick={(event) => {
          if (unavailable) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }}
        onKeyDown={(event) => {
          if (unavailable && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onKeyDown?.(event);
        }}
      />
      {unavailable && !unavailable.describedBy && (
        <span id={reasonId} className="hint control-reason">
          {unavailable.reason}
        </span>
      )}
    </>
  );
}
export function Field({
  label,
  hint,
  error,
  unavailable,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  unavailable?: Unavailable | false;
  children: (id: string, description: string | undefined) => ReactNode;
}) {
  const id = useId();
  requireReason(unavailable);
  const reasonId = unavailable
    ? unavailable.describedBy || id + "-reason"
    : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(
        id,
        descriptionIds(
          hint || error ? id + "-help" : undefined,
          unavailable && hint && error ? id + "-hint" : undefined,
          reasonId,
        ),
      )}
      {(hint || error) && (
        <p id={id + "-help"} className={error ? "field-error" : "hint"}>
          {error || hint}
        </p>
      )}
      {unavailable && hint && error && (
        <p id={id + "-hint"} className="hint">
          {hint}
        </p>
      )}
      {unavailable && !unavailable.describedBy && (
        <p id={reasonId} className="hint control-reason">
          {unavailable.reason}
        </p>
      )}
    </div>
  );
}
export function Input({
  label,
  hint,
  error,
  unavailable,
  "aria-describedby": describedBy,
  ...p
}: ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string;
  unavailable?: Unavailable | false;
}) {
  return (
    <Field label={label} hint={hint} error={error} unavailable={unavailable}>
      {(id, d) => (
        <input
          id={id}
          aria-invalid={!!error}
          {...p}
          disabled={!!unavailable || p.disabled}
          aria-describedby={descriptionIds(d, describedBy)}
        />
      )}
    </Field>
  );
}
export function PasswordInput({
  label,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { label: string }) {
  const [shown, setShown] = useState(false);
  const action = shown ? "Ocultar contraseña" : "Mostrar contraseña";
  const context =
    {
      "Contraseña actual": ": actual",
      "Nueva contraseña": ": nueva",
      "Repetir nueva contraseña": ": confirmación",
    }[label] ?? "";
  return (
    <>
      <Input {...props} label={label} type={shown ? "text" : "password"} />
      <Button
        tone="tertiary"
        aria-pressed={shown}
        aria-label={action + context}
        onClick={() => setShown(!shown)}
      >
        {action}
      </Button>
    </>
  );
}
export function Select({
  label,
  hint,
  error,
  unavailable,
  "aria-describedby": describedBy,
  ...p
}: ComponentProps<"select"> & {
  label: string;
  hint?: string;
  error?: string;
  unavailable?: Unavailable | false;
}) {
  return (
    <Field label={label} hint={hint} error={error} unavailable={unavailable}>
      {(id, d) => (
        <select
          id={id}
          aria-invalid={!!error}
          {...p}
          disabled={!!unavailable || p.disabled}
          aria-describedby={descriptionIds(d, describedBy)}
        />
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
  action,
}: {
  title: string;
  children?: ReactNode;
  /** The one thing to do next, kept inside the card it belongs to. */
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p>{children}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
export function LoadingState({ skeleton = false }: { skeleton?: boolean }) {
  if (skeleton)
    return (
      <div role="status" aria-busy="true" className="loading-skeleton">
        <span className="sr-only">Cargando información…</span>
        <div aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
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
      {"status" in error && error.status === 403 ? (
        <a className="button primary" href="/">
          Ir a Mis proyectos
        </a>
      ) : (
        retry && (
          <Button tone="secondary" onClick={retry}>
            Volver a intentar
          </Button>
        )
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
    // A form says where to start: a field marked data-autofocus takes the focus
    // instead of the first control in the dialog (the close button).
    el?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
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
