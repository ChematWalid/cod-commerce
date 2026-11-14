import { OrderManagersUnavailableError, OrderManagerUnknownError } from './errors';

/**
 * Checks the order managers a product names against the members the team check accepts for the product's store
 * (D2114). `known` is `null` when no team check is registered: then only an empty list is accepted.
 *
 * @throws {OrderManagersUnavailableError} when `requested` is not empty and `known` is `null`.
 * @throws {OrderManagerUnknownError} when an id of `requested` is not in `known`.
 */
export function assertOrderManagers(requested: readonly string[], known: ReadonlySet<string> | null): void {
  if (requested.length === 0) {
    return;
  }
  if (known === null) {
    throw new OrderManagersUnavailableError();
  }
  if (requested.some((id) => !known.has(id))) {
    throw new OrderManagerUnknownError();
  }
}
