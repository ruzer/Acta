import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Tx } from "../common/http.js";

/**
 * Take a shared lock on areas before reading whether they are active. Deactivating an area holds
 * an exclusive lock on its row until it commits, so a writer that is handing work to the area
 * either finishes first (and the deactivation waits for it) or waits and then reads the
 * committed state. Shared locks do not block each other, so writers do not queue behind one
 * another.
 */
export async function lockAreas(tx: Tx, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => !!id))].sort();
  for (const id of unique)
    await tx.$queryRaw`SELECT id FROM "Area" WHERE id=${id}::uuid FOR SHARE`;
}

/**
 * An area is chosen for new work (a question, a member, a bulk change) only while it is active.
 * What already points at an area keeps pointing at it, so an unchanged choice (`current`) is
 * always accepted: deactivating an area never forces edits to what exists.
 */
export async function assignableArea(
  tx: Tx,
  organizationId: string,
  areaId: string,
  current?: string | null,
  field = "responsibleAreaId",
) {
  await lockAreas(tx, [areaId]);
  const area = await tx.area.findFirst({
    where: { id: areaId, organizationId },
  });
  if (!area) throw new NotFoundException("No se encontró el área.");
  if (!area.active && area.id !== current)
    throw new BadRequestException({
      message: "Revisa los campos indicados.",
      fieldErrors: {
        [field]: "Esta área está desactivada. Elige un área activa.",
      },
    });
  return area;
}
