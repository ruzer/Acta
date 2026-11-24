import type { ReactNode } from "react";
import { Button, Input } from "./index";

/** Shared presentation only: each screen owns its filters and existing query. */
export function FilterBar({
  children,
  search,
  summary,
  hasFilters,
  onClear,
}: {
  children: ReactNode;
  search?: { label: string; value: string; onChange: (value: string) => void };
  summary: ReactNode;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <section aria-label="Filtros de la lista">
      <div className="review-filters">
        {search && (
          <Input
            type="search"
            label={search.label}
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
          />
        )}
        {children}
      </div>
      <div className="actions">
        <p aria-live="polite" aria-atomic="true">
          {summary}
        </p>
        {hasFilters && (
          <Button tone="secondary" onClick={onClear}>
            Limpiar filtros
          </Button>
        )}
      </div>
    </section>
  );
}
