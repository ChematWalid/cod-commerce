import { INT_COLUMN_MAX } from '@cod/shared';
import { MIN_CORE_ID } from './constants';
import { CollectionNotFoundError } from './errors';

/** A core id in decimal digits; leading zeros are allowed in input and dropped by {@link canonicalCoreId}. */
const DECIMAL_DIGITS = /^\d+$/;

/**
 * A Vendure core id (product, collection) in canonical decimal form (`'07'` → `'7'`), or `undefined` for a malformed
 * id or one outside the int column range. Keeping such an id from Postgres matters: it would fail with a cast or
 * range error that carries the SQL instead of answering "not found".
 */
export function canonicalCoreId(id: string): string | undefined {
  if (!DECIMAL_DIGITS.test(id)) return undefined;
  const value = BigInt(id);
  if (value < BigInt(MIN_CORE_ID) || value > BigInt(INT_COLUMN_MAX)) return undefined;
  return value.toString();
}

/** The well-formed ids among `ids`, canonical and each once; a malformed one names nothing, so it is left out. */
export function canonicalCoreIds(ids: readonly string[]): string[] {
  const canonical = ids.map(canonicalCoreId).filter((id): id is string => id !== undefined);
  return [...new Set(canonical)];
}

/** A collection id to write under, canonical; a malformed one answers like a foreign one. */
export function writableCollectionId(collectionId: string): string {
  const canonical = canonicalCoreId(collectionId);
  if (canonical === undefined) throw new CollectionNotFoundError();
  return canonical;
}

/**
 * The placements of one product with canonical collection ids, the first one of a repeated collection kept, so a
 * collection is joined once; a malformed collection id is refused like a foreign one before anything is written.
 */
export function distinctPlacements<P extends { readonly collectionId: string }>(placements: readonly P[]): P[] {
  const byCollection = new Map<string, P>();
  for (const placement of placements) {
    const collectionId = writableCollectionId(placement.collectionId);
    if (!byCollection.has(collectionId)) byCollection.set(collectionId, { ...placement, collectionId });
  }
  return [...byCollection.values()];
}
