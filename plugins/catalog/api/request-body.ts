import type { z } from 'zod';
import { InvalidCatalogInputError } from '../domain/errors';

/**
 * Parses a request body or GraphQL input with a shared schema (ADR 0017 §1).
 *
 * @throws {InvalidCatalogInputError} naming no value, so nothing the caller sent is echoed.
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new InvalidCatalogInputError();
  return parsed.data;
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
