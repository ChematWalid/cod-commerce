/**
 * A stored definition row that breaks the stored shape: an unknown mode or a rule the shared schema refuses (a row
 * without a store only if the CHECK `collections_definition_store_required` were dropped). That is server-side corruption, never the caller's input, so it is no `DomainError` (and lives outside
 * `errors.ts`, which holds one error per API code): an API answers it as an internal error and the logs get the row's
 * ids, never its rule content.
 */
export class CorruptCollectionDefinitionError extends Error {
  constructor(
    readonly businessId: string,
    readonly definitionId: string,
  ) {
    super(`Stored collection definition ${definitionId} of business ${businessId} breaks the stored shape`);
    this.name = 'CorruptCollectionDefinitionError';
  }
}
