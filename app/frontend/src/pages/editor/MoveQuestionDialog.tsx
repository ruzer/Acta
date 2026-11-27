import { useState } from "react";
import type { QuestionnaireView, QuestionView } from "@requirements/contracts";
import { api } from "../../api";
import { Button, Dialog, Select, UnavailableValue } from "../../ui";
import { ActionForm } from "../Administration";
import { questionTopicMove } from "./topic-move";

export function MoveQuestionDialog({
  data,
  question,
  projectId,
  onClose,
  onMoved,
}: {
  data: QuestionnaireView;
  question: QuestionView;
  projectId: string;
  onClose: () => void;
  onMoved: (sectionId: string) => void;
}) {
  const [destination, setDestination] = useState("");
  const move = questionTopicMove(data, question);
  return (
    <Dialog title="Cambiar de tema" onClose={onClose}>
      <p>{question.question}</p>
      {move.reason ? (
        <UnavailableValue
          label="Tema al que pertenece"
          value={
            <>
              <span aria-hidden="true">🔒</span>{" "}
              {data.sections.find((s) => s.id === question.sectionId)?.title ??
                "Tema no disponible"}
            </>
          }
          reason={move.reason}
        />
      ) : (
        <>
          {move.notice && <p>{move.notice}</p>}
          <ActionForm
            label="Cambiar de tema"
            onDone={() => onMoved(destination)}
            onSubmit={() => {
              const moved = new Set(move.family.map((q) => q.id));
              const sections = [question.sectionId, destination].map(
                (sectionId) => {
                  const rows = data.questions
                    .filter((q) => q.sectionId === sectionId)
                    .sort((a, b) => a.order - b.order);
                  return {
                    sectionId,
                    expected: rows.map(({ id, order, lockVersion }) => ({
                      id,
                      order,
                      lockVersion,
                    })),
                    orderedIds: [
                      ...rows
                        .filter(
                          (q) =>
                            q.publication !== "ARCHIVED" && !moved.has(q.id),
                        )
                        .map((q) => q.id),
                      ...(sectionId === destination
                        ? move.family.map((q) => q.id)
                        : []),
                    ],
                  };
                },
              );
              return api(
                "reorderQuestions",
                { projectId },
                { expectedVersion: data.structureVersion, sections },
              );
            }}
          >
            <p id="move-topic-reason" className="hint">
              Selecciona un tema de destino distinto del actual.
            </p>
            <Select
              label="Tema de destino"
              name="sectionId"
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              hint="La pregunta y sus seguimientos pasarán al final del tema elegido."
            >
              <option value="" disabled aria-describedby="move-topic-reason">
                Selecciona un tema
              </option>
              {data.sections
                .filter((s) => s.id !== question.sectionId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
            </Select>
          </ActionForm>
        </>
      )}
      <Button tone="secondary" onClick={onClose}>
        Cancelar
      </Button>
    </Dialog>
  );
}
