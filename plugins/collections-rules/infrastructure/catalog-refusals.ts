import { CATALOG_ERROR_CODES, DomainError } from '@cod/shared';
import { CollectionNotFoundError, TooManyManualProductsError } from '../domain/errors';

/** A product write named a collection that is not a manual one of the store, answered as the catalog's own refusal. */
export class CatalogCollectionNotFoundRefusal extends DomainError {
  readonly code = CATALOG_ERROR_CODES.COLLECTION_NOT_FOUND;
  constructor() {
    super('No such collection');
  }
}

/**
 * A product write would pass a collection's manual cap (D2337). The catalog API knows no collections code, so the
 * refusal carries its invalid-input code: a 400 with a translated message instead of an unmapped fault.
 */
export class CatalogCollectionFullRefusal extends DomainError {
  readonly code = CATALOG_ERROR_CODES.INVALID_INPUT;
  constructor() {
    super('A manual collection is full');
  }
}

/** Our refusals of a catalog product write, as the catalog API answers them; any other error passes unchanged. */
export function asCatalogRefusal(error: unknown): unknown {
  if (error instanceof CollectionNotFoundError) return new CatalogCollectionNotFoundRefusal();
  if (error instanceof TooManyManualProductsError) return new CatalogCollectionFullRefusal();
  return error;
}
