import type { ReviewDetail } from "@requirements/contracts";
import { Button } from "../ui";
import { ThreadInset, ThreadMessage } from "../ui/semantic";
import { dateText, ThreadStatus } from "./ReviewShared";
import type { ReviewAction } from "./ReviewActions";

export type ThreadOpen = (
  action: ReviewAction,
  options: {
    threadId?: string;
    conflictId?: string;
    responseRevisionId?: string;
  },
) => void;

/**
 * A clarification as an exchange glued to the contribution it is about: who
 * asks and who answers (by word), its state, whose turn it is, and the actions
 * that only make sense here.
 */
export function ClarificationThread({
  thread,
  data,
  onAction,
  showTarget = false,
}: {
  thread: ReviewDetail["threads"][number];
  data: ReviewDetail;
  onAction?: ThreadOpen;
  /** In the history the thread is away from its contribution, so it names it. */
  showTarget?: boolean;
}) {
  const submission = data.submissions.find(
    (s) => s.id === thread.responseRevisionId,
  );
  const name = submission?.respondent.displayName ?? "la persona";
  const turn =
    thread.status === "WAITING_ANALYST"
      ? data.canReview
        ? "Te toca a ti: cierra la aclaración o pregunta de nuevo."
        : "En espera de la revisión del equipo analista."
      : thread.status === "WAITING_STAKEHOLDER"
        ? `En espera de la respuesta de ${name}.`
        : null;
  return (
    <ThreadInset
      title={
        showTarget
          ? `Aclaración sobre ${name} · envío #${submission?.number}`
          : `Aclaración · envío #${submission?.number}`
      }
      status={<ThreadStatus status={thread.status} />}
      turn={turn}
      actions={
        data.canReview && thread.status === "WAITING_ANALYST" && onAction ? (
          <>
            <Button
              tone="secondary"
              onClick={() =>
                onAction("closeClarification", { threadId: thread.id })
              }
            >
              Cerrar aclaración
            </Button>
            <Button
              tone="secondary"
              onClick={() =>
                onAction("requestClarification", { threadId: thread.id })
              }
            >
              Preguntar nuevamente
            </Button>
          </>
        ) : undefined
      }
    >
      {thread.messages.map((m) => (
        <ThreadMessage
          key={m.id}
          from={m.author.id === thread.respondentId ? "answers" : "asks"}
          author={m.author.displayName}
          date={dateText(m.createdAt)}
          dateTime={m.createdAt}
        >
          {m.body}
        </ThreadMessage>
      ))}
      {thread.closedAt && (
        <li className="ac-thread-closed">
          <p className="hint">
            Cerrada por {thread.closedBy?.displayName} ·{" "}
            {dateText(thread.closedAt)}. {thread.closeReason}
          </p>
        </li>
      )}
    </ThreadInset>
  );
}
