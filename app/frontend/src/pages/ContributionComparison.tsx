import { useState, type ReactNode } from "react";
import type { ReviewDetail } from "@requirements/contracts";
import { Select } from "../ui";
import { ComparisonTable } from "../ui/semantic";
import { answerText } from "./AnswerControl";
import { dateText, EvidenceList } from "./ReviewShared";

export type ComparedPair = {
  a?: ReviewDetail["submissions"][number];
  b?: ReviewDetail["submissions"][number];
};

/**
 * Presentation only: selecting two sources never records a conflict or decision.
 * The two postures are columns of one table aligned by field, so each field
 * label appears once and neither side gets a colour of its own.
 */
export function ContributionComparison({
  data,
  revisionIds,
  labelSuffix = "",
  footer,
  initialA,
}: {
  data: ReviewDetail;
  revisionIds?: readonly string[];
  /** Contribution to start with on the left (when the comparison starts from one). */
  initialA?: string;
  /** Keeps landmark and control names unique when two comparisons share a page. */
  labelSuffix?: string;
  /** Actions about the compared pair, shown under the table (for example "Pedir aclaración a A"). */
  footer?: (pair: ComparedPair) => ReactNode;
}) {
  const current = data.submissions.filter((s) => s.current);
  const ids = revisionIds ?? current.map((s) => s.id);
  const [chosen, setChosen] = useState<readonly string[]>(
    initialA ? [initialA] : [],
  );
  const a = chosen[0] && ids.includes(chosen[0]) ? chosen[0] : ids[0];
  const b =
    chosen[1] && chosen[1] !== a && ids.includes(chosen[1])
      ? chosen[1]
      : ids.find((id) => id !== a);
  const pair = [a, b];
  // The scope is what can be compared here: every current contribution, or
  // only the sources a conflict links (which may be a subset of the current
  // ones or include historical sources).
  const coversCurrent =
    ids.length === current.length &&
    ids.every((id) => current.some((s) => s.id === id));
  if (ids.length < 2)
    return <p>No hay dos aportaciones disponibles para comparar.</p>;
  const sides = pair.map((id) => data.submissions.find((s) => s.id === id));
  const postureName = (index: number) =>
    `Postura ${index === 0 ? "A" : "B"}${labelSuffix}`;
  const none = (text: string) => <span className="hint">{text}</span>;
  const missing = "El detalle de esta respuesta no está disponible.";
  return (
    <div className="next-comparison">
      <p className="ac-comparison-intro">
        <strong className="next-comparison-count" role="status">
          Comparando 2 de {ids.length}{" "}
          {coversCurrent
            ? "aportaciones vigentes"
            : "fuentes registradas en este conflicto"}
          .
        </strong>{" "}
        <span className="hint">
          {revisionIds ? `Este conflicto vincula ${ids.length} fuentes. ` : ""}
          Comparar no elige una respuesta ganadora ni registra una decisión.
        </span>
      </p>
      <ComparisonTable
        caption={`Comparación de aportaciones${labelSuffix}`}
        columns={sides.map((s, index) => ({
          key: postureName(index),
          label: `${postureName(index)}${s ? ` · ${s.respondent.displayName}` : ""}`,
          head: (
            <div className="ac-posture-head">
              <div className="ac-posture-who">
                <span className="ac-posture-letter" aria-hidden="true">
                  {index === 0 ? "A" : "B"}
                </span>
                <span className="ac-posture-name">
                  <strong>
                    {s?.respondent.displayName ?? "Fuente sin detalle"}
                  </strong>
                  {s && <span>{s.area.name}</span>}
                </span>
              </div>
              {ids.length > 2 && (
                <Select
                  label={`Aportación para postura ${index === 0 ? "A" : "B"}${labelSuffix}`}
                  value={pair[index]}
                  onChange={(e) =>
                    setChosen(
                      index === 0 ? [e.target.value, b!] : [a!, e.target.value],
                    )
                  }
                >
                  {ids.map((id) => {
                    const option = data.submissions.find(
                      (item) => item.id === id,
                    );
                    return (
                      <option
                        key={id}
                        value={id}
                        disabled={id === pair[1 - index]}
                      >
                        {option
                          ? `${option.respondent.displayName} · ${option.area.name} · envío #${option.number}`
                          : "Fuente vinculada sin detalle disponible"}
                      </option>
                    );
                  })}
                </Select>
              )}
            </div>
          ),
        }))}
        rows={[
          {
            id: "answer",
            label: "Respuesta",
            values: sides.map((s) =>
              s ? (
                <p
                  className={
                    "ac-answer" +
                    (["NUMBER", "YES_NO", "DATE"].includes(data.question.type)
                      ? " ac-value"
                      : "")
                  }
                >
                  {answerText(data.question, s.answer)}
                </p>
              ) : (
                <p>{missing}</p>
              ),
            ),
          },
          {
            id: "comment",
            label: "Comentario",
            values: sides.map((s) =>
              s?.comment ? (
                <p className="answer-text">{s.comment}</p>
              ) : (
                none(s ? "Sin comentario adicional." : "—")
              ),
            ),
          },
          {
            id: "example",
            label: "Ejemplo",
            values: sides.map((s) =>
              s?.example ? (
                <p className="answer-text">{s.example}</p>
              ) : (
                none(s ? "Sin ejemplo adicional." : "—")
              ),
            ),
          },
          {
            id: "evidence",
            label: "Evidencia",
            values: sides.map((s) =>
              s ? (
                <EvidenceList revision={s} projectId={data.projectId} />
              ) : (
                none("—")
              ),
            ),
          },
          {
            id: "version",
            label: "Versión",
            values: sides.map((s) =>
              s ? (
                <p className="hint">
                  Envío #{s.number} · {dateText(s.createdAt)} ·{" "}
                  {s.current ? "Vigente" : "Histórico"}
                </p>
              ) : (
                none("—")
              ),
            ),
          },
        ]}
      />
      {footer?.({ a: sides[0], b: sides[1] })}
    </div>
  );
}
