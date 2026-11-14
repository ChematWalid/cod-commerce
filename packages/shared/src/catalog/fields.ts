import { z } from 'zod';
import { isSnowflake } from '../ids/snowflake';
import { hasBidiControl, hasControlCharacter, hasLoneSurrogate } from '../text/control-characters';
import { CATALOG_ID_MAX_LENGTH, INT_COLUMN_MAX } from './constants';
import { CATALOG_ERROR_CODES } from './error-codes';

/** The issue message of every shape refusal of a catalog body. */
export const invalidCatalogInput = { message: CATALOG_ERROR_CODES.INVALID_INPUT };

/**
 * An object of a catalog body: a value that is no object (`null`, text, a number, a list) is refused with
 * `catalog.invalid-input`, never with Zod's own English text, so every refusal a client sees is a catalog code.
 */
export function catalogObject<Shape extends z.core.$ZodLooseShape>(shape: Shape) {
  return z.object(shape, invalidCatalogInput);
}

/**
 * How two names of one product or store compare: without outer spaces, case and Unicode form (D2140), so "Café", an
 * NFD "cafe\u0301" and " CAFÉ" are one name.
 */
export const catalogNameKey = (name: string): string => name.trim().normalize('NFC').toLowerCase();

/**
 * A single-line catalog text (title, SKU, slug, name…): trimmed, non-empty, at most `max` characters, with no control
 * character, no bidi override or isolate (D2144) and no lone surrogate. Arabic direction marks (LRM, RLM, ALM) are
 * accepted.
 */
export function catalogTextSchema(max: number) {
  return z
    .string(invalidCatalogInput)
    .trim()
    .min(1, invalidCatalogInput)
    .max(max, invalidCatalogInput)
    .refine(
      (value) => !hasControlCharacter(value) && !hasBidiControl(value) && !hasLoneSurrogate(value),
      invalidCatalogInput,
    );
}

/**
 * An id the body refers to (a Vendure product, variant, asset or collection, or our brand, tag or highlight),
 * as a string. GraphQL `ID` arguments may arrive decoded as numbers; a number that is not a safe integer has already
 * lost digits and could name another row, so it is refused. Otherwise only the length is bounded here: the API
 * boundary parses the id and answers "not found" for a malformed one (`""`, `"abc"`, `"-1"`), as for a foreign one
 * (D2136).
 */
export const catalogRefIdSchema = z
  .union(
    [
      z.string().max(CATALOG_ID_MAX_LENGTH, invalidCatalogInput),
      z.number().refine(Number.isSafeInteger, invalidCatalogInput),
    ],
    invalidCatalogInput,
  )
  .transform((id) => String(id));

const hasNoRepeat = (keys: readonly string[]): boolean => new Set(keys).size === keys.length;

/** The row a referenced id names once the boundary parses it: a decimal id loses its leading zeros. */
function idKey(id: string): string {
  return /^\d+$/.test(id) ? BigInt(id).toString() : id;
}

/** True when no two ids name the same row (`"01"` and `"1"` are the same id). */
export function hasNoRepeatedId(ids: readonly string[]): boolean {
  return hasNoRepeat(ids.map(idKey));
}

/**
 * At most `max` referenced ids, never the same one twice, so a link table never sees a repeat (a 500). The boundary
 * parser must accept only decimal digits, which this check compares by value; any other form answers not found.
 */
export function catalogRefIdListSchema(max: number, tooMany: { message: string } = invalidCatalogInput) {
  return z
    .array(catalogRefIdSchema, invalidCatalogInput)
    .max(max, tooMany)
    .refine(hasNoRepeatedId, invalidCatalogInput);
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
