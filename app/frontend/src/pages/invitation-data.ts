import { queryOptions } from "@tanstack/react-query";
import type { InvitationView } from "@requirements/contracts";
import { api } from "../api";

/** The existing endpoint returns 25 invitations per page, without date filters. */
export async function loadProjectInvitations(
  projectId: string,
): Promise<InvitationView[]> {
  const first = await api("invitations", { projectId }, { page: 1 });
  const invitations = new Map(first.items.map((row) => [row.id, row]));
  for (let page = 2; page <= Math.ceil(first.total / 25); page++) {
    const next = await api("invitations", { projectId }, { page });
    if (next.total !== first.total)
      throw new Error(
        "Las invitaciones cambiaron durante la consulta. Actualiza para obtener el conjunto completo.",
      );
    for (const row of next.items) invitations.set(row.id, row);
  }
  if (invitations.size !== first.total)
    throw new Error(
      "No se pudo completar la consulta de invitaciones. Inténtalo nuevamente.",
    );
  return [...invitations.values()];
}

export const invitationQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: ["invitations", projectId, "all"],
    queryFn: () => loadProjectInvitations(projectId),
    staleTime: 0,
  });

export function expiringInvitations(
  invitations: readonly InvitationView[],
  now = Date.now(),
  days = 7,
): InvitationView[] {
  const until = now + days * 86400000;
  return invitations.filter((row) => {
    const expires = Date.parse(row.expiresAt);
    return row.revokedAt === null && expires > now && expires <= until;
  });
}
