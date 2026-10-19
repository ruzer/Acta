import { BadRequestException, NotFoundException } from "@nestjs/common";
import type { Tx } from "../common/http.js";

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
