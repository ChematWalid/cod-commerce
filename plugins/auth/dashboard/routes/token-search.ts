import type { AnyRoute } from '@tanstack/react-router';

/** The `?token=` of an emailed link. */
export function validateTokenSearch(search: Record<string, unknown>): { readonly token: string | undefined } {
  return { token: typeof search['token'] === 'string' ? search['token'] : undefined };
}

/** The `?ticket=` the OAuth callback sends a new identity to sign-up with (D36). */
export function validateTicketSearch(search: Record<string, unknown>): { readonly ticket: string | undefined } {
  return { ticket: typeof search['ticket'] === 'string' ? search['ticket'] : undefined };
}

/** The search of the current page, unread. */
export function useRawSearch(route: AnyRoute): Record<string, unknown> {
  const search: unknown = route.useSearch();
  return search as Record<string, unknown>;
}

/** The token of the current page's link. Reading it spends nothing. */
export function useLinkToken(route: AnyRoute): string | undefined {
  const search: unknown = route.useSearch();
  return validateTokenSearch(search as Record<string, unknown>).token;
}
