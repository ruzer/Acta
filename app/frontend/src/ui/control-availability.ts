/** A temporary restriction must say how the person can make progress. */
export type Unavailable = {
  reason: string;
  /** ID of an existing, visible explanation shared by related controls. */
  describedBy?: string;
};

export function requireReason(unavailable?: Unavailable | false) {
  if (!unavailable) return;
  if (
    typeof unavailable.reason !== "string" ||
    !unavailable.reason.trim() ||
    (unavailable.describedBy !== undefined && !unavailable.describedBy.trim())
  ) {
    throw new Error("Un control no disponible debe incluir un motivo visible.");
  }
}

export function descriptionIds(...ids: (string | undefined)[]) {
  return (
    [
      ...new Set(ids.flatMap((id) => id?.split(/\s+/).filter(Boolean) ?? [])),
    ].join(" ") || undefined
  );
}

/** Native disabling is reserved for a request actually in progress. */
export type ControlAvailability = {
  unavailable?: Unavailable | false;
  "aria-disabled"?: never;
} & (
  | { disabled?: false; "aria-busy"?: boolean | "true" | "false" }
  | { disabled: boolean; "aria-busy": boolean | "true" | "false" }
);

export type ReadOnlyAvailability =
  | { readOnly?: false; readOnlyReason?: never }
  | { readOnly: boolean; readOnlyReason: string };

export function requireAvailability(props: {
  disabled?: boolean;
  "aria-busy"?: boolean | "true" | "false";
  "aria-disabled"?: boolean | "true" | "false";
  readOnly?: boolean;
  readOnlyReason?: string;
}) {
  if (
    props.disabled &&
    props["aria-busy"] !== true &&
    props["aria-busy"] !== "true"
  ) {
    throw new Error(
      "Un control disabled debe indicar que está ocupado con aria-busy.",
    );
  }
  if (props["aria-disabled"] === true || props["aria-disabled"] === "true") {
    throw new Error(
      "Usa unavailable con un motivo visible en vez de aria-disabled.",
    );
  }
  if (props.readOnly && !props.readOnlyReason?.trim()) {
    throw new Error("Un valor de solo lectura debe incluir un motivo visible.");
  }
}

export function evidenceDownloadReason(status: string) {
  if (status === "READY") return "";
  if (status === "QUARANTINED")
    return "El archivo está en revisión de seguridad y aún no se puede descargar.";
  if (status === "REJECTED")
    return "El archivo fue rechazado y no se puede descargar.";
  return "El archivo aún no está listo para descargar.";
}
