import type { Prisma } from "@prisma/client";

export function snapshotName(
  snapshot: Prisma.JsonValue,
  key: string,
  fallback: string,
): string {
  return snapshot &&
    typeof snapshot === "object" &&
    !Array.isArray(snapshot) &&
    typeof snapshot[key] === "string"
    ? snapshot[key]
    : fallback;
}
