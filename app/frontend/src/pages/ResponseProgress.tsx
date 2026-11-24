import { useMemo, useRef } from "react";
import { useBarMotion, progressRatio } from "../ui/useBarMotion";
import { useQuery } from "@tanstack/react-query";
import type { PersonalProjectView } from "@requirements/contracts";
import {
  activeParticipantQuestions,
  participantProgress,
} from "./participant-progress";

export function ResponseProgress({
  projectId,
  id,
  position: fallbackPosition,
  total: fallbackTotal,
}: {
  projectId: string;
  id: string;
  position: number;
  total: number;
}) {
  // La cabecera ya obtiene Mi trabajo. Esta vista solo observa esa caché: no añade una lectura.
  const { data } = useQuery<PersonalProjectView>({
    queryKey: ["my-work", projectId],
    enabled: false,
  });
  const items = data?.sections.flatMap((s) => s.questions);
  const active = items ? activeParticipantQuestions(items) : undefined;
  const progress = items ? participantProgress(items) : undefined;
  const total = active?.length ?? fallbackTotal;
  const position = active
    ? active.findIndex((q) => q.id === id) + 1
    : fallbackPosition;
  const bar = useRef<HTMLDivElement>(null);
  const snapshot = useMemo(
    () => ({
      position: { value: Math.max(0, position - 1), total: Math.max(0, total) },
    }),
    [position, total],
  );
  useBarMotion(bar, { projectId, bar: "position" }, snapshot);
  return (
    <>
      <div className="participant-response-summary">
        <span className="participant-step-meta">
          {position
            ? `Pregunta ${position} de ${total}`
            : "Fuera del recorrido actual"}
        </span>
        {progress && (
          <span>
            {progress.sent} de {progress.total} enviadas
          </span>
        )}
      </div>
      <div
        ref={bar}
        className="participant-progress"
        role="progressbar"
        aria-label="Posición en el cuestionario"
        aria-valuetext={`Pregunta ${position} de ${total}. La posición no indica cuántas respuestas has enviado.`}
        aria-valuemin={0}
        aria-valuemax={Math.max(1, total)}
        aria-valuenow={Math.max(0, position - 1)}
      >
        <span
          className="participant-position-fill"
          data-bar-part="position"
          style={{
            transform: `scaleX(${progressRatio(Math.max(0, position - 1), total)})`,
          }}
        />
      </div>
    </>
  );
}
