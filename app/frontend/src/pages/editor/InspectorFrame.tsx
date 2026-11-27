import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "../../ui";
export function InspectorFrame({
  children,
  onClose,
  questionId,
  navigation,
  footer,
}: {
  children: ReactNode;
  onClose: () => void;
  questionId?: string;
  navigation?: ReactNode;
  footer?: ReactNode;
}) {
  const [wide, setWide] = useState(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(min-width:900px)").matches,
  );
  const ref = useRef<HTMLDialogElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (body.current) body.current.scrollTop = 0;
  }, [questionId]);
  const openingTrigger = useRef<HTMLElement | null>(null);
  const openingQuestion = useRef<string | undefined>(undefined);
  const currentQuestion = useRef(questionId);
  useEffect(() => {
    currentQuestion.current = questionId;
  }, [questionId]);
  useEffect(() => {
    const m = window.matchMedia?.("(min-width:900px)");
    if (!m) return;
    const update = () => setWide(m.matches);
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    // Keep the original opener across Strict Mode effect replay and resize.
    openingTrigger.current ??= document.activeElement as HTMLElement;
    const trigger = openingTrigger.current;
    openingQuestion.current ??= trigger?.dataset.questionOpener;
    const dialog = ref.current;
    if (!wide) dialog?.showModal();
    heading.current?.focus();
    return () => {
      dialog?.close();
      requestAnimationFrame(() => {
        // A deferred return must not steal focus from a newer user action.
        const active = document.activeElement;
        if (
          (active === document.body || active === trigger) &&
          !document.querySelector("dialog[open]")
        ) {
          const openers = Array.from(
            document.querySelectorAll<HTMLElement>("[data-question-opener]"),
          ).filter((element) => !element.closest("[hidden]"));
          const originalOpener = openers.find(
            (element) =>
              element.dataset.questionOpener === openingQuestion.current,
          );
          const currentOpener = openers.find(
            (element) =>
              element.dataset.questionOpener === currentQuestion.current,
          );
          const target =
            trigger?.isConnected &&
            trigger !== document.body &&
            !trigger.closest("[hidden]")
              ? trigger
              : (originalOpener ??
                currentOpener ??
                document.querySelector<HTMLElement>(
                  '.qe-modes [aria-selected="true"]',
                ));
          target?.focus();
        }
      });
    };
  }, [wide]);
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  const content = (
    <>
      <header className="qe-inspector-head">
        <h2
          ref={heading}
          tabIndex={-1}
          className={navigation ? "sr-only" : undefined}
        >
          Detalle de pregunta
        </h2>
        {navigation ?? (
          <Button tone="secondary" onClick={onClose}>
            Cerrar detalle
          </Button>
        )}
      </header>
      <div ref={body} className="qe-inspector-body">
        {children}
      </div>
      <footer className="qe-inspector-footer">{footer}</footer>
    </>
  );
  return wide ? (
    <aside
      className="qe-inspector qe-inspector-overlay"
      aria-label="Detalle de pregunta"
    >
      {content}
    </aside>
  ) : (
    <dialog
      className="qe-inspector qe-inspector-dialog qe-inspector-overlay av-scope"
      aria-label="Detalle de pregunta"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {content}
    </dialog>
  );
}
