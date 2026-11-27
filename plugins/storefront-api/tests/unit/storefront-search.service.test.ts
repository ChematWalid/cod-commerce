import { STOREFRONT_LIST_MAX_TAKE } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { StorefrontSearchService } from '../../application/storefront-search.service';
import { DARIJA_SYNONYMS } from '../../domain/darija-synonyms';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { ProjectionRow } from '../../domain/projection-row';
import { FakeStorefrontStores, STORE_A, STORE_B } from '../fakes/fake-storefront';
import { FakeStorefrontSearch, InMemorySynonyms } from '../fakes/fake-search';
import { InMemoryProjectionRepository } from '../fakes/in-memory-projection.repository';

const row = (id: string, searchText: string, overrides: Partial<ProjectionRow> = {}): ProjectionRow => ({
  productId: id,
  slug: `p-${id}`,
  name: searchText,
  searchText,
  price: 100,
  oldPrice: null,
  imagePath: null,
  visible: true,
  soldOut: false,
  listed: true,
  createdAt: new Date(Number(id) * 1000),
  ...overrides,
});

async function setUp() {
  const stores = new FakeStorefrontStores().add(STORE_A).add(STORE_B);
  const projection = new InMemoryProjectionRepository();
  const search = new FakeStorefrontSearch(projection);
  const synonyms = new InMemorySynonyms();
  const service = new StorefrontSearchService({ stores, search, synonyms });
  const write = asOperationContext({});
  await projection.save(write, STORE_A, row('1', 'سباط ابيض'));
  await projection.save(write, STORE_A, row('2', 'sabbat sport'));
  await projection.save(write, STORE_A, row('3', 'sabbat cache', { listed: false }));
  await projection.save(write, STORE_B, row('9', 'sabbat foreign'));
  return { service, search, synonyms, ctxA: stores.contextOf(STORE_A), ctxB: stores.contextOf(STORE_B) };
}

describe('StorefrontSearchService.search', () => {
  it("finds the store's listed products by the query, then by its Darija synonym, never another store's", async () => {
    // Arrange
    const { service, ctxA } = await setUp();

    // Act
    const page = await service.search(ctxA, { q: 'Sabbat' });

    // Assert
    expect(page.items.map((item) => item.id)).toEqual(['2', '1']);
    expect(page).toMatchObject({ totalItems: 2, skip: 0, take: 24 });
  });

  it('seeds the business with the Darija list on its first search, and only that business', async () => {
    // Arrange
    const { service, synonyms, ctxA } = await setUp();

    // Act
    await service.search(ctxA, { q: 'kaftan' });

    // Assert
    expect(synonyms.pairsOf(STORE_A)).toEqual(DARIJA_SYNONYMS);
    expect(synonyms.pairsOf(STORE_B)).toEqual([]);
  });

  it("never expands a query with another business's synonyms", async () => {
    // Arrange
    const { service, synonyms, search, ctxA } = await setUp();
    synonyms.pairsOf(STORE_B).push({ term: 'zorba', expansion: 'سباط' });

    // Act
    const page = await service.search(ctxA, { q: 'zorba' });

    // Assert
    expect(page.items).toEqual([]);
    expect(search.searches.at(-1)?.variants).toEqual(['zorba']);
  });

  it.each([undefined, 'a', '  ', ['sabbat', 'x']])('answers an empty page without searching for q=%j', async (q) => {
    // Arrange
    const { service, search, ctxA } = await setUp();

    // Act
    const page = await service.search(ctxA, { q, skip: '2', take: '5' });

    // Assert
    expect(page).toEqual({ items: [], totalItems: 0, skip: 2, take: 5 });
    expect(search.searches).toEqual([]);
  });

  it('clamps the page like a list and searches the signed store only', async () => {
    // Arrange
    const { service, search, ctxB } = await setUp();

    // Act
    const page = await service.search(ctxB, { q: 'sabbat', take: '1000', skip: '-3' });

    // Assert
    expect(page.items.map((item) => item.id)).toEqual(['9']);
    expect(search.searches.at(-1)).toMatchObject({ scope: STORE_B, page: { skip: 0, take: STOREFRONT_LIST_MAX_TAKE } });
  });
});
