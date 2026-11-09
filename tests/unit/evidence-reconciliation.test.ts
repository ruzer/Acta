// @vitest-environment node
import { expect, it, vi } from "vitest";
import { ResponsesService } from "../../app/backend/src/responses/responses.service";

it.each([5, 2005])(
  "reconciles %i mixed objects with bounded queries and unchanged deletion rules",
  async (size) => {
    const keys = Array.from({ length: size }, (_, i) => `object-${i}`);
    const records = [
      { storageKey: keys[1], status: "REJECTED", drafts: 0, revisions: 0 },
      { storageKey: keys[2], status: "READY", drafts: 0, revisions: 0 },
      { storageKey: keys[3], status: "STAGED", drafts: 1, revisions: 0 },
      { storageKey: keys[4], status: "REJECTED", drafts: 0, revisions: 1 },
    ];
    const findFirst = vi.fn(async ({ where }) => {
      const row = records.find((r) => r.storageKey === where.storageKey);
      return (
        row && {
          ...row,
          DraftEvidence_evidence: Array(row.drafts),
          RevisionEvidence_evidence: Array(row.revisions),
        }
      );
    });
    const findMany = vi.fn(async ({ where }) =>
      where.storageKey
        ? records
            .filter((r) => where.storageKey.in.includes(r.storageKey))
            .map((r) => ({
              storageKey: r.storageKey,
              status: r.status,
              _count: {
                DraftEvidence_evidence: r.drafts,
                RevisionEvidence_evidence: r.revisions,
              },
            }))
        : [],
    );
    const storage = {
      backend: "LOCAL",
      candidates: vi.fn(async () => keys),
      remove: vi.fn(),
    };
    const service = new ResponsesService(
      { evidence: { findFirst, findMany } } as never,
      {} as never,
      storage as never,
    );
    expect(await service.reconcile()).toEqual({
      removed: size - 3,
      expired: 0,
    });
    expect(storage.remove.mock.calls.map(([key]) => key)).toEqual(
      keys.filter((key) => !keys.slice(2, 5).includes(key)),
    );
    expect(findFirst).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledTimes(1 + Math.ceil(size / 1000));
    for (const [query] of findMany.mock.calls.slice(1)) {
      expect(query.where.backend).toBe("LOCAL");
      expect(query.where.storageKey.in.length).toBeLessThanOrEqual(1000);
      expect(query.select).toEqual({
        storageKey: true,
        status: true,
        _count: {
          select: {
            DraftEvidence_evidence: true,
            RevisionEvidence_evidence: true,
          },
        },
      });
    }
  },
);
