import { QueryFailedError } from 'typeorm';

/** Postgres' code for a row that references a missing one. */
const FOREIGN_KEY_VIOLATION = '23503';
/** Postgres' code for a row that repeats a unique key. */
const UNIQUE_VIOLATION = '23505';

const hasCode = (error: unknown, code: string): boolean =>
  error instanceof QueryFailedError && (error.driverError as { code?: unknown }).code === code;

async function onPostgresCode<T>(code: string, write: Promise<T>, toError: () => Error): Promise<T> {
  try {
    return await write;
  } catch (error: unknown) {
    if (hasCode(error, code)) throw toError();
    throw error;
  }
}

/**
 * Awaits `write`, turning an FK refusal into the error `toError` makes, so the raw driver error (which names the
 * constraint and the table) never reaches an API; any other failure is rethrown unchanged. The mapped error is
 * terminal for the transaction: the failed statement has already aborted it in Postgres, so the caller must not run
 * another statement on it (a caller that needs to go on would wrap the write in a savepoint first).
 */
export function onForeignKeyViolation<T>(write: Promise<T>, toError: () => Error): Promise<T> {
  return onPostgresCode(FOREIGN_KEY_VIOLATION, write, toError);
}

/** Like {@link onForeignKeyViolation}, for a unique-key refusal; equally terminal for the transaction. */
export function onUniqueViolation<T>(write: Promise<T>, toError: () => Error): Promise<T> {
  return onPostgresCode(UNIQUE_VIOLATION, write, toError);
}
