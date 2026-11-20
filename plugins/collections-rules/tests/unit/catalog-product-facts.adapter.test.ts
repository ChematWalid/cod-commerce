import { CATALOG_FACTS_MAX_IDS, type CatalogProductFacts, type CatalogProductFactsReader } from '@cod/plugin-catalog';
import { COLLECTION_PRODUCT_SEARCH_MAX } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidCollectionInputError } from '../../domain/errors';
import { asOperationContext } from '../../domain/ports/operation-context';
import { CatalogProductFactsAdapter } from '../../infrastructure/catalog-product-facts.adapter';
import { scopeA } from '../support/builders';

/** A reader that answers every asked id, newest first like the catalog, and records the size of each call. */
function recordingReader(): { reader: CatalogProductFactsReader; callSizes: number[] } {
  const callSizes: number[] = [];
  const factsOf = (_ctx: unknown, _scope: unknown, ids: readonly string[]): Promise<CatalogProductFacts[]> => {
    callSizes.push(ids.length);
    const facts = ids.map(
      (productId) =>
        ({ productId, title: `P${productId}`, tagIds: [], variantOptions: [] }) as unknown as CatalogProductFacts,
    );
    return Promise.resolve(facts.sort((left, right) => Number(right.productId) - Number(left.productId)));
  };
  return { reader: { factsOf } as unknown as CatalogProductFactsReader, callSizes };
}

describe('CatalogProductFactsAdapter', () => {
  it('answers each product once, newest first, across reader-sized chunks', async () => {
    // Arrange
    const { reader, callSizes } = recordingReader();
    const adapter = new CatalogProductFactsAdapter(reader);
    const ids = Array.from({ length: CATALOG_FACTS_MAX_IDS + 50 }, (_, index) => String(index + 1));
    const repeated = [...ids, '5', String(CATALOG_FACTS_MAX_IDS + 10)];

    // Act
    const facts = await adapter.factsOf(asOperationContext({}), scopeA, repeated);

    // Assert
    expect(facts.map((fact) => fact.productId)).toEqual([...ids].reverse());
    expect(Math.max(...callSizes)).toBeLessThanOrEqual(CATALOG_FACTS_MAX_IDS);
  });

  it('reads a padded id and its canonical form as one product, and leaves a malformed id out', async () => {
    // Arrange
    const { reader, callSizes } = recordingReader();
    const adapter = new CatalogProductFactsAdapter(reader);

    // Act
    const facts = await adapter.factsOf(asOperationContext({}), scopeA, ['07', '7', 'abc', '3']);

    // Assert
    expect(facts.map((fact) => fact.productId)).toEqual(['7', '3']);
    expect(callSizes).toEqual([2]);
  });

  it('refuses a malformed page cursor with a collections error', async () => {
    // Arrange
    const { reader } = recordingReader();
    const adapter = new CatalogProductFactsAdapter(reader);

    // Act
    const page = adapter.pageIds(asOperationContext({}), scopeA, { after: 'abc', take: 10 });

    // Assert
    await expect(page).rejects.toBeInstanceOf(InvalidCollectionInputError);
  });

  it('refuses an over-long search with a collections error before the catalog reads it', async () => {
    // Arrange
    let pageCalls = 0;
    const reader = {
      pageIds: () => {
        pageCalls += 1;
        return Promise.resolve({ ids: [], next: null });
      },
    } as unknown as CatalogProductFactsReader;
    const adapter = new CatalogProductFactsAdapter(reader);
    const search = ` ${'x'.repeat(COLLECTION_PRODUCT_SEARCH_MAX + 1)} `;

    // Act
    const page = adapter.pageIds(asOperationContext({}), scopeA, { after: null, take: 10, search });

    // Assert
    await expect(page).rejects.toBeInstanceOf(InvalidCollectionInputError);
    expect(pageCalls).toBe(0);
  });
});
