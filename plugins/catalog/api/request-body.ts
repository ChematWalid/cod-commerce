import { CATALOG_ERROR_CODES, type DomainError } from '@cod/shared';
import type { z } from 'zod';
import { InvalidCatalogInputError, MatrixTooLargeError, TooManyHighlightsError } from '../domain/errors';

/** The shared schemas' refusals that carry their own code (brief AC3, D2124); every other one is invalid input. */
const CODED_REFUSALS: ReadonlyMap<string, new () => DomainError> = new Map<string, new () => DomainError>([
  [CATALOG_ERROR_CODES.TOO_MANY_HIGHLIGHTS, TooManyHighlightsError],
  [CATALOG_ERROR_CODES.MATRIX_TOO_LARGE, MatrixTooLargeError],
]);

/**
 * Parses a request body or GraphQL input with a shared schema (ADR 0017 §1).
 *
 * @throws {TooManyHighlightsError} or {MatrixTooLargeError} when the first refusal is that cap.
 * @throws {InvalidCatalogInputError} for any other refusal, naming no value, so nothing the caller sent is echoed.
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const coded = CODED_REFUSALS.get(parsed.error.issues[0]?.message ?? '');
  throw coded === undefined ? new InvalidCatalogInputError() : new coded();
}

/**
 * A route or argument id as text. GraphQL `ID` arguments arrive decoded (a number, or -1 for text that names no row);
 * the use cases parse it and answer "not found" for any malformed one (D2136).
 */
export function idArgOf(input: unknown): string {
  return typeof input === 'string' || typeof input === 'number' ? String(input) : '';
}

/** The named field of a JSON body, as sent. */
export function fieldOf(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[name] : undefined;
}
