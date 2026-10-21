import { useSyncExternalStore } from "react";

/** Tracks a CSS media query; false where `matchMedia` does not exist (tests, SSR). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      if (typeof matchMedia !== "function") return () => undefined;
      const media = matchMedia(query);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    () => typeof matchMedia === "function" && matchMedia(query).matches,
    () => false,
  );
}
