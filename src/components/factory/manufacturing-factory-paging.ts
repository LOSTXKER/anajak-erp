export const FACTORY_CENTER_PAGE_SIZE = 6;
export const FACTORY_CENTER_PAGE_INTERVAL_MS = 12_000;

export type FactoryCenterPage<T> = {
  items: readonly T[];
  page: number;
  pageCount: number;
};

export function factoryCenterPage<T>(
  items: readonly T[],
  requestedPage: number,
  pageSize = FACTORY_CENTER_PAGE_SIZE,
): FactoryCenterPage<T> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error("Factory center page size must be a positive integer");
  }

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safeRequestedPage = Number.isSafeInteger(requestedPage) ? requestedPage : 0;
  const page = ((safeRequestedPage % pageCount) + pageCount) % pageCount;
  const start = page * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageCount,
  };
}
