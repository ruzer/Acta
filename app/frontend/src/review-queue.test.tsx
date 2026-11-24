import { afterEach, expect, it, vi } from "vitest";
import type { ReviewInbox } from "@requirements/contracts";
import {
  loadReviewQueue,
  queuePosition,
  readReviewQueue,
  storeReviewQueue,
} from "./review-queue";

const projectId = "00000000-0000-4000-8000-000000000001";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const token = id(999);
function page(numbers: number[], total = numbers.length, number = 1) {
  return {
    page: number,
    pageSize: 100,
    total,
    filters: { projects: [], sections: [], areas: [], participants: [] },
    items: numbers.map((n) => ({
      questionId: id(n),
      projectId,
      question: `Pregunta ${n}`,
      projectName: "Proyecto ficticio",
      sectionId: id(501),
      sectionTitle: "Tema",
      status: "ANSWERED",
      priority: "P1",
      areaId: id(502),
      areaName: "Área",
      respondents: [],
      lastContributionAt: null,
      hasEvidence: false,
      openClarifications: 0,
    })),
  } as ReviewInbox;
}
afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

it("recorre páginas con los mismos filtros y conserva el orden del servidor", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      page(
        Array.from({ length: 100 }, (_, i) => i + 10),
        102,
      ),
    )
    .mockResolvedValueOnce(page([3, 2], 102, 2));
  const queue = await loadReviewQueue(
    "status=CLARIFICATION_REQUIRED&page=2",
    fetch,
  );
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0]![0]).toMatchObject({
    status: "CLARIFICATION_REQUIRED",
    page: 1,
    pageSize: 100,
  });
  expect(fetch.mock.calls[1]![0]).toMatchObject({
    status: "CLARIFICATION_REQUIRED",
    page: 2,
    pageSize: 100,
  });
  expect(queue.items.map((x) => x.id)).toEqual([
    ...Array.from({ length: 100 }, (_, i) => id(i + 10)),
    id(3),
    id(2),
  ]);
  expect(queue.search).toBe("status=CLARIFICATION_REQUIRED&page=2");
});
it("no ofrece una cola parcial si cambian los totales entre páginas", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      page(
        Array.from({ length: 100 }, (_, i) => i + 10),
        101,
      ),
    )
    .mockResolvedValueOnce(page([3], 102, 2));
  await expect(loadReviewQueue("", fetch)).rejects.toThrow(/cambió/);
});
it("detecta repeticiones aunque el total no cambie", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      page(
        Array.from({ length: 100 }, (_, i) => i + 10),
        101,
      ),
    )
    .mockResolvedValueOnce(page([10], 101, 2));
  await expect(loadReviewQueue("", fetch)).rejects.toThrow(/cambió/);
});
it("una página incompleta no se confunde con la cola completa", async () => {
  await expect(
    loadReviewQueue("", vi.fn().mockResolvedValue(page([2], 10))),
  ).rejects.toThrow(/cambió/);
});
it("mantiene bordes, cola vacía y posición de una pregunta que después sale del filtro", async () => {
  const queue = await loadReviewQueue(
    "status=ANSWERED",
    vi.fn().mockResolvedValue(page([10, 3, 2])),
  );
  expect(queuePosition(queue, projectId, id(10))).toMatchObject({
    index: 0,
    previous: null,
    next: { id: id(3) },
  });
  expect(queuePosition(queue, projectId, id(2))).toMatchObject({
    index: 2,
    previous: { id: id(3) },
    next: null,
  });
  expect(queuePosition(queue, projectId, id(3))).toMatchObject({
    index: 1,
    total: 3,
  });
  expect(queuePosition(queue, projectId, id(77))).toBeNull();
  const empty = await loadReviewQueue("", vi.fn().mockResolvedValue(page([])));
  expect(queuePosition(empty, projectId, id(3))).toBeNull();
});
it("guarda solo identificadores y filtros por persona; no respuestas ni nombres", async () => {
  const queue = await loadReviewQueue("", vi.fn().mockResolvedValue(page([3])));
  expect(storeReviewQueue("persona-a", token, queue)).toBe(true);
  expect(readReviewQueue("persona-a", token)).toEqual(queue);
  expect(readReviewQueue("persona-b", token)).toBeNull();
  const raw = sessionStorage.getItem(sessionStorage.key(0)!)!;
  expect(raw).not.toMatch(/Pregunta 3|question|respondent|answer|evidence/);
});
it("ignora datos dañados y conserva la cola en memoria si el navegador impide guardarla", async () => {
  const queue = await loadReviewQueue("", vi.fn().mockResolvedValue(page([3])));
  storeReviewQueue("persona-a", token, queue);
  sessionStorage.setItem(sessionStorage.key(0)!, '{"items":[]}');
  expect(readReviewQueue("persona-a", token)).toBeNull();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("denegado");
  });
  expect(storeReviewQueue("persona-a", token, queue)).toBe(false);
  expect(queuePosition(queue, projectId, id(3))?.total).toBe(1);
});
it("rechaza filtros ajenos al contrato antes de consultar", async () => {
  const fetch = vi.fn();
  await expect(loadReviewQueue("secret=ignored", fetch)).rejects.toThrow(
    /filtros/,
  );
  expect(fetch).not.toHaveBeenCalled();
});

it("abandonar la pregunta no descarga las páginas restantes de la cola", async () => {
  const controller = new AbortController();
  const fetch = vi.fn().mockImplementation(async () => {
    controller.abort();
    return page(
      Array.from({ length: 100 }, (_, i) => i + 10),
      102,
    );
  });
  await expect(loadReviewQueue("", fetch, controller.signal)).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
});
