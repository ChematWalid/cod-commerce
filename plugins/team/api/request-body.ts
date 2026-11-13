import { isSnowflake, type Snowflake } from '@cod/shared';
import type { z } from 'zod';
import { CommissionNotFoundError, InvalidInputError, MemberNotFoundError } from '../domain/errors';

/**
 * Parses a request body or GraphQL input with a shared schema (ADR 0017 §1).
 *
 * @throws {InvalidInputError} naming no value, so a refused password or token is never echoed.
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new InvalidInputError();
  return parsed.data;
}

/** A member id from a body or route. @throws {MemberNotFoundError} for text that can name no member, as for one of none. */
export function memberIdOf(input: unknown): Snowflake {
  if (typeof input !== 'string' || !isSnowflake(input)) throw new MemberNotFoundError();
  return input;
}

/** A commission config id from a route. @throws {CommissionNotFoundError} for text that can name no config. */
export function commissionIdOf(input: unknown): Snowflake {
  if (typeof input !== 'string' || !isSnowflake(input)) throw new CommissionNotFoundError();
  return input;
}

/** The named field of a JSON body, as sent. */
export function fieldOf(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>)[name] : undefined;
}
