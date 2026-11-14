import type { DomainError } from '@cod/shared';
import { QueryFailedError } from 'typeorm';

/** Postgres' code for a unique violation. */
const UNIQUE_VIOLATION = '23505';

/** Whether `error` is Postgres refusing a row that breaks a unique index. */
export const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError && (error.driverError as { code?: unknown }).code === UNIQUE_VIOLATION;

/**
 * Awaits `write`, turning a unique-index refusal into the domain error `toError` makes, so the raw driver error (which
 * names the constraint) never reaches an API; any other failure is rethrown unchanged.
 */
export async function onUniqueViolation<T>(write: Promise<T>, toError: () => DomainError): Promise<T> {
  try {
    return await write;
  } catch (error: unknown) {
    if (isUniqueViolation(error)) throw toError();
    throw error;
  }
}
