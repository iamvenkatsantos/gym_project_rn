import { useEffect, useState } from 'react';

export const PAGE_SIZES = [25, 50, 100] as const;

/** Page state for a list held in memory. `resetKey` sends it back to page 1 when filters change. */
export function usePaging(total: number, resetKey: string, initialSize: number = 25) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);

  useEffect(() => setPage(1), [resetKey, pageSize]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize;
  return {
    page: current,
    pages,
    pageSize,
    start,
    end: Math.min(start + pageSize, total),
    setPage,
    setPageSize,
    slice: <T,>(rows: T[]) => rows.slice(start, start + pageSize),
  };
}

export type Paging = ReturnType<typeof usePaging>;

/** Rows range, page size and previous / next, shown under a table. */
export function Pagination({ paging, total }: { paging: Paging; total: number }) {
  if (total <= PAGE_SIZES[0]) return null;
  const { page, pages, pageSize, start, end, setPage, setPageSize } = paging;
  return (
    <nav className="pagination" aria-label="Pages">
      <span className="muted" aria-live="polite">
        {start + 1}–{end} of {total}
      </span>
      <div className="toolbar">
        <label className="page-size muted">
          Rows
          <select
            className="select"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}>
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button"
          onClick={() => setPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page">
          ‹ Prev
        </button>
        <span className="muted">
          Page {page} of {pages}
        </span>
        <button
          className="button"
          onClick={() => setPage(page + 1)}
          disabled={page >= pages}
          aria-label="Next page">
          Next ›
        </button>
      </div>
    </nav>
  );
}
