import type { DomainError } from '@cod/shared';
import { QueryFailedError } from 'typeorm';

/** Postgres' code for a row that references a missing one. */
const FOREIGN_KEY_VIOLATION = '23503';

const isForeignKeyViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError && (error.driverError as { code?: unknown }).code === FOREIGN_KEY_VIOLATION;

/**
 * Awaits `write`, turning an FK refusal into the domain error `toError` makes, so the raw driver error (which names
 * the constraint and the table) never reaches an API; any other failure is rethrown unchanged.
 */
export async function onForeignKeyViolation<T>(write: Promise<T>, toError: () => DomainError): Promise<T> {
  try {
    return await write;
  } catch (error: unknown) {
    if (isForeignKeyViolation(error)) throw toError();
    throw error;
  }
}
