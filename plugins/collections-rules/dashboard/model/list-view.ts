import { COLLECTIONS_ERROR_CODES, type CollectionMode } from '@cod/shared';
import { DELETE_COLLECTIONS_KEY } from '../constants';
import { isStoreSwitched } from './store-bound-fetch';

/** The catalogue ids of the two modes, as the list's Type column and the editor's mode switch show them. */
export const MODE_LABEL_IDS: Readonly<Record<CollectionMode, string>> = {
  manual: 'collections.mode-manual',
  automatic: 'collections.mode-automatic',
};

/** A row's actions, in menu order (D2325). */
export type CollectionRowAction = 'edit' | 'delete';

export const ROW_ACTION_LABEL_IDS: Readonly<Record<CollectionRowAction, string>> = {
  edit: 'collections.action-edit',
  delete: 'collections.action-delete',
};

/** The actions a row offers by what the server says the caller holds; the server checks each again. */
export const rowActionsOf = (held: ReadonlySet<string>): readonly CollectionRowAction[] =>
  held.has(DELETE_COLLECTIONS_KEY) ? ['edit', 'delete'] : ['edit'];

/** Vendure ids are decimal strings: a shorter one is the smaller number. */
const compareIds = (left: string, right: string): number =>
  left.length === right.length ? left.localeCompare(right) : left.length - right.length;

/** The rows in the store's order: by position, then by id (D2318). */
export function orderedCollections<T extends { readonly id: string; readonly position: number }>(
  rows: readonly T[],
): readonly T[] {
  return [...rows].sort((left, right) => left.position - right.position || compareIds(left.id, right.id));
}

export const GENERIC_ERROR_MESSAGE_ID = 'collections.error-generic';
export const FORBIDDEN_MESSAGE_ID = 'collections.error-forbidden';
/** A write refused because the page's store is no longer the one requests go to. */
export const STORE_SWITCHED_MESSAGE_ID = 'collections.error-store-switched';

const FORBIDDEN_CODE = 'FORBIDDEN';
const COLLECTIONS_CODES: ReadonlySet<string> = new Set(Object.values(COLLECTIONS_ERROR_CODES));

/** The GraphQL error code an API error carries, if any. */
export function serverCodeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('extensions' in error)) return undefined;
  const { extensions } = error;
  if (typeof extensions !== 'object' || extensions === null || !('code' in extensions)) return undefined;
  return typeof extensions.code === 'string' ? extensions.code : undefined;
}

/** The catalogue id for an API error: the collections code's own message, forbidden, a switched store, or generic. */
export function errorMessageIdOf(error: unknown): string {
  if (isStoreSwitched(error)) return STORE_SWITCHED_MESSAGE_ID;
  const code = serverCodeOf(error);
  if (code === FORBIDDEN_CODE) return FORBIDDEN_MESSAGE_ID;
  return code !== undefined && COLLECTIONS_CODES.has(code) ? code : GENERIC_ERROR_MESSAGE_ID;
}

/** Whole DZD with the display language's grouping and Latin digits, as amounts are written in Algeria. */
export function formatDzd(amount: number, language: string): string {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-DZ' : 'en', { numberingSystem: 'latn' }).format(amount);
}
