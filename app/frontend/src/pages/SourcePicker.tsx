import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { ReviewDetail } from "@requirements/contracts";
import { Button, Checkbox } from "../ui";
import { plural } from "../ui/plural";
import { answerText } from "./AnswerControl";

/** From here on a list of sources needs help: the count, "select all" and a hint of each answer. */
export const LONG_SOURCE_LIST = 6;

/**
 * The submissions a decision or a conflict rests on. With a handful it is a
 * plain checklist; with many it says how many are chosen, offers "select all"
 * and shows the start of each answer, so the list can be decided without
 * leaving the dialog to read every contribution.
 */
export function SourcePicker({
  legend,
  hint,
  sources,
  question,
  preselect,
  onChange,
  children,
}: {
  legend: string;
  hint: string;
  sources: ReviewDetail["submissions"];
  question: ReviewDetail["question"];
  /** Start with every source chosen (only meaningful for a single one). */
  preselect: boolean;
  onChange: () => void;
  /** Extra checkboxes that belong to the same fieldset. */
  children?: ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  const prefix = useId();
  const long = sources.length > LONG_SOURCE_LIST;
  const [picked, setPicked] = useState(preselect ? sources.length : 0);
  const count = () =>
    list.current?.querySelectorAll("input:checked").length ?? 0;
  // The submissions can change under an open dialog (a refreshed conflict):
  // the count follows what is really chosen.
  useEffect(() => setPicked(count()), [sources]);
  function setAll(checked: boolean) {
    list.current
      ?.querySelectorAll<HTMLInputElement>('input[name="sources"]')
      .forEach((box) => (box.checked = checked));
    setPicked(count());
    onChange();
  }
  return (
    <fieldset>
      <legend>{legend}</legend>
      <p className="hint">{hint}</p>
      {long && (
        <div className="source-tools">
          <span role="status">
            {plural(picked, "seleccionada", "seleccionadas")} de{" "}
            {sources.length}
          </span>
          {/* Never disabled: pressing one must not take the keyboard focus with it. */}
          <Button tone="secondary" onClick={() => setAll(true)}>
            Seleccionar todas
          </Button>
          <Button tone="secondary" onClick={() => setAll(false)}>
            Quitar selección
          </Button>
        </div>
      )}
      <div
        ref={list}
        className={long ? "source-list source-list-long" : "source-list"}
        onChange={() => setPicked(count())}
      >
        {sources.map((s) => {
          const hintId = `${prefix}-${s.id}`;
          return (
            <div key={s.id} className="source-option">
              <Checkbox
                name="sources"
                value={s.id}
                defaultChecked={preselect}
                aria-describedby={long ? hintId : undefined}
                label={`${s.respondent.displayName} · envío #${s.number}${s.current ? "" : " · histórico"}`}
              />
              {long && (
                <p id={hintId} className="source-answer">
                  {answerText(question, s.answer)}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {children}
    </fieldset>
  );
}
