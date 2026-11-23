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
