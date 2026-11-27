import { z } from 'zod';
import { CATALOG_ID_MAX_LENGTH, INT_COLUMN_MAX } from '../catalog/constants';
import { hasNoRepeatedId } from '../catalog/fields';
import { hasBidiControl, hasControlCharacter, hasLoneSurrogate } from '../text/control-characters';
import { COLLECTIONS_ERROR_CODES } from './error-codes';

/**
 * The issue of every shape refusal of a collections body. Issues are code strings, not `{ message }` objects: Zod
 * rewrites a params object in place (it moves `message` to `error`), so a shared object would lose its `message`.
 */
export const invalidCollectionInput: CollectionIssue = COLLECTIONS_ERROR_CODES.INVALID_INPUT;

/** The issue of every refusal of a rule, wherever the rule is nested. */
export const invalidCollectionRule: CollectionIssue = COLLECTIONS_ERROR_CODES.RULE_INVALID;

/** An issue to refuse with: a collections error code, which Zod reports as the issue message. */
export type CollectionIssue = string;

/** A Vendure id as a canonical decimal string: no sign, no leading zero. */
const DECIMAL_ID = /^[1-9]\d*$/;

/** True when `value` holds no control character, bidi override or lone surrogate (D2144). */
export const isCleanLine = (value: string): boolean =>
  !hasControlCharacter(value) && !hasBidiControl(value) && !hasLoneSurrogate(value);

/** A single-line text: trimmed, non-empty, at most `max` characters, clean (rules of `catalogTextSchema`). */
export function collectionTextSchema(max: number, issue: CollectionIssue) {
  return z.string(issue).trim().min(1, issue).max(max, issue).refine(isCleanLine, issue);
}

/**
 * A Vendure id (collection, product, asset) as a string. A GraphQL `ID` may arrive as a number; one that is not a safe
 * integer has lost digits, so it is refused. Only the length is bounded here: the API boundary answers "not found" for
 * a malformed id, as for a foreign one.
 */
export const collectionRefIdSchema = z
  .union(
    [
      z.string(invalidCollectionInput).max(CATALOG_ID_MAX_LENGTH, invalidCollectionInput),
      z.number(invalidCollectionInput).refine(Number.isSafeInteger, invalidCollectionInput),
    ],
    invalidCollectionInput,
  )
  .transform((id) => String(id));

/** At most `max` Vendure ids, never one twice (`"07"` and `"7"` are one id). */
export function collectionRefIdListSchema(max: number, tooMany: CollectionIssue = invalidCollectionInput) {
  return z
    .array(collectionRefIdSchema, invalidCollectionInput)
    .max(max, tooMany)
    .refine(hasNoRepeatedId, invalidCollectionInput);
}

/**
 * A Vendure id as Vendure itself writes it (event payloads, stored references): a canonical decimal string within the
 * int column range, so a parsed id never reaches Postgres out of range.
 */
export const vendureIdStringSchema = z
  .string(invalidCollectionInput)
  .regex(DECIMAL_ID, invalidCollectionInput)
  // eslint-disable-next-line cod-ids/no-numeric-id -- Vendure core id: an int4 column value, exact as a number
  .refine((id) => Number(id) <= INT_COLUMN_MAX, invalidCollectionInput);
