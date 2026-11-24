import { Link } from "react-router-dom";
import { reviewStates } from "@requirements/contracts";
import type { useReviewQueue } from "../use-review-queue";
import { queuePath } from "../review-queue";
import { reviewLabels } from "./ReviewShared";
import { Alert } from "../ui";
import "../review-queue.css";

export function ReviewQueueNav({
  queue,
}: {
  queue: ReturnType<typeof useReviewQueue>;
}) {
  if (!queue.enabled) return null;
  const { q, position, token, search } = queue;
  const status = new URLSearchParams(search).get("status");
  const label = reviewStates.find((value) => value === status);
  const name = label ? reviewLabels[label] : "Lista filtrada";
  return (
    <section className="review-queue" aria-label="Lista de revisión">
      {q.isPending ? (
        <p role="status">Preparando la lista de preguntas…</p>
      ) : q.error ? (
        <Alert error>
          {q.error instanceof Error
            ? q.error.message
            : "No se pudo preparar la lista."}{" "}
          <Link to={`/review?${search}`}>Volver a la bandeja</Link>
        </Alert>
      ) : !position ? (
        <p>
          Esta pregunta ya no estaba en la lista al abrirla.{" "}
          <Link to={`/review?${search}`}>Volver a la bandeja</Link>
        </p>
      ) : (
        <>
          <p role="status" aria-live="polite">
            Pregunta {position.index + 1} de {position.total} en «{name}»
          </p>
          <nav className="actions" aria-label="Preguntas de esta lista">
            {position.previous ? (
              <Link
                className="button secondary"
                to={queuePath(position.previous, token, search)}
                state={{ reviewSearch: search }}
                aria-label={`Anterior: pregunta ${position.index} de ${position.total} en ${name}`}
              >
                ‹ Anterior
              </Link>
            ) : (
              <span>Primera pregunta</span>
            )}
            {position.next ? (
              <Link
                className="button secondary"
                to={queuePath(position.next, token, search)}
                state={{ reviewSearch: search }}
                aria-label={`Siguiente: pregunta ${position.index + 2} de ${position.total} en ${name}`}
              >
                Siguiente ›
              </Link>
            ) : (
              <span>Última pregunta</span>
            )}
          </nav>
          <p className="hint">
            Se conserva el orden de la lista al abrirla, aunque cambien los
            estados. Vuelve a la bandeja para actualizarla.
          </p>
        </>
      )}
    </section>
  );
}
