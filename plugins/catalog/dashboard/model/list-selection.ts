import type { ProductListQueryInput } from '@cod/shared';

/**
 * The products the merchant ticked on the list (D2201), and the store and filter they were ticked under: a selection
 * belongs to one list, so a store switch or a new tab, search or filter starts it empty. Paging keeps it.
 */
export interface ListSelection {
  readonly storeId: string | null;
  readonly filterKey: string;
  readonly ids: readonly string[];
}

/** How much of the page shown is ticked, for the header checkbox. */
export type PageSelectionState = 'all' | 'some' | 'none';

/** Nothing ticked in `storeId`'s list under `filterKey`. */
export const emptySelection = (storeId: string | null, filterKey: string): ListSelection => ({
  storeId,
  filterKey,
  ids: [],
});

/** What identifies one list for the selection: the query without its page. */
export function selectionFilterKeyOf(query: ProductListQueryInput): string {
  const filter = Object.entries(query).filter(([key]) => key !== 'skip' && key !== 'take');
  return JSON.stringify(filter.sort(([left], [right]) => left.localeCompare(right)));
}

/** `selection` while it belongs to the list shown, else an empty selection of that list. */
export function selectionWithin(selection: ListSelection, storeId: string | null, filterKey: string): ListSelection {
  const sameList = selection.storeId === storeId && selection.filterKey === filterKey;
  return sameList ? selection : emptySelection(storeId, filterKey);
}

/** Ticks or unticks one product; a product is listed once, in the order ticked. */
export function toggleSelected(selection: ListSelection, id: string, on: boolean): ListSelection {
  const without = selection.ids.filter((held) => held !== id);
  return { ...selection, ids: on ? [...without, id] : without };
}

/** Ticks or unticks every product of the page shown, and only those: ticks on other pages stay. */
export function toggleAllOnPage(selection: ListSelection, pageIds: readonly string[], on: boolean): ListSelection {
  const page = new Set(pageIds);
  const others = selection.ids.filter((held) => !page.has(held));
  return { ...selection, ids: on ? [...others, ...pageIds] : others };
}

/** Whether every, some or none of the page's products are ticked; an empty page counts as none. */
export function pageSelectionState(selection: ListSelection, pageIds: readonly string[]): PageSelectionState {
  const held = new Set(selection.ids);
  const ticked = pageIds.filter((id) => held.has(id)).length;
  if (ticked === 0) return 'none';
  return ticked === pageIds.length ? 'all' : 'some';
}
