import { SubdomainTakenError } from '../domain/errors';

const POSTGRES_UNIQUE_VIOLATION = '23505';

/** The column named in Postgres's error detail, which outlives the generated constraint name. */
const SUBDOMAIN_KEY_DETAIL = 'Key (subdomain)=';

interface DriverFailure {
  readonly driverError?: { readonly code?: string; readonly detail?: string };
}

function isSubdomainConflict(error: unknown): boolean {
  const driverError = (error as DriverFailure | null)?.driverError;
  return driverError?.code === POSTGRES_UNIQUE_VIOLATION && driverError.detail?.includes(SUBDOMAIN_KEY_DETAIL) === true;
}

/**
 * Awaits a write to `store`, turning the unique index's refusal into {@link SubdomainTakenError}: the index, not the
 * earlier existence check, is what decides a race.
 */
export async function translateSubdomainConflict<T>(write: Promise<T>): Promise<T> {
  try {
    return await write;
  } catch (error: unknown) {
    if (isSubdomainConflict(error)) throw new SubdomainTakenError();
    throw error;
  }
}
