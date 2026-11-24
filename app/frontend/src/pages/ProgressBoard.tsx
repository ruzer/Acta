import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { participationQuery } from "./Participation";
import { z } from "zod";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useMediaQuery } from "../ui/useMediaQuery";
import {
  presentationKey,
  presentationUsesKeyboard,
} from "../session-presentation";
import {
  reviewStates,
  statusLabels,
  type dashboardView,
} from "@requirements/contracts";
import "../progress-board.css";

const metrics = [
  { status: "VALIDATED", label: "Validadas" },
  { status: "PARTIAL", label: "Esperando a otras personas" },
  { status: "CLARIFICATION_REQUIRED", label: "Requieren aclaración" },
  { status: "CONFLICT", label: "Conflictos" },
] as const;

// Presentation order only; the backend remains authoritative for each status.
const stateOrder: Record<(typeof reviewStates)[number], number> = {
  NOT_REVIEWED: 0,
  PENDING: 1,
  PARTIAL: 2,
  CLARIFICATION_REQUIRED: 3,
  CONFLICT: 4,
  ANSWERED: 5,
  NOT_APPLICABLE: 6,
  VALIDATED: 7,
};

const easing = "cubic-bezier(0.22,1,0.36,1)";
const snapshotSchema = z.strictObject({
  version: z.literal(1),
  values: z.record(
    z.string(),
    z.strictObject({
      value: z.number().finite().nonnegative(),
      total: z.number().finite().nonnegative(),
      start: z.number().finite().nonnegative().optional(),
    }),
  ),
});
type Snapshot = z.infer<typeof snapshotSchema>["values"];
function readSnapshot(key: string): Snapshot | null {
  try {
    const parsed = snapshotSchema.safeParse(
      JSON.parse(sessionStorage.getItem(key) ?? "null"),
    );
    return parsed.success ? parsed.data.values : null;
  } catch {
    return null;
  }
}
function progressSnapshot(data: z.infer<typeof dashboardView>): Snapshot {
  const values: Snapshot = {};
  const count = (status: (typeof reviewStates)[number]) =>
    data.states.find((row) => row.status === status)?.count ?? 0;
  for (const { status } of metrics)
    values[`value:${status}`] = {
      value:
        status === "VALIDATED"
          ? data.metrics.validation.numerator
          : count(status),
      total: status === "VALIDATED" ? data.metrics.validation.denominator : 0,
    };
  let start = 0;
  for (const status of reviewStates.toSorted(
    (a, b) => stateOrder[a] - stateOrder[b],
  )) {
    values[`bar:state:${status}`] = {
      value: count(status),
      total: data.metrics.validation.denominator,
      start,
    };
    start += count(status);
  }
  for (const row of data.breakdowns) {
    if (row.dimension !== "section" && row.dimension !== "area") continue;
    values[`bar:${row.dimension}:${row.key}`] = {
      value: row.metrics.validation.numerator,
      total: row.metrics.validation.denominator,
    };
  }
  return values;
}
function barTransform(value: Snapshot[string]) {
  const ratio = value.total ? value.value / value.total : 0;
  return value.start === undefined
    ? `scaleX(${ratio})`
    : `translateX(${value.total ? (value.start / value.total) * 100 : 0}%) scaleX(${ratio})`;
}
// Invert the x coordinate of cubic-bezier(.22,1,.36,1), then evaluate y.
function scrollEase(progress: number) {
  if (progress <= 0) return 0;
  let low = 0,
    high = 1,
    t = progress;
  for (let i = 0; i < 14; i++) {
    t = (low + high) / 2;
    const x =
      3 * (1 - t) ** 2 * t * 0.22 + 3 * (1 - t) * t ** 2 * 0.36 + t ** 3;
    if (x < progress) low = t;
    else high = t;
  }
  return progress >= 1 ? 1 : 1 - (1 - t) ** 3;
}
function revealQuestions(reduced: boolean, keyboard: boolean) {
  const target = document.getElementById("dashboard-questions");
  if (!target) return () => undefined;
  const heading =
    target
      .closest(".ac-attention-content")
      ?.querySelector<HTMLElement>(".ac-attention-group h2") ?? target;
  let frame = 0,
    timeout = 0;
  const outline = document.createElement("span");
  let animation: Animation | undefined;
  const cleanup = () => {
    window.cancelAnimationFrame(frame);
    window.clearTimeout(timeout);
    animation?.cancel();
    outline?.remove();
    heading.classList.remove("pb-list-emphasis", "pb-changed");
  };
  if (reduced || keyboard) {
    target.scrollIntoView({ behavior: "instant", block: "start" });
    if (reduced) {
      heading.classList.add("pb-changed");
      timeout = window.setTimeout(
        () => heading.classList.remove("pb-changed"),
        600,
      );
    }
    return cleanup;
  }
  const initial = window.scrollY;
  const destination = Math.max(
    0,
    Math.min(
      initial + target.getBoundingClientRect().top,
      document.documentElement.scrollHeight - window.innerHeight,
    ),
  );
  let started: number | undefined;
  const scroll = (now: number) => {
    started ??= now;
    const progress = Math.min((now - started) / 250, 1);
    window.scrollTo({
      top: initial + (destination - initial) * scrollEase(progress),
      behavior: "instant",
    });
    if (progress < 1) frame = window.requestAnimationFrame(scroll);
  };
  frame = window.requestAnimationFrame(scroll);
  heading.classList.add("pb-list-emphasis");
  outline.className = "pb-list-outline";
  outline.setAttribute("aria-hidden", "true");
  heading.append(outline);
  if (outline.animate) {
    animation = outline.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 800,
      easing,
    });
    void animation.finished.then(
      () => {
        outline?.remove();
        heading.classList.remove("pb-list-emphasis");
      },
      () => undefined,
    );
  } else timeout = window.setTimeout(cleanup, 800);
  return cleanup;
}
function useProgressMotion(
  root: RefObject<HTMLElement | null>,
  key: string,
  snapshot: Snapshot,
) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const keyboard = useRef(false);
  const scrollCleanup = useRef<() => void>(() => undefined);
  const visit = useMemo(() => ({ previous: readSnapshot(key) }), [key]);
  useEffect(() => {
    const onKey = () => {
      keyboard.current = true;
      scrollCleanup.current();
    };
    const onPointer = () => {
      keyboard.current = false;
      scrollCleanup.current();
    };
    const cancel = () => scrollCleanup.current();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchstart", cancel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      scrollCleanup.current();
    };
  }, []);
  useEffect(() => {
    const animations: Animation[] = [],
      temporary: HTMLElement[] = [],
      highlights: HTMLElement[] = [];
    let timeout = 0;
    // Defer one frame so StrictMode's rehearsal cannot consume the saved visit.
    const frame = window.requestAnimationFrame(() => {
      const previous = visit.previous;
      visit.previous = snapshot;
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({ version: 1, values: snapshot }),
        );
      } catch {
        /* Optional presentation memory. */
      }
      if (!previous || !root.current) return;
      const byKeyboard =
        presentationUsesKeyboard() ||
        keyboard.current ||
        document.activeElement?.matches(
          ":focus-visible:not(h1):not(main):not(body)",
        );
      const animate = (
        element: HTMLElement,
        frames: Keyframe[],
        duration: number,
      ) => {
        if (!element.animate) return;
        const animation = element.animate(frames, { duration, easing });
        animations.push(animation);
        void animation.finished.catch(() => undefined);
        return animation;
      };
      const emphasis = new Map(
        [
          ...root.current.querySelectorAll<HTMLElement>("[data-pb-highlight]"),
        ].map((node) => [node.dataset.pbHighlight, node]),
      );
      for (const node of root.current.querySelectorAll<HTMLElement>(
        "[data-pb-motion]",
      )) {
        const id = node.dataset.pbMotion!;
        const old = previous[id],
          current = snapshot[id];
        if (
          !old ||
          !current ||
          (old.value === current.value && old.total === current.total)
        )
          continue;
        if (reduced) {
          const highlight =
            emphasis.get(id) ?? node.closest<HTMLElement>("button,li") ?? node;
          highlight.classList.add("pb-changed");
          highlights.push(highlight);
        } else if (!byKeyboard) {
          if (id.startsWith("bar:"))
            animate(
              node,
              [
                { transform: barTransform(old) },
                { transform: barTransform(current) },
              ],
              380,
            );
          else if (id === "value:VALIDATED") {
            const before = document.createElement("span");
            before.className = "pb-previous-number";
            before.setAttribute("aria-hidden", "true");
            before.textContent = String(old.value);
            const total = document.createElement("small");
            total.textContent = ` de ${old.total}`;
            before.append(total);
            node.parentElement?.append(before);
            temporary.push(before);
            animate(
              node,
              [
                { transform: "translateY(8px)", opacity: 0 },
                { transform: "translateY(0)", opacity: 1 },
              ],
              250,
            );
            const outgoing = animate(
              before,
              [
                { transform: "translateY(0)", opacity: 1 },
                { transform: "translateY(-8px)", opacity: 0 },
              ],
              250,
            );
            if (outgoing)
              void outgoing.finished.then(
                () => before.remove(),
                () => before.remove(),
              );
            else before.remove();
          }
        }
      }
      if (highlights.length)
        timeout = window.setTimeout(
          () =>
            highlights.forEach((node) => node.classList.remove("pb-changed")),
          600,
        );
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      animations.forEach((animation) => animation.cancel());
      temporary.forEach((node) => node.remove());
      highlights.forEach((node) => node.classList.remove("pb-changed"));
    };
  }, [key, snapshot, visit, reduced, root]);
  return (fromKeyboard: boolean) => {
    scrollCleanup.current();
    // setParams replaces the question groups. Wait for that commit before
    // selecting its heading, including the instant/reduced-motion path.
    const frame = window.requestAnimationFrame(() => {
      scrollCleanup.current = revealQuestions(reduced, fromKeyboard);
    });
    scrollCleanup.current = () => window.cancelAnimationFrame(frame);
  };
}

export function ProgressBoard({
  data,
  projectId,
  userId,
}: {
  data: z.infer<typeof dashboardView>;
  projectId: string;
  userId: string;
}) {
  const [params, setParams] = useSearchParams();
  const board = useRef<HTMLElement>(null);
  const snapshot = useMemo(() => progressSnapshot(data), [data]);
  const reveal = useProgressMotion(
    board,
    presentationKey(userId, projectId, "progress"),
    snapshot,
  );
  // ParticipationCard owns the existing request. Observe its cache without
  // fetching a second time or adding another retry control to the dashboard.
  const participation = useQuery({
    ...participationQuery(projectId),
    enabled: false,
  });
  const blockers = (participation.data?.participants ?? [])
    .filter((person) => person.pending > 0)
    .sort(
      (a, b) =>
        b.pending - a.pending ||
        a.name.localeCompare(b.name, "es-MX") ||
        a.memberId.localeCompare(b.memberId),
    )
    .slice(0, 5);
  const states = reviewStates
    .toSorted((a, b) => stateOrder[a] - stateOrder[b])
    .map((status) => ({
      status,
      count: data.states.find((item) => item.status === status)?.count ?? 0,
    }));
  const totalQuestions = data.metrics.validation.denominator;
  let offset = 0;
  const segments = states.map((state) => {
    const start = offset;
    offset += state.count;
    return {
      ...state,
      start: totalQuestions ? start / totalQuestions : 0,
      ratio: totalQuestions ? state.count / totalQuestions : 0,
    };
  });
  function show(status: (typeof metrics)[number]["status"], keyboard: boolean) {
    const next = new URLSearchParams(params);
    next.set("status", status);
    next.delete("task");
    setParams(next);
    reveal(keyboard);
  }
  return (
    <section
      ref={board}
      className="pb-board"
      aria-labelledby="progress-board-title"
    >
      <h2 id="progress-board-title">Avance del proyecto</h2>
      <p className="sr-only" role="status" aria-live="polite">
        {metrics
          .map(
            ({ status, label }) =>
              `${label}: ${snapshot[`value:${status}`]!.value}`,
          )
          .join(". ")}
      </p>
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
              onClick={(event) => show(status, event.detail === 0)}
            >
              <span className="pb-metric-label">{label}</span>{" "}
              <strong className="pb-metric-number">
                <span
                  className="pb-number-current"
                  data-pb-motion={`value:${status}`}
                >
                  {count}
                  {total && <small>{total}</small>}
                </span>
              </strong>
            </button>
          );
        })}
      </div>
      <p className="pb-submission">
        <span>Con al menos una respuesta</span>{" "}
        <strong>
          {data.metrics.submission.numerator} de{" "}
          {data.metrics.submission.denominator}
        </strong>{" "}
        ·{" "}
        {data.metrics.submission.percentage === null
          ? "Sin preguntas"
          : `${data.metrics.submission.percentage.toLocaleString("es-MX")} %`}
      </p>
      <div className="pb-state-summary">
        {totalQuestions === 0 && <p>Aún no hay preguntas publicadas.</p>}
        <div
          className="pb-stack"
          role="img"
          aria-label={`${totalQuestions ? `Estados de ${totalQuestions} preguntas` : "No hay preguntas publicadas"}. ${states.map((state) => `${statusLabels[state.status]}: ${state.count}`).join("; ")}.`}
        >
          {segments.map((state) => (
            <span
              key={state.status}
              className={`pb-stack-segment pb-state pb-state-${state.status}`}
              data-pb-motion={`bar:state:${state.status}`}
              style={{
                transform: `translateX(${state.start * 100}%) scaleX(${state.ratio})`,
              }}
              aria-hidden="true"
            />
          ))}
        </div>
        <ul className="pb-legend" aria-label="Estados de las preguntas">
          {states.map((state) => (
            <li
              key={state.status}
              data-pb-highlight={`bar:state:${state.status}`}
            >
              <span
                className={`pb-state pb-state-${state.status}`}
                aria-hidden="true"
              />
              <span>{statusLabels[state.status]}</span>
              <strong>{state.count}</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="pb-breakdowns">
        {(
          [
            {
              dimension: "section",
              label: "Por tema",
              empty: "No hay temas con preguntas publicadas.",
            },
            {
              dimension: "area",
              label: "Por área",
              empty: "No hay áreas con preguntas publicadas.",
            },
          ] as const
        ).map((group) => {
          const rows = data.breakdowns.filter(
            (row) => row.dimension === group.dimension,
          );
          return (
            <details key={group.dimension} className="pb-breakdown">
              <summary>
                {group.label}
                <span>({rows.length})</span>
              </summary>
              <section aria-label={group.label}>
                {!rows.length ? (
                  <p>{group.empty}</p>
                ) : (
                  <ul>
                    {rows.map((row) => {
                      const value = row.metrics.validation;
                      const ratio = value.denominator
                        ? value.numerator / value.denominator
                        : 0;
                      return (
                        <li key={row.key} data-pb-breakdown={row.key}>
                          <div className="pb-breakdown-label">
                            <span>{row.label}</span>
                            <span className="pb-breakdown-value">
                              {value.numerator} de {value.denominator} ·{" "}
                              {value.percentage === null
                                ? "Sin preguntas"
                                : `${value.percentage.toLocaleString("es-MX")} %`}
                            </span>
                          </div>
                          <div className="pb-track" aria-hidden="true">
                            <span
                              className="pb-fill"
                              data-pb-motion={`bar:${group.dimension}:${row.key}`}
                              style={{ transform: `scaleX(${ratio})` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </details>
          );
        })}
      </div>
      <section
        className="pb-blockers"
        aria-labelledby="progress-blockers-title"
      >
        <h3 id="progress-blockers-title">Qué me bloquea</h3>
        {participation.error ? (
          <p>
            No se pudieron consultar los pendientes. Abre Participación para
            volver a intentarlo.
          </p>
        ) : participation.isPending ? (
          <p role="status">Consultando participación…</p>
        ) : blockers.length ? (
          <>
            <p>Preguntas obligatorias pendientes por persona.</p>
            <ol>
              {blockers.map((person) => (
                <li key={person.memberId}>
                  <span>{person.name}</span>
                  <strong>
                    {person.pending}
                    <span className="sr-only">
                      {" "}
                      preguntas obligatorias pendientes
                    </span>
                  </strong>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p>Nadie tiene preguntas obligatorias pendientes.</p>
        )}
        <Link to={`/projects/${projectId}/participation`}>
          Ver participación
        </Link>
      </section>
    </section>
  );
}
