import { COLLECTION_MAX_MANUAL_PRODUCTS } from '@cod/shared';
import type { StoreCollectionProductDto } from '../dto';

/** A product of a manual collection's hand-ordered list (D2318). */
export type ManualProduct = StoreCollectionProductDto;

/** The keys that move a focused row: up one place or down one place. */
const KEY_DELTAS: Readonly<Record<string, -1 | 1>> = { ArrowUp: -1, ArrowDown: 1 };

/** How far a key moves the focused row, or undefined when the key moves nothing. */
export const reorderKeyDelta = (key: string): -1 | 1 | undefined => KEY_DELTAS[key];

/** The list with the row at `from` moved to `to`; the same list when either place is outside it. */
export function moveTo(rows: readonly ManualProduct[], from: number, to: number): readonly ManualProduct[] {
  const inside = (index: number): boolean => index >= 0 && index < rows.length;
  if (from === to || !inside(from) || !inside(to)) return rows;
  const moved = rows.filter((_, index) => index !== from);
  const row = rows[from];
  return row === undefined ? rows : [...moved.slice(0, to), row, ...moved.slice(to)];
}

/** The list with the row at `index` moved `delta` places; a row at either end stays (keyboard reorder). */
export const moveBy = (rows: readonly ManualProduct[], index: number, delta: number): readonly ManualProduct[] =>
  moveTo(rows, index, index + delta);

/** The list without `productId`; the others keep their order. */
export const withoutProduct = (rows: readonly ManualProduct[], productId: string): readonly ManualProduct[] =>
  rows.filter((row) => row.productId !== productId);

/** A list after products were added, and how many the cap of D2322 left out. */
export interface AddedProducts {
  readonly products: readonly ManualProduct[];
  readonly dropped: number;
}

/** The list with `added` appended in their order, never a product twice, up to the cap of D2322. */
export function withProducts(rows: readonly ManualProduct[], added: readonly ManualProduct[]): AddedProducts {
  const present = new Set(rows.map(({ productId }) => productId));
  const fresh = added.filter(({ productId }) => !present.has(productId));
  const products = [...rows, ...fresh].slice(0, COLLECTION_MAX_MANUAL_PRODUCTS);
  return { products, dropped: rows.length + fresh.length - products.length };
}

export const productIdsOf = (rows: readonly ManualProduct[]): readonly string[] =>
  rows.map(({ productId }) => productId);

/** Whether two lists hold the same products in the same order. */
export function sameOrder(left: readonly ManualProduct[], right: readonly ManualProduct[]): boolean {
  return left.length === right.length && left.every((row, index) => row.productId === right[index]?.productId);
}
