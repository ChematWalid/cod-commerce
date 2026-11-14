import type { BusinessId, StoreId } from '@cod/shared';
import type { StoreScope } from '../../domain/store-scope';

/** A row the fakes keep: owned by one business and one store, as every catalog table row is. */
export interface StoreRow {
  readonly businessId: BusinessId;
  readonly storeId: StoreId;
}

/** True when `row` belongs to the scope's business and store. */
export const inStore = (scope: StoreScope, row: StoreRow): boolean =>
  row.businessId === scope.businessId && row.storeId === scope.storeId;

/** Newest first, then by id descending: the order of every catalog list. */
export function newestFirst<T extends { readonly createdAt: Date; readonly id: string }>(rows: readonly T[]): T[] {
  const byId = (left: T, right: T): number => (BigInt(right.id) > BigInt(left.id) ? 1 : -1);
  return [...rows].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || byId(left, right));
}
