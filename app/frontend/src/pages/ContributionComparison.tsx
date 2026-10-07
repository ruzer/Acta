import { Fragment, useState } from "react";
import type { ReviewDetail } from "@requirements/contracts";
import { Select } from "../ui";
import { SubmittedAnswer } from "./ReviewShared";
import "../next-comparison.css";

/** Presentation only: selecting two sources never records a conflict or decision. */
export function ContributionComparison({
  data,
  revisionIds,
}: {
  data: ReviewDetail;
  revisionIds?: readonly string[];
}) {
  const current = data.submissions.filter((s) => s.current);
  const ids = revisionIds ?? current.map((s) => s.id);
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const a = chosen[0] && ids.includes(chosen[0]) ? chosen[0] : ids[0];
  const b =
    chosen[1] && chosen[1] !== a && ids.includes(chosen[1])
      ? chosen[1]
      : ids.find((id) => id !== a);
  const pair = [a, b];
  const allCurrent = ids.every((id) => current.some((s) => s.id === id));
  const total = allCurrent ? current.length : ids.length;
  if (ids.length < 2)
    return <p>No hay dos aportaciones disponibles para comparar.</p>;
  return (
    <div className="next-comparison">
      <p className="next-comparison-count" role="status">
        Comparando 2 de {total}{" "}
        {allCurrent
          ? "aportaciones vigentes"
          : "fuentes registradas en este conflicto"}
        .
      </p>
      <p className="hint">
        {revisionIds ? `Este conflicto vincula ${ids.length} fuentes. ` : ""}
        Comparar no elige una respuesta ganadora ni registra una decisión.
      </p>
      {ids.length > 2 && (
        <div className="next-comparison-selectors">
          {([0, 1] as const).map((position) => (
            <Select
              key={position}
              label={`Aportación para postura ${position === 0 ? "A" : "B"}`}
              value={pair[position]}
              onChange={(e) =>
                setChosen(
                  position === 0 ? [e.target.value, b!] : [a!, e.target.value],
                )
              }
            >
              {ids.map((id) => {
                const s = data.submissions.find((item) => item.id === id);
                return (
                  <option
                    key={id}
                    value={id}
                    disabled={id === pair[1 - position]}
                  >
                    {s
                      ? `${s.respondent.displayName} · ${s.area.name} · envío #${s.number}`
                      : "Fuente vinculada sin detalle disponible"}
                  </option>
                );
              })}
            </Select>
          ))}
        </div>
      )}
      <div className="av-comparison next-comparison-postures">
        {pair.map((id, index) => {
          const s = data.submissions.find((item) => item.id === id);
          const label = index === 0 ? "Postura A" : "Postura B";
          return (
            <Fragment key={label}>
              {index === 1 && (
                <span className="next-comparison-versus" aria-hidden="true">
                  VS
                </span>
              )}
              <section className="av-posture" aria-label={label}>
                <p className="av-kicker">{label}</p>
                {s ? (
                  <>
                    <h4>{s.respondent.displayName}</h4>
                    <p className="av-secondary">{s.area.name}</p>
                    <SubmittedAnswer
                      revision={s}
                      question={data.question}
                      projectId={data.projectId}
                      comparison
                    />
                  </>
                ) : (
                  <p>El detalle de esta respuesta no está disponible.</p>
                )}
              </section>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
