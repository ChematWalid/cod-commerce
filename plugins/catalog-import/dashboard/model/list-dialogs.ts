import type { CatalogProductListPageEntity } from '@cod/shared';

/** The dialogs the product list's action-bar items open. */
export type ListDialog = 'export' | 'bulk-edit';

type Listener = () => void;

/**
 * Which list dialog is open. The action-bar items live in a dropdown menu that unmounts when it closes, so the dialog
 * they open is held here and drawn by a block of the list page instead (D2277).
 */
export interface ListDialogStore {
  readonly current: () => ListDialog | null;
  readonly open: (dialog: ListDialog) => void;
  readonly close: () => void;
  readonly subscribe: (listener: Listener) => () => void;
}

/** A store with no dialog open. */
export function createListDialogStore(): ListDialogStore {
  let current: ListDialog | null = null;
  const listeners = new Set<Listener>();
  const set = (next: ListDialog | null): void => {
    current = next;
    for (const listener of listeners) listener();
  };
  return {
    current: () => current,
    open: (dialog) => {
      set(dialog);
    },
    close: () => {
      set(null);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The dashboard's one list dialog store. */
export const listDialogs: ListDialogStore = createListDialogStore();

/**
 * The product list page's `entity` (D2201), read from the page context the action bar and blocks get; `undefined` on
 * any other page or while the list has not handed one.
 */
export function listEntityOf(value: unknown): CatalogProductListPageEntity | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  if (!('selectedIds' in value) || !('query' in value)) return undefined;
  const { selectedIds, query } = value;
  if (!Array.isArray(selectedIds) || typeof query !== 'object' || query === null) return undefined;
  return value as CatalogProductListPageEntity;
}
