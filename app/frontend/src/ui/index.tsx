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
}: ComponentProps<"button"> & { tone?: "primary" | "secondary" | "danger" }) {
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
        <caption>{caption}</caption>
        {children}
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
    el?.showModal();
    return () => el?.close();
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
      {children}
    </dialog>
  );
}
