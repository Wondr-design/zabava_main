import { useEffect, useMemo, useState } from "react";

interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
}

export function usePagination<T>(
  items: readonly T[],
  options?: UsePaginationOptions,
) {
  const [pageSize, setPageSize] = useState(options?.initialPageSize ?? 10);
  const [page, setPage] = useState(options?.initialPage ?? 1);

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    setPage((prev) => {
      if (prev > totalPages) return totalPages;
      if (prev < 1) return 1;
      return prev;
    });
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const currentItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const goToPage = (next: number) => {
    if (Number.isNaN(next) || !Number.isFinite(next)) return;
    setPage(() => {
      if (next < 1) return 1;
      if (next > totalPages) return totalPages;
      return next;
    });
  };

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    currentItems,
    setPage: goToPage,
    setPageSize,
  };
}
