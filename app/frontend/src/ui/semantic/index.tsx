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
  children,
  headingRef,
}: {
  title: ReactNode;
  metadata?: ReactNode;
  children: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const id = useId();
  return (
    <article className="ac-contribution-pane" aria-labelledby={id}>
      <header>
        <h2 id={id} ref={headingRef} tabIndex={-1}>
          {title}
        </h2>
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

export function ThreadInset({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="ac-thread-inset" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {children}
    </section>
  );
}

export function ComparisonTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: [ReactNode, ReactNode];
  rows: { id: string; label: string; values: [ReactNode, ReactNode] }[];
}) {
  return (
    <div
      className="ac-comparison-scroll"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="ac-comparison">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Campo</th>
            {columns.map((column, index) => (
              <th key={index} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              {row.values.map((value, index) => (
                <td key={index}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DecisionSheet({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const id = useId();
  return (
    <article className="ac-decision-sheet" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
      {footer && <footer>{footer}</footer>}
    </article>
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
