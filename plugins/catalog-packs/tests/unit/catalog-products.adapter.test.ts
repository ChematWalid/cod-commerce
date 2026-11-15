import type { CatalogProductCommands } from '@cod/plugin-catalog';
import { CATALOG_ERROR_CODES, DomainError } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidPackInputError, PackNotFoundError } from '../../domain/errors';
import { CatalogProductsAdapter } from '../../infrastructure/catalog-products.adapter';
import { CTX, SCOPE_A } from '../fakes/pack-world';

/** A catalog refusal with `code`, as the facade throws it. */
class CatalogRefusal extends DomainError {
  constructor(readonly code: string) {
    super('catalog refusal');
  }
}

/** An adapter whose facade throws `error` on every call. */
const failingWith = (error: Error): CatalogProductsAdapter =>
  new CatalogProductsAdapter({
    byId: () => Promise.reject(error),
    writePackValues: () => Promise.reject(error),
    lockForPackSave: () => Promise.reject(error),
  } as unknown as CatalogProductCommands);

const WRITE = { productId: '20', price: 1, weight: 0, sharedOption: null };

describe('CatalogProductsAdapter error translation', () => {
  it("answers catalog's not found as the pack's not found", async () => {
    // Arrange
    const adapter = failingWith(new CatalogRefusal(CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND));

    // Act
    const reading = adapter.byId(CTX, SCOPE_A, '20');

    // Assert
    await expect(reading).rejects.toThrow(PackNotFoundError);
  });

  it("answers catalog's refusal of the save locks as the pack's not found (D2242)", async () => {
    // Arrange
    const adapter = failingWith(new CatalogRefusal(CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND));

    // Act
    const locking = adapter.lockForSave(CTX, SCOPE_A, { packProductId: '20', componentIds: ['11'] });

    // Assert
    await expect(locking).rejects.toThrow(PackNotFoundError);
  });

  it('answers any other catalog refusal as invalid pack input', async () => {
    // Arrange
    const adapter = failingWith(new CatalogRefusal(CATALOG_ERROR_CODES.INVALID_INPUT));

    // Act
    const writing = adapter.writePackValues(CTX, SCOPE_A, WRITE);

    // Assert
    await expect(writing).rejects.toThrow(InvalidPackInputError);
  });

  it('keeps a concurrent edit and a fault as they are', async () => {
    // Arrange
    const concurrent = new CatalogRefusal(CATALOG_ERROR_CODES.CONCURRENT_UPDATE);
    const fault = new Error('database down');

    // Act
    const racing = failingWith(concurrent).writePackValues(CTX, SCOPE_A, WRITE);
    const failing = failingWith(fault).byId(CTX, SCOPE_A, '20');

    // Assert
    await expect(racing).rejects.toBe(concurrent);
    await expect(failing).rejects.toBe(fault);
  });
});
