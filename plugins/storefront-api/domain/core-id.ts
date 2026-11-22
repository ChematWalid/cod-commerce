import { INT_COLUMN_MAX } from '@cod/shared';

/** A Vendure core id (product, collection) in decimal digits; leading zeros are dropped by {@link canonicalCoreId}. */
const DECIMAL_DIGITS = /^\d{1,12}$/;

/**
 * A core id in canonical decimal form (`'07'` → `'7'`), or `undefined` for a malformed id or one outside the
 * Postgres `integer` range: such an id never reaches Postgres, where it would fail with SQL in the error (D2136).
 */
export function canonicalCoreId(id: string): string | undefined {
  if (!DECIMAL_DIGITS.test(id)) return undefined;
  const value = Number(id);
  return value >= 1 && value <= INT_COLUMN_MAX ? String(value) : undefined;
}

/** The well-formed ids among `ids`, canonical and each once. */
export function canonicalCoreIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map(canonicalCoreId).filter((id): id is string => id !== undefined))];
}
