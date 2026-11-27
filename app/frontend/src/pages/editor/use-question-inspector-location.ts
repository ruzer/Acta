import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { QuestionView } from "@requirements/contracts";
const marker = "questionInspectorEntry";
function searchWithQuestion(search: string, id?: string) {
  const params = new URLSearchParams(search);
  if (id) params.set("question", id);
  else params.delete("question");
  const result = params.toString();
  return result ? `?${result}` : "";
}
/** Keeps one inspector history entry: opening pushes, changing question replaces. */
export function useQuestionInspectorLocation(
  questions?: readonly QuestionView[],
) {
  const location = useLocation();
  const navigate = useNavigate();
  const id = new URLSearchParams(location.search).get("question");
  const question = questions?.find((q) => q.id === id);
  const pendingDirect = useRef<{
    search: string;
    pathname: string;
    hash: string;
    state: object;
  } | null>(null);
  const initializing = useRef<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!questions) return;
    if (id && !question) {
      setNotice(
        "La pregunta del enlace no está disponible en este cuestionario.",
      );
      void navigate(
        { ...location, search: searchWithQuestion(location.search) },
        { replace: true, state: location.state, preventScrollReset: true },
      );
      return;
    }
    if (question) setNotice("");
    if (
      question &&
      !location.state?.[marker] &&
      initializing.current !== location.key
    ) {
      // A pasted link also gets a closed editor entry immediately behind it.
      initializing.current = location.key;
      pendingDirect.current = {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        state: { ...location.state, [marker]: true },
      };
      void navigate(
        { ...location, search: searchWithQuestion(location.search) },
        { replace: true, state: location.state, preventScrollReset: true },
      );
    } else if (!id && pendingDirect.current) {
      const pending = pendingDirect.current;
      pendingDirect.current = null;
      void navigate(pending, {
        state: pending.state,
        preventScrollReset: true,
      });
    }
  }, [id, question, questions, location, navigate]);
  const open = useCallback(
    (questionId: string) => {
      setNotice("");
      void navigate(
        {
          ...location,
          search: searchWithQuestion(location.search, questionId),
        },
        {
          replace: !!id,
          state: { ...location.state, [marker]: true },
          preventScrollReset: true,
        },
      );
    },
    [id, location, navigate],
  );
  const close = useCallback(() => {
    if (location.state?.[marker]) void navigate(-1);
    else
      void navigate(
        { ...location, search: searchWithQuestion(location.search) },
        { replace: true, state: location.state, preventScrollReset: true },
      );
  }, [location, navigate]);
  return { question, open, close, notice };
}
