import type { z } from 'zod';
import { InvalidImportInputError } from '../domain/errors';

/**
 * Parses a request body or GraphQL input with a shared schema (ADR 0017 §1).
 *
 * @throws {InvalidImportInputError} for any refusal, the reused catalog pieces' included (D2228), naming no value.
 */
export function parseImportInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new InvalidImportInputError();
  return parsed.data;
}
