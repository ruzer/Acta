import { useQuery } from "@tanstack/react-query";
import { responseDeadlineView } from "@requirements/contracts";
import { responseDueLabel } from "../response-deadline-display";
import { exchangeRequest } from "../api";
import { useBranding } from "../branding";
export const responseDeadlineQuery = (projectId: string) => ({
  queryKey: ["response-deadline", projectId],
  queryFn: () =>
    exchangeRequest(projectId, "response-deadline", responseDeadlineView),
  staleTime: 0,
});
export function ResponseDeadline({ projectId }: { projectId: string }) {
  const query = useQuery(responseDeadlineQuery(projectId));
  const { timezone } = useBranding();
  if (query.error) return <p>No se pudo consultar la fecha límite.</p>;
  if (!query.data?.responseDueAt) return null;
  return (
    <p>
      {responseDueLabel(query.data.responseDueAt, timezone)}. Puedes seguir
      respondiendo después del plazo.
    </p>
  );
}
