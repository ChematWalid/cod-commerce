import { CATALOG_PAGE_SIZE, type ProductListQueryInput, type ProductListTab } from '@cod/shared';

/** What the merchant chose on the product list: a tab, a search, three filters and a 1-based page. */
export interface ProductListState {
  readonly tab: ProductListTab;
  readonly search: string;
  readonly collectionId: string | null;
  readonly brandId: string | null;
  readonly tagId: string | null;
  readonly page: number;
}

/** Any change of the list but its page. */
export type ProductListFilterChange = Partial<Omit<ProductListState, 'page'>>;

/** The list as it first opens: every product, no search, no filter, page 1. */
export const INITIAL_LIST_STATE: ProductListState = {
  tab: 'all',
  search: '',
  collectionId: null,
  brandId: null,
  tagId: null,
  page: 1,
};

/** A new tab, search or filter starts again at page 1: the page shown may not exist under it. */
export function withFilter(state: ProductListState, change: ProductListFilterChange): ProductListState {
  return { ...state, ...change, page: 1 };
}

export function withPage(state: ProductListState, page: number): ProductListState {
  return { ...state, page };
}

/**
 * The `catalogProducts` options of `state` (AC4): the tab, the trimmed search and the filters are sent together and
 * the server combines them with AND (D2123); a blank search or an unset filter is left out.
 */
export function listQueryOf(state: ProductListState, pageSize: number = CATALOG_PAGE_SIZE): ProductListQueryInput {
  const q = state.search.trim();
  return {
    tab: state.tab,
    ...(q === '' ? {} : { q }),
    ...(state.collectionId === null ? {} : { collectionId: state.collectionId }),
    ...(state.brandId === null ? {} : { brandId: state.brandId }),
    ...(state.tagId === null ? {} : { tagId: state.tagId }),
    skip: (state.page - 1) * pageSize,
    take: pageSize,
  };
}

/** How many pages `total` products fill; an empty list still has its one page. */
export function pageCountOf(total: number, pageSize: number = CATALOG_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * `state` moved back to the last page `total` products fill, or `state` itself while its page still exists: a delete
 * or another member's change can empty the page shown, and the pager hides once one page is left.
 */
export function clampPage(
  state: ProductListState,
  total: number,
  pageSize: number = CATALOG_PAGE_SIZE,
): ProductListState {
  const lastPage = pageCountOf(total, pageSize);
  return state.page > lastPage ? withPage(state, lastPage) : state;
}

/** Whether `query` asks for less than every product: an empty answer then means no match, not an empty store. */
export function isNarrowed(query: ProductListQueryInput): boolean {
  return (
    query.tab === 'draft' ||
    query.q !== undefined ||
    query.collectionId !== undefined ||
    query.brandId !== undefined ||
    query.tagId !== undefined
  );
}
