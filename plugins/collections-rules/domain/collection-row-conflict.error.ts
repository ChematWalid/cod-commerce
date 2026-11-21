/**
 * A write that hit one of the collections tables' unique keys: a second definition for a collection, or a member row
 * written twice by writers that skipped the store lock (D2334). Both are programming faults, never the caller's input,
 * so it is no `DomainError` (and lives outside `errors.ts`, which holds one error per API code): an API answers it as
 * an internal error. The message names the table, never the constraint or the values.
 */
export class CollectionRowConflictError extends Error {
  constructor(readonly table: 'collections_definition' | 'collections_member') {
    super(`A ${table} row with the same key already exists`);
    this.name = 'CollectionRowConflictError';
  }
}
