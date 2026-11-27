import { useId, type ReactNode } from "react";
import { requireReason } from "./control-availability";

/** A value that cannot change in this context is text, not a disabled input. */
export function UnavailableValue({
  label,
  value,
  reason,
}: {
  label: string;
  value: ReactNode;
  reason: string;
}) {
  const id = useId();
  requireReason({ reason });
  return (
    <div
      className="field unavailable-value"
      role="group"
      aria-labelledby={id + "-label"}
      aria-describedby={id + "-reason"}
    >
      <p id={id + "-label"} className="unavailable-value-label">
        {label}
      </p>
      <p className="unavailable-value-content">{value}</p>
      <p id={id + "-reason"} className="hint control-reason">
        {reason}
      </p>
    </div>
  );
}
