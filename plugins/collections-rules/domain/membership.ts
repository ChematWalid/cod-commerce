import { COLLECTION_MAX_MANUAL_PRODUCTS } from '@cod/shared';
import { AUTOMATIC_MEMBER_POSITION, FIRST_MANUAL_POSITION } from './constants';
import { TooManyManualProductsError } from './errors';

/** One product of a collection and its place in it (D2318). */
export interface MemberRow {
  readonly productId: string;
  readonly position: number;
}

/** The rows to write to turn one membership into another. */
export interface MembershipDiff {
  readonly insert: readonly MemberRow[];
  readonly update: readonly MemberRow[];
  readonly remove: readonly string[];
}

/** Sort order newest product first: Vendure ids grow with time, compared as numbers (`'10'` after `'9'`). */
export const newestFirst = (left: string, right: string): number => {
  const [leftId, rightId] = [BigInt(left), BigInt(right)];
  if (leftId === rightId) {
    return 0;
  }
  return leftId > rightId ? -1 : 1;
};

/** The members of an automatic collection: each matched product once, newest first, all at position 0 (D2318). */
export function ruleMembers(matchedIds: readonly string[]): MemberRow[] {
  return [...new Set(matchedIds)]
    .sort(newestFirst)
    .map((productId) => ({ productId, position: AUTOMATIC_MEMBER_POSITION }));
}

/** The members of a manual collection in the given order, at positions 0..n-1; refuses more than the cap (D2322). */
export function manualMembers(productIds: readonly string[]): MemberRow[] {
  if (productIds.length > COLLECTION_MAX_MANUAL_PRODUCTS) {
    throw new TooManyManualProductsError();
  }
  return productIds.map((productId, index) => ({ productId, position: FIRST_MANUAL_POSITION + index }));
}

/**
 * Adds a product last to a manual collection (the product-side picker, D2318, D2337); a product already in it keeps
 * its place. Refuses the product that would pass the cap.
 */
export function appendManual(current: readonly MemberRow[], productId: string): MemberRow[] {
  if (current.some((member) => member.productId === productId)) {
    return [...current];
  }
  if (current.length >= COLLECTION_MAX_MANUAL_PRODUCTS) {
    throw new TooManyManualProductsError();
  }
  const last = Math.max(FIRST_MANUAL_POSITION - 1, ...current.map((member) => member.position));
  return [...current, { productId, position: last + 1 }];
}

/** What to insert, move and remove so that `current` becomes `next`. */
export function membershipDiff(current: readonly MemberRow[], next: readonly MemberRow[]): MembershipDiff {
  const positionOf = new Map(current.map((member) => [member.productId, member.position]));
  const kept = new Set(next.map((member) => member.productId));
  return {
    insert: next.filter((member) => !positionOf.has(member.productId)),
    update: next.filter(
      (member) => positionOf.has(member.productId) && positionOf.get(member.productId) !== member.position,
    ),
    remove: current.filter((member) => !kept.has(member.productId)).map((member) => member.productId),
  };
}
