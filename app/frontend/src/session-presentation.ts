import { useEffect, useLayoutEffect, useRef } from "react";

const prefix = "acta-ux:";

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
    if (
      expired ||
      current === null ||
      (previous.current !== undefined && previous.current !== current)
    )
      clearSessionPresentation();
    previous.current = current;
  }, [userId, loading, expired]);
}
