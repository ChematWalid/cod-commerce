import { COLLECTIONS_ERROR_CODES, type DomainError } from '@cod/shared';
import type { z } from 'zod';
import { InvalidCollectionInputError, InvalidCollectionRuleError, TooManyManualProductsError } from '../domain/errors';

/** The shared schemas' refusals that carry their own code; every other one is invalid input. */
const CODED_REFUSALS: ReadonlyMap<string, new () => DomainError> = new Map<string, new () => DomainError>([
  [COLLECTIONS_ERROR_CODES.RULE_INVALID, InvalidCollectionRuleError],
  [COLLECTIONS_ERROR_CODES.TOO_MANY_PRODUCTS, TooManyManualProductsError],
]);

/**
 * Parses a request body or GraphQL input with a shared schema (ADR 0017 §1).
 *
 * @throws {InvalidCollectionRuleError} or {TooManyManualProductsError} when the first refusal is coded so.
 * @throws {InvalidCollectionInputError} for any other refusal, naming no value, so nothing the caller sent is echoed.
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const coded = CODED_REFUSALS.get(parsed.error.issues[0]?.message ?? '');
  throw coded === undefined ? new InvalidCollectionInputError() : new coded();
}

/**
 * A route or argument id as text. GraphQL `ID` arguments arrive decoded (a number, or -1 for text that names no row);
 * the use cases parse it and answer "not found" for any malformed one.
 */
export function idArgOf(input: unknown): string {
  return typeof input === 'string' || typeof input === 'number' ? String(input) : '';
}
