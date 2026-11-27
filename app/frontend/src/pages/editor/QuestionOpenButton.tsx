import type { QuestionView } from "@requirements/contracts";

export function QuestionOpenButton({
  question,
  current,
  onOpen,
  compact,
}: {
  question: QuestionView;
  current?: boolean;
  compact?: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={"qe-question-link" + (compact ? " qe-compact-row" : "")}
      data-question-id={question.id}
      data-question-opener={question.id}
      aria-current={current ? "true" : undefined}
      onClick={() => onOpen(question.id)}
    >
      <span>{question.question}</span>
      <span aria-hidden="true"> →</span>
    </button>
  );
}
