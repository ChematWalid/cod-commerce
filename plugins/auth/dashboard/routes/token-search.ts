import type { AnyRoute } from '@tanstack/react-router';

/** The `?token=` of an emailed link. */
export function validateTokenSearch(search: Record<string, unknown>): { readonly token: string | undefined } {
  return { token: typeof search['token'] === 'string' ? search['token'] : undefined };
}

/** The token of the current page's link. Reading it spends nothing. */
export function useLinkToken(route: AnyRoute): string | undefined {
  const search: unknown = route.useSearch();
  return validateTokenSearch(search as Record<string, unknown>).token;
}
