import type { ProductListQueryInput } from '@cod/shared';
import { useState } from 'react';
import {
  emptySelection,
  type ListSelection,
  selectionFilterKeyOf,
  selectionWithin,
  toggleAllOnPage,
  toggleSelected,
} from '../model/list-selection';

/**
 * The list's ticked products and how to tick them; cleared on a store switch or a new tab, search or filter (D2232).
 * The clear is written to state, not only hidden: going back to the previous list must not bring old ticks back.
 */
export function useListSelection(storeId: string | null, query: ProductListQueryInput) {
  const filterKey = selectionFilterKeyOf(query);
  const [stored, setStored] = useState<ListSelection>(() => emptySelection(storeId, filterKey));
  const selection = selectionWithin(stored, storeId, filterKey);
  // React's "adjust state when a prop changes": the render re-runs at once with the cleared selection.
  if (selection !== stored) setStored(selection);
  const change = (next: (current: ListSelection) => ListSelection): void => {
    setStored((current) => next(selectionWithin(current, storeId, filterKey)));
  };
  return {
    selection,
    toggle: (id: string, on: boolean): void => {
      change((current) => toggleSelected(current, id, on));
    },
    togglePage: (pageIds: readonly string[], on: boolean): void => {
      change((current) => toggleAllOnPage(current, pageIds, on));
    },
  };
}

/** What {@link useListSelection} hands the table. */
export type ListSelectionControl = ReturnType<typeof useListSelection>;
