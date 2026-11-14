import { z } from 'zod';
import { isSnowflake } from '../ids/snowflake';
import { hasBidiControl, hasControlCharacter } from '../text/control-characters';
import { CATALOG_ID_MAX_LENGTH, INT_COLUMN_MAX } from './constants';
import { CATALOG_ERROR_CODES } from './error-codes';

/** The issue message of every shape refusal of a catalog body. */
export const invalidCatalogInput = { message: CATALOG_ERROR_CODES.INVALID_INPUT };

/**
 * A single-line catalog text (title, SKU, slug, name…): trimmed, non-empty, at most `max` characters, with no control
 * character and no bidi override or isolate (D2144). Arabic direction marks (LRM, RLM, ALM) are accepted.
 */
export function catalogTextSchema(max: number) {
  return z
    .string(invalidCatalogInput)
    .trim()
    .min(1, invalidCatalogInput)
    .max(max, invalidCatalogInput)
    .refine((value) => !hasControlCharacter(value) && !hasBidiControl(value), invalidCatalogInput);
}

/**
 * An id the body refers to (a Vendure product, variant, asset or collection, or our brand, tag or highlight),
 * as a string. GraphQL `ID` arguments may arrive decoded as numbers. Only the length is bounded here: the API boundary
 * parses the id and answers "not found" for a malformed one, as for a foreign one (D2136).
 */
export const catalogRefIdSchema = z
  .union([z.string().max(CATALOG_ID_MAX_LENGTH, invalidCatalogInput), z.number()], invalidCatalogInput)
  .transform((id) => String(id));

const hasNoRepeat = (ids: readonly string[]): boolean => new Set(ids).size === ids.length;

/** At most `max` referenced ids, never the same one twice (a link table would refuse the repeat with a 500). */
export function catalogRefIdListSchema(max: number, tooMany: { message: string } = invalidCatalogInput) {
  return z.array(catalogRefIdSchema, invalidCatalogInput).max(max, tooMany).refine(hasNoRepeat, invalidCatalogInput);
}

/** At most `max` snowflake ids of ours, never the same one twice. */
export function snowflakeListSchema(max: number) {
  return z
    .array(z.string(invalidCatalogInput).refine(isSnowflake, invalidCatalogInput), invalidCatalogInput)
    .max(max, invalidCatalogInput)
    .refine(hasNoRepeat, invalidCatalogInput);
}

/** A non-negative whole number stored in an `int` column (sizes in grams or centimetres, D2125). */
export const intColumnSchema = z
  .number(invalidCatalogInput)
  .int(invalidCatalogInput)
  .min(0, invalidCatalogInput)
  .max(INT_COLUMN_MAX, invalidCatalogInput);
