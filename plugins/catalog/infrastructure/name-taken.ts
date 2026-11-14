import { QueryFailedError } from 'typeorm';
import { NameTakenError } from '../domain/errors';

/** Postgres' code for a unique violation. */
const UNIQUE_VIOLATION = '23505';

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof QueryFailedError && (error.driverError as { code?: unknown }).code === UNIQUE_VIOLATION;

/**
 * Awaits a brand or tag write, turning the `(businessId, storeId, nameKey)` index's refusal into {@link NameTakenError}:
 * the index, not the use case's earlier lookup, decides a race (D2140). The name key index is the only unique one a
 * name write can break; the id is a fresh snowflake.
 */
export async function translateNameTaken<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (error: unknown) {
    if (isUniqueViolation(error)) throw new NameTakenError();
    throw error;
  }
}
