import { INT_COLUMN_MAX } from '@cod/shared';
import { InvalidCatalogInputError } from './errors';

/**
 * The id of a Vendure row (product, asset) as the catalog carries it: a decimal string of a positive Postgres `integer`
 * (Vendure's SERIAL). Our own rows use snowflakes; a core id is the engine's integer and is never one. Branded so a
 * repository only ever receives a parsed id: a malformed one would reach Postgres and fail with SQL in the error.
 */
export type CoreId = string & { readonly __brand: 'CoreId' };

const CORE_ID_FORMAT = /^[1-9][0-9]{0,9}$/;

/** Whether `value` is a {@link CoreId}: a decimal integer from 1 to `INT_COLUMN_MAX`, without leading zeros. */
export function isCoreId(value: string): value is CoreId {
  return CORE_ID_FORMAT.test(value) && Number(value) <= INT_COLUMN_MAX;
}

/** The parsed id, or `undefined` for a malformed one: an API boundary answers that as "not found" (D2136). */
export function parseCoreId(value: string): CoreId | undefined {
  return isCoreId(value) ? value : undefined;
}

/**
 * Parses an id the caller already trusts (a database row, a test builder).
 *
 * @throws {@link InvalidCatalogInputError} for a malformed id.
 */
export function toCoreId(value: string): CoreId {
  if (!isCoreId(value)) throw new InvalidCatalogInputError();
  return value;
}
