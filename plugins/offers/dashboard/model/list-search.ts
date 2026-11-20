import { OFFER_PAGE_SIZE, OFFER_STATUSES, type OfferListOptionsInput, type OfferStatus } from '@cod/shared';

/** The list's tabs: All (every status, archived included), then one tab per status. */
export const OFFER_LIST_TABS = ['all', ...OFFER_STATUSES] as const;
export type OfferListTab = (typeof OFFER_LIST_TABS)[number];

export const isOfferListTab = (value: unknown): value is OfferListTab =>
  typeof value === 'string' && (OFFER_LIST_TABS as readonly string[]).includes(value);

/** What the merchant chose on the offer list: a status tab, a kind chip (`null`: every kind) and a 1-based page. */
export interface OfferListState {
  readonly tab: OfferListTab;
  readonly kind: string | null;
  readonly page: number;
}

/** Any change of the list but its page. */
export type OfferListFilterChange = Partial<Omit<OfferListState, 'page'>>;

/** The list as it first opens: every offer of every kind, page 1. */
export const INITIAL_LIST_STATE: OfferListState = { tab: 'all', kind: null, page: 1 };

/** A new tab or kind starts again at page 1: the page shown may not exist under it. */
export function withFilter(state: OfferListState, change: OfferListFilterChange): OfferListState {
  return { ...state, ...change, page: 1 };
}

export function withPage(state: OfferListState, page: number): OfferListState {
  return { ...state, page };
}

const statusOf = (tab: OfferListTab): OfferStatus | undefined => (tab === 'all' ? undefined : tab);

/** The `offers` options of `state` (D2513): the tab's status and the chip's kind, left out when unset. */
export function listQueryOf(state: OfferListState, pageSize: number = OFFER_PAGE_SIZE): OfferListOptionsInput {
  const status = statusOf(state.tab);
  return {
    ...(status === undefined ? {} : { status }),
    ...(state.kind === null ? {} : { kind: state.kind }),
    skip: (state.page - 1) * pageSize,
    take: pageSize,
  };
}

/** How many pages `total` offers fill; an empty list still has its one page. */
export function pageCountOf(total: number, pageSize: number = OFFER_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * `state` moved back to the last page `total` offers fill, or `state` itself while its page still exists: a delete or
 * another member's change can empty the page shown, and the pager hides once one page is left.
 */
export function clampPage(state: OfferListState, total: number, pageSize: number = OFFER_PAGE_SIZE): OfferListState {
  const lastPage = pageCountOf(total, pageSize);
  return state.page > lastPage ? withPage(state, lastPage) : state;
}

/** Whether `query` asks for less than every offer: an empty answer then means no match, not an empty store. */
export function isNarrowed(query: OfferListOptionsInput): boolean {
  return query.status !== undefined || query.kind !== undefined;
}
