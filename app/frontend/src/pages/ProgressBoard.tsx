import { useSearchParams } from "react-router-dom";
import type { z } from "zod";
import type { dashboardView } from "@requirements/contracts";
import "../progress-board.css";

const metrics = [
  { status: "VALIDATED", label: "Validadas" },
  { status: "PARTIAL", label: "Esperando a otras personas" },
  { status: "CLARIFICATION_REQUIRED", label: "Requieren aclaración" },
  { status: "CONFLICT", label: "Conflictos" },
] as const;

export function ProgressBoard({
  data,
}: {
  data: z.infer<typeof dashboardView>;
}) {
  const [params, setParams] = useSearchParams();
  function show(status: (typeof metrics)[number]["status"]) {
    const next = new URLSearchParams(params);
    next.set("status", status);
    next.delete("task");
    setParams(next);
    document
      .getElementById("dashboard-questions")
      ?.scrollIntoView({ behavior: "instant", block: "start" });
  }
  return (
    <section className="pb-board" aria-labelledby="progress-board-title">
      <h2 id="progress-board-title">Avance del proyecto</h2>
      <div
        className="pb-metrics"
        role="group"
        aria-label="Preguntas por estado"
      >
        {metrics.map(({ status, label }) => {
          const count =
            status === "VALIDATED"
              ? data.metrics.validation.numerator
              : (data.states.find((state) => state.status === status)?.count ??
                0);
          const total =
            status === "VALIDATED"
              ? ` de ${data.metrics.validation.denominator}`
              : "";
          return (
            <button
              key={status}
              type="button"
              className="pb-metric"
              aria-pressed={params.get("status") === status}
              aria-label={`${label} ${count}${total}. Ver estas preguntas.`}
              onClick={() => show(status)}
            >
              <span className="pb-metric-label">{label}</span>
              <strong className="pb-metric-number">
                {count}
                {total && <small>{total}</small>}
              </strong>
            </button>
          );
        })}
      </div>
    </section>
  );
}
