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
