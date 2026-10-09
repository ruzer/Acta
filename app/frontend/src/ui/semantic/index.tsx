import {
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { ParticipantIcon } from "../../pages/ParticipantIcon";

export type StatusTone = "neutral" | "info" | "warning" | "danger" | "success";
const statusIcons = {
  neutral: "clock",
  info: "info",
  warning: "help",
  danger: "flag",
  success: "check",
};

/** Labels come from the existing domain/presentation dictionaries, never color alone. */
export function StatusChip({
  tone = "neutral",
  children,
  icon,
}: {
  tone?: StatusTone;
  children: ReactNode;
  icon?: string;
}) {
  return (
    <span className={`ac-status ac-status-${tone}`}>
      <ParticipantIcon name={icon ?? statusIcons[tone]} />
      <span>{children}</span>
    </span>
  );
}

export function MetaLine({ items }: { items: ReactNode[] }) {
  return (
    <ul className="ac-meta">
      {items
        .filter((item) => item !== null && item !== undefined && item !== false)
        .map((item, index) => (
          <li key={index}>{item}</li>
        ))}
    </ul>
  );
}

export function QuestionBand({
  question,
  title,
  metadata,
  headingRef,
}: {
  question: string;
  title?: string;
  metadata?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <header className="ac-question-band">
      {title && <p className="ac-overline">{title}</p>}
      <h1 ref={headingRef} tabIndex={-1}>
        {question}
      </h1>
      {metadata}
    </header>
  );
}

export function StateCard({
  title,
  status,
  children,
  action,
  otherActions,
}: {
  title: string;
  status?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  otherActions?: ReactNode;
}) {
  const id = useId();
  return (
    <section className="ac-state-card" aria-labelledby={id}>
      <div className="ac-state-copy">
        {status}
        <h2 id={id}>{title}</h2>
        {children}
      </div>
      {(action || otherActions) && (
        <div className="ac-state-actions">
          {action}
          {otherActions}
        </div>
      )}
    </section>
  );
}

type Tab = {
  value: string;
  label: string;
  /** Decorative cue shown inside the tab; the name stays the label. */
  indicator?: ReactNode;
  /** Announced as the tab's description, never part of its name. */
  description?: string;
};
export function TabNav({
  id,
  label,
  items,
  value,
  onChange,
}: {
  id: string;
  label: string;
  items: Tab[];
  value: string;
  onChange: (value: string) => void;
}) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  function navigate(event: KeyboardEvent, index: number) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % items.length
        : event.key === "ArrowLeft"
          ? (index - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : null;
    if (next === null) return;
    const item = items[next];
    if (!item) return;
    event.preventDefault();
    onChange(item.value);
    buttons.current.get(item.value)?.focus();
  }
  return (
    <div className="ac-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          type="button"
          key={item.value}
          id={`${id}-tab-${item.value}`}
          role="tab"
          aria-selected={value === item.value}
          aria-controls={`${id}-panel-${item.value}`}
          aria-description={item.description}
          tabIndex={value === item.value ? 0 : -1}
          ref={(element) => {
            if (element) buttons.current.set(item.value, element);
            else buttons.current.delete(item.value);
          }}
          onKeyDown={(event) => navigate(event, index)}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.indicator}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({
  id,
  value,
  active,
  children,
}: {
  id: string;
  value: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={`${id}-panel-${value}`}
      role="tabpanel"
      aria-labelledby={`${id}-tab-${value}`}
      hidden={!active}
      tabIndex={0}
    >
      {children}
    </section>
  );
}

export function ContributionRail({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: {
    id: string;
    content: ReactNode;
    label?: string;
    buttonRef?: (element: HTMLButtonElement | null) => void;
  }[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  function navigate(event: KeyboardEvent, index: number) {
    const next =
      event.key === "ArrowDown"
        ? (index + 1) % items.length
        : event.key === "ArrowUp"
          ? (index - 1 + items.length) % items.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : null;
    if (next === null) return;
    const item = items[next];
    if (!item) return;
    event.preventDefault();
    refs.current.get(item.id)?.focus();
  }
  return (
    <aside className="ac-contribution-rail" aria-label={label}>
      <ul aria-label={label}>
        {items.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              aria-label={item.label}
              aria-pressed={selected === item.id}
              onKeyDown={(event) => navigate(event, index)}
              onClick={() => onSelect(item.id)}
              ref={(element) => {
                if (element) refs.current.set(item.id, element);
                else refs.current.delete(item.id);
                item.buttonRef?.(element);
              }}
            >
              {item.content}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function ContributionPane({
  title,
  metadata,
  actions,
  children,
  headingRef,
}: {
  title: ReactNode;
  metadata?: ReactNode;
  /** Actions about this contribution, next to it (for example "Pedir aclaración"). */
  actions?: ReactNode;
  children: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const id = useId();
  return (
    <article className="ac-contribution-pane" aria-labelledby={id}>
      <header>
        <div className="ac-contribution-title">
          <h2 id={id} ref={headingRef} tabIndex={-1}>
            {title}
          </h2>
          {actions && <div className="ac-contribution-actions">{actions}</div>}
        </div>
        {metadata}
      </header>
      <div className="ac-contribution-body">{children}</div>
    </article>
  );
}

export function EvidenceFile({
  name,
  size,
  onDownload,
  disabled = false,
  description,
}: {
  name: string;
  size: string;
  onDownload: () => void;
  disabled?: boolean;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="ac-evidence-file">
      <ParticipantIcon name="paperclip" />
      <div className="ac-evidence-name">
        <strong>{name}</strong>
        <span>{size}</span>
        {description && <span id={id}>{description}</span>}
      </div>
      <button
        type="button"
        className="button tertiary"
        aria-label={`Descargar ${name}`}
        aria-describedby={description ? id : undefined}
        disabled={disabled}
        onClick={onDownload}
      >
        Descargar
      </button>
    </div>
  );
}

/** An exchange glued to the contribution it is about: who asks, who answers, whose turn it is. */
export function ThreadInset({
  title,
  status,
  turn,
  children,
  actions,
}: {
  title: string;
  status?: ReactNode;
  /** Whose turn it is, in words (the chip alone is never the only cue). */
  turn?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const id = useId();
  return (
    <section className="ac-thread-inset" aria-labelledby={id}>
      <header>
        <h3 id={id}>{title}</h3>
        {status}
      </header>
      {turn && <p className="ac-thread-turn">{turn}</p>}
      <ol className="ac-thread-messages">{children}</ol>
      {actions && <div className="ac-thread-actions">{actions}</div>}
    </section>
  );
}

export function ThreadMessage({
  from,
  author,
  date,
  dateTime,
  children,
}: {
  /** "asks" is the review team's question; "answers" is the participant's reply. */
  from: "asks" | "answers";
  author: ReactNode;
  date: ReactNode;
  dateTime?: string;
  children: ReactNode;
}) {
  return (
    <li className={`ac-thread-message ac-thread-${from}`}>
      <p className="ac-thread-byline">
        <strong>{author}</strong>
        <span className="ac-thread-role">
          {from === "asks" ? "Pregunta" : "Respuesta"}
        </span>
        <time dateTime={dateTime}>{date}</time>
      </p>
      <p className="ac-thread-body">{children}</p>
    </li>
  );
}

/**
 * Two equal columns aligned by field: each label appears once per row, the
 * columns carry no per-side colour and below 760 px every field stacks its two
 * values (explicit roles keep the table semantics when the layout changes).
 */
export function ComparisonTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: { key: string; head: ReactNode; label?: string }[];
  rows: { id: string; label: string; values: ReactNode[] }[];
}) {
  return (
    <table className="ac-comparison" role="table">
      <caption className="sr-only">{caption}</caption>
      <thead role="rowgroup">
        <tr role="row">
          <td className="ac-comparison-corner" role="columnheader">
            <span className="sr-only">Campo</span>
          </td>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              role="columnheader"
              aria-label={column.label}
            >
              {column.head}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((row) => (
          <tr key={row.id} role="row">
            <th scope="row" role="rowheader">
              {row.label}
            </th>
            {row.values.map((value, index) => (
              <td key={index} role="cell" data-column={columns[index]?.key}>
                {value}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A decision as a document: the result is the content, identifiers stay at the foot. */
export function DecisionSheet({
  label,
  kicker,
  header,
  children,
  footer,
}: {
  /** Accessible name of the whole record. */
  label: string;
  kicker: string;
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const id = useId();
  return (
    <article
      className="ac-decision-sheet"
      aria-label={label}
      aria-describedby={id}
    >
      <header className="ac-decision-head">
        <h2 id={id} className="ac-decision-kicker">
          {kicker}
        </h2>
        {header}
      </header>
      {children}
      {footer && <footer>{footer}</footer>}
    </article>
  );
}

/** Chronological reading of what happened; each event has an actor, a text and a date. */
export function Timeline({
  label,
  events,
}: {
  label: string;
  events: {
    id: string;
    icon: string;
    tone?: "danger" | "warning" | "success";
    actor: string;
    text: string;
    date: string;
    dateTime: string;
  }[];
}) {
  return (
    <ol className="ac-timeline" aria-label={label}>
      {events.map((event) => (
        <li key={event.id}>
          <span
            className={`ac-timeline-icon${event.tone ? ` ac-timeline-${event.tone}` : ""}`}
          >
            <ParticipantIcon name={event.icon} />
          </span>
          <div>
            <p>
              <strong>{event.actor}</strong> {event.text}
            </p>
            <time dateTime={event.dateTime}>{event.date}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function QueueRow({
  children,
  action,
}: {
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <li className="ac-queue-row">
      <div>{children}</div>
      <div className="ac-row-action">{action}</div>
    </li>
  );
}

/** A register entry read as a document line: reference, title, where it belongs, and its status. */
export function RegisterRow({
  reference,
  title,
  meta,
  status,
  level = 3,
}: {
  reference?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  /** Heading level of the title: 2 directly under the page's h1, 3 under a section. */
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <li className="ac-register-row">
      <div>
        {reference && <p className="ac-register-reference">{reference}</p>}
        <Heading className="ac-register-title">{title}</Heading>
        {meta && <p className="ac-register-meta">{meta}</p>}
      </div>
      {status}
    </li>
  );
}

/** How far along someone is: a count in words, a segmented bar and one honest note. */
export function ProgressCard({
  sent,
  total,
  drafts = 0,
  noun = "preguntas enviadas",
  children,
}: {
  sent: number;
  total: number;
  drafts?: number;
  noun?: string;
  children?: ReactNode;
}) {
  const share = (value: number) =>
    total > 0 ? `${Math.min(100, (value / total) * 100)}%` : "0%";
  return (
    <section className="ac-progress-card" aria-label="Avance">
      <p className="ac-progress-count">
        <strong>{sent}</strong> de {total} {noun}
      </p>
      <div
        className="ac-progress-bar"
        role="img"
        aria-label={`${sent} de ${total} ${noun}${drafts ? `; ${drafts} en borrador` : ""}`}
      >
        <span style={{ width: share(sent) }} />
        <span className="ac-progress-drafts" style={{ width: share(drafts) }} />
      </div>
      {children && <div className="ac-progress-note">{children}</div>}
    </section>
  );
}

/** A card that asks for attention and leads to the place where it is attended. */
export function Callout({
  tone = "warning",
  icon = "help",
  title,
  children,
  action,
}: {
  tone?: "warning" | "info";
  icon?: string;
  title: string;
  children?: ReactNode;
  /** The whole card is this link. */
  action: ReactNode;
}) {
  return (
    <section className={`ac-callout ac-callout-${tone}`}>
      <ParticipantIcon name={icon} />
      <div>
        <h2>{title}</h2>
        {children && <p>{children}</p>}
      </div>
      <div className="ac-callout-action">{action}</div>
    </section>
  );
}

/** What happens next, in order, derived only from states that exist. */
export function NextSteps({
  title = "Qué sigue",
  steps,
  children,
  variant = "card",
}: {
  title?: string;
  /** "guide" numbers the steps without states and drops the card (a "how it works" list). */
  variant?: "card" | "guide";
  steps: {
    id: string;
    state: "done" | "current" | "todo";
    title: string;
    detail?: string;
  }[];
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <aside
      className={`ac-next-steps${variant === "guide" ? " ac-next-steps-guide" : ""}`}
      aria-labelledby={id}
    >
      <h2 id={id}>{title}</h2>
      <ol>
        {steps.map((step, index) => (
          <li key={step.id} className={`ac-step-${step.state}`}>
            <span className="ac-step-mark" aria-hidden="true">
              {step.state === "done" ? (
                <ParticipantIcon name="check" />
              ) : (
                index + 1
              )}
            </span>
            <div>
              <p className="ac-step-title">
                {step.title}
                <span className="sr-only">
                  {step.state === "done"
                    ? " (hecho)"
                    : step.state === "current"
                      ? " (ahora)"
                      : " (pendiente)"}
                </span>
              </p>
              {step.detail && <p className="ac-step-detail">{step.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
      {children}
    </aside>
  );
}

/** A few facts side by side: what, how much, until when. Each one has a label and a value. */
export function FactGrid({
  facts,
}: {
  facts: { id: string; icon: string; label: string; value: ReactNode }[];
}) {
  return (
    <dl className="ac-facts">
      {facts.map((fact) => (
        <div key={fact.id}>
          <dt>
            <ParticipantIcon name={fact.icon} />
            {fact.label}
          </dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The head of a page: what it is, a line that says what it is for, and its one main action. */
export function PageHeader({
  overline,
  title,
  lead,
  actions,
}: {
  overline?: ReactNode;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ac-page-header">
      <div>
        {overline && <p className="eyebrow">{overline}</p>}
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {actions && <div className="ac-page-actions">{actions}</div>}
    </header>
  );
}

/** Two letters for a person, never as the only name: the name is always next to it. */
export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!)
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("es");
  return (
    <span className="ac-avatar" aria-hidden="true">
      {initials}
    </span>
  );
}

/** Filters as chips with their counts; each is a real toggle button. */
export function FilterChips({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { value: string; label: string; count?: number }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="ac-filter-chips" role="group" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
          {item.count !== undefined && <span>{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function QuestionRow({ children, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      {...props}
      className={["ac-question-row", props.className].filter(Boolean).join(" ")}
    >
      {children}
    </tr>
  );
}

export function SelectionBar({
  summary,
  summaryRef,
  children,
}: {
  summary: string;
  summaryRef?: ComponentProps<"p">["ref"];
  children: ReactNode;
}) {
  return (
    <section
      className="ac-selection-bar"
      aria-label="Acciones sobre la selección"
    >
      <p role="status" tabIndex={-1} ref={summaryRef}>
        {summary}
      </p>
      <div>{children}</div>
    </section>
  );
}

export function Receipt({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="ac-receipt" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

export function Letter({
  organization,
  children,
}: {
  organization: string;
  children: ReactNode;
}) {
  return (
    <article className="ac-letter" aria-label={organization}>
      <p className="ac-letter-organization">{organization}</p>
      {children}
    </article>
  );
}

export function AppShell({
  navigation,
  context,
  children,
  mobileNavigation,
}: {
  navigation: ReactNode;
  context: ReactNode;
  children: ReactNode;
  mobileNavigation?: ReactNode;
}) {
  return (
    <div className="ac-shell">
      <div className="ac-shell-sidebar">{navigation}</div>
      <div className="ac-shell-workspace">
        <div className="ac-shell-context">{context}</div>
        {children}
      </div>
      {mobileNavigation && (
        <div className="ac-shell-mobile">{mobileNavigation}</div>
      )}
    </div>
  );
}

/**
 * Secondary actions as a disclosure menu: a real button that opens a list of
 * buttons. It closes with Escape (focus returns to the trigger), on outside
 * click, and when an item is chosen; the chosen action gets the trigger as the
 * element to return focus to.
 */
export function ActionMenu({
  label,
  items,
  onSelect,
}: {
  label: string;
  items: { value: string; label: string }[];
  onSelect: (value: string) => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const away = (event: MouseEvent) => {
      const node = menu.current;
      if (node?.open && !node.contains(event.target as Node)) node.open = false;
    };
    document.addEventListener("click", away);
    return () => document.removeEventListener("click", away);
  }, []);
  return (
    <details
      ref={menu}
      className="ac-action-menu"
      onKeyDown={(event) => {
        const node = menu.current;
        if (event.key !== "Escape" || !node?.open) return;
        event.preventDefault();
        event.stopPropagation();
        node.open = false;
        node.querySelector("summary")?.focus();
      }}
    >
      <summary className="button secondary">{label}</summary>
      <ul>
        {items.map((item) => (
          <li key={item.value}>
            <button
              type="button"
              onClick={() => {
                const node = menu.current;
                // Move focus to the trigger first so the chosen action returns here.
                node?.querySelector("summary")?.focus();
                if (node) node.open = false;
                onSelect(item.value);
              }}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
