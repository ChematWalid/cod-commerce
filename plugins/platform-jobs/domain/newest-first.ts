/** One page of items with the total of the list it was cut from. */
export interface Page<T> {
  readonly items: readonly T[];
  readonly totalItems: number;
}

/**
 * Merges pages read from several lists, each the first `skip + take` items newest first, into the page
 * `skip`..`skip + take` of the combined list. The total is the sum of the lists' totals.
 */
export function mergeNewestFirst<T extends { readonly createdAt: Date }>(
  pages: readonly Page<T>[],
  skip: number,
  take: number,
): { items: T[]; totalItems: number } {
  const items = pages
    .flatMap((page) => page.items)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(skip, skip + take);
  return { items, totalItems: pages.reduce((sum, page) => sum + page.totalItems, 0) };
}
