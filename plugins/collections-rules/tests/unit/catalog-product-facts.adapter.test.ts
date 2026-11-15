import { CATALOG_FACTS_MAX_IDS, type CatalogProductFacts, type CatalogProductFactsReader } from '@cod/plugin-catalog';
import { describe, expect, it } from 'vitest';
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
});
