import { COLLECTION_MAX_MANUAL_PRODUCTS } from '@cod/shared';
import { AUTOMATIC_MEMBER_POSITION, FIRST_MANUAL_POSITION } from './constants';
import { CollectionProductNotFoundError, InvalidCollectionInputError, TooManyManualProductsError } from './errors';

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

/** A product id in decimal digits; leading zeros are allowed in input and dropped by {@link canonicalProductId}. */
const DECIMAL_DIGITS = /^\d+$/;

/**
 * A product id in canonical decimal form (`'07'` → `'7'`), so one product always has one key in a membership.
 * A malformed id answers as a foreign one: no such product.
 */
export function canonicalProductId(productId: string): string {
  if (!DECIMAL_DIGITS.test(productId)) {
    throw new CollectionProductNotFoundError();
  }
  return BigInt(productId).toString();
}

/** Sort order newest product first: Vendure ids grow with time, compared as numbers (`'10'` after `'9'`). */
export const newestFirst = (left: string, right: string): number => {
  const [leftId, rightId] = [BigInt(canonicalProductId(left)), BigInt(canonicalProductId(right))];
  if (leftId === rightId) {
    return 0;
  }
  return leftId > rightId ? -1 : 1;
};

/** Refuses a list that names one product twice: the membership table holds a product once per collection (D2300). */
const refuseRepeats = (canonicalIds: readonly string[]): void => {
  if (new Set(canonicalIds).size !== canonicalIds.length) {
    throw new InvalidCollectionInputError();
  }
};

/** The members of an automatic collection: each matched product once, newest first, all at position 0 (D2318). */
export function ruleMembers(matchedIds: readonly string[]): MemberRow[] {
  return [...new Set(matchedIds.map(canonicalProductId))]
    .sort(newestFirst)
    .map((productId) => ({ productId, position: AUTOMATIC_MEMBER_POSITION }));
}

/**
 * The members of a manual collection in the given order, at positions 0..n-1, with canonical ids. Refuses more than
 * the cap (D2322) and a product named twice.
 */
export function manualMembers(productIds: readonly string[]): MemberRow[] {
  if (productIds.length > COLLECTION_MAX_MANUAL_PRODUCTS) {
    throw new TooManyManualProductsError();
  }
  const canonicalIds = productIds.map(canonicalProductId);
  refuseRepeats(canonicalIds);
  return canonicalIds.map((productId, index) => ({ productId, position: FIRST_MANUAL_POSITION + index }));
}

/**
 * Adds a product last to a manual collection (the product-side picker, D2318, D2337); a product already in it keeps
 * its place. Refuses the product that would pass the cap.
 */
export function appendManual(current: readonly MemberRow[], productId: string): MemberRow[] {
  const canonicalId = canonicalProductId(productId);
  if (current.some((member) => canonicalProductId(member.productId) === canonicalId)) {
    return [...current];
  }
  if (current.length >= COLLECTION_MAX_MANUAL_PRODUCTS) {
    throw new TooManyManualProductsError();
  }
  const last = Math.max(FIRST_MANUAL_POSITION - 1, ...current.map((member) => member.position));
  return [...current, { productId: canonicalId, position: last + 1 }];
}

/**
 * What to insert, move and remove so that `current` becomes `next`, comparing canonical ids. Inserted and moved rows
 * carry the canonical id; removed ids are the stored ones. Refuses a `next` that names one product twice.
 */
export function membershipDiff(current: readonly MemberRow[], next: readonly MemberRow[]): MembershipDiff {
  const canonicalNext = next.map((member) => ({ ...member, productId: canonicalProductId(member.productId) }));
  refuseRepeats(canonicalNext.map((member) => member.productId));
  const positionOf = new Map(current.map((member) => [canonicalProductId(member.productId), member.position]));
  const kept = new Set(canonicalNext.map((member) => member.productId));
  return {
    insert: canonicalNext.filter((member) => !positionOf.has(member.productId)),
    update: canonicalNext.filter(
      (member) => positionOf.has(member.productId) && positionOf.get(member.productId) !== member.position,
    ),
    remove: current
      .filter((member) => !kept.has(canonicalProductId(member.productId)))
      .map((member) => member.productId),
  };
}
