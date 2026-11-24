import { z } from "zod";
import { useEffect, useLayoutEffect, useRef } from "react";

const prefix = "acta-ux:";
let presentationUser: string | null = null;

const snapshotSchema = z.strictObject({
  version: z.literal(1),
  values: z.record(
    z.string(),
    z.strictObject({
      value: z.number().finite().nonnegative(),
      total: z.number().finite().nonnegative(),
      start: z.number().finite().nonnegative().optional(),
    }),
  ),
});
export type PresentationSnapshot = z.infer<typeof snapshotSchema>["values"];
export function readPresentationSnapshot(
  key: string,
): PresentationSnapshot | null {
  try {
    const parsed = snapshotSchema.safeParse(
      JSON.parse(sessionStorage.getItem(key) ?? "null"),
    );
    return parsed.success ? parsed.data.values : null;
  } catch {
    return null;
  }
}
export function writePresentationSnapshot(
  key: string,
  values: PresentationSnapshot,
) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ version: 1, values }));
  } catch {
    /* Optional presentation memory. */
  }
}

// Session already knows the account. Bar effects read it after the session's
// layout effect, without fetching /me or changing route props.
export function sessionPresentationKey(projectId: string, feature: string) {
  return presentationUser
    ? presentationKey(presentationUser, projectId, feature)
    : null;
}

export function presentationKey(
  userId: string,
  projectId: string,
  feature: string,
) {
  return `${prefix}${encodeURIComponent(userId)}:${encodeURIComponent(projectId)}:${feature}`;
}

export function clearSessionPresentation() {
  try {
    const keys = Array.from({ length: sessionStorage.length }, (_, index) =>
      sessionStorage.key(index),
    );
    for (const key of keys)
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
  } catch {
    // Optional persistence must not prevent closing or recovering the session.
  }
}

// Mounted by Session, so the Enter that changes routes is seen before a lazy
// page mounts. Listeners are removed with Session; there are no module listeners.
let keyboardPresentation = false;
export function presentationUsesKeyboard() {
  return keyboardPresentation;
}
export function usePresentationModality() {
  useEffect(() => {
    const keyboard = () => {
      keyboardPresentation = true;
    };
    const pointer = () => {
      keyboardPresentation = false;
    };
    window.addEventListener("keydown", keyboard, true);
    window.addEventListener("pointerdown", pointer, true);
    return () => {
      window.removeEventListener("keydown", keyboard, true);
      window.removeEventListener("pointerdown", pointer, true);
      keyboardPresentation = false;
    };
  }, []);
}

export function usePresentationSession(
  userId: string | undefined,
  loading: boolean,
  expired: boolean,
) {
  // undefined means no session result yet, null means confirmed signed out.
  const previous = useRef<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    if (loading) return;
    const current = userId ?? null;
    presentationUser = expired ? null : current;
    if (
      expired ||
      current === null ||
      (previous.current !== undefined && previous.current !== current)
    )
      clearSessionPresentation();
    previous.current = current;
    return () => {
      presentationUser = null;
    };
  }, [userId, loading, expired]);
}
