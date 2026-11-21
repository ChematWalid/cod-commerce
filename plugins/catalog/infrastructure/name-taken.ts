import { NameTakenError } from '../domain/errors';
import { onUniqueViolation } from './unique-violation';

/**
 * Awaits a brand or tag write, turning the `(businessId, storeId, nameKey)` index's refusal into {@link NameTakenError}:
 * the index, not the use case's earlier lookup, decides a race (D2140). The name key index is the only unique one a
 * name write can break; the id is a fresh snowflake.
 */
export function translateNameTaken<T>(write: Promise<T>): Promise<T> {
  return onUniqueViolation(write, () => new NameTakenError());
}
