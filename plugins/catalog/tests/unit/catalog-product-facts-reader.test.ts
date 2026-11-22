import { PRODUCT_SEARCH_MAX } from '@cod/shared';
import type { RequestContext } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import type { CoreId } from '../../domain/core-id';
import { CatalogStoreChannelMismatchError } from '../../application/product-facts';
import { InvalidCatalogInputError } from '../../domain/errors';
import type { BrandRepositoryPort } from '../../domain/ports/brand-repository.port';
import type { StoreSettingsPort } from '../../domain/ports/store-settings.port';
import type { TagRepositoryPort } from '../../domain/ports/tag-repository.port';
import {
  CATALOG_FACTS_MAX_IDS,
  CatalogProductFactsReader,
  type CatalogFactsPage,
} from '../../infrastructure/catalog-product-facts';
import type { VendureProductFactsQuery } from '../../infrastructure/vendure-product-facts.query';
import { scopeA } from '../support/builders';

const ctx = { apiType: 'admin' } as unknown as RequestContext;
const PAGE_IDS = ['9', '8'] as CoreId[];

/** A reader over stub ports whose store channel always matches; the query's calls are recorded. */
function readerOverStubs(channelMatches = true) {
  const query = {
    products: vi.fn(() => Promise.resolve([])),
    variants: vi.fn(() => Promise.resolve([])),
    pageIds: vi.fn(() => Promise.resolve(PAGE_IDS)),
    options: vi.fn(() => Promise.resolve([])),
    weights: vi.fn(() =>
      Promise.resolve([
        { productId: '7' as CoreId, weight: 1200 },
        { productId: '8' as CoreId, weight: null },
      ]),
    ),
  };
  const stores = { isChannelOf: () => Promise.resolve(channelMatches) } as unknown as StoreSettingsPort;
  const tags = { tagIdsOfProducts: () => Promise.resolve(new Map()) } as unknown as TagRepositoryPort;
  const reader = new CatalogProductFactsReader(
    query as unknown as VendureProductFactsQuery,
    stores,
    tags,
    {} as BrandRepositoryPort,
  );
  return { reader, query };
}

describe('CatalogProductFactsReader guards', () => {
  it('refuses more than the most ids one facts read takes, before any query', async () => {
    // Arrange
    const { reader, query } = readerOverStubs();

    // Act
    const read = reader.factsOf(ctx, scopeA, Array<string>(CATALOG_FACTS_MAX_IDS + 1).fill('1'));

    // Assert
    await expect(read).rejects.toBeInstanceOf(InvalidCatalogInputError);
    expect(query.products).not.toHaveBeenCalled();
  });

  it.each([0, CATALOG_FACTS_MAX_IDS + 1, 1.5])('refuses a take of %s before any query', async (take) => {
    // Arrange
    const { reader, query } = readerOverStubs();

    // Act
    const read = reader.pageIds(ctx, scopeA, { after: null, take });

    // Assert
    await expect(read).rejects.toBeInstanceOf(InvalidCatalogInputError);
    expect(query.pageIds).not.toHaveBeenCalled();
  });

  it.each(['0', '-5', '3000000000', 'abc'])('refuses a malformed after %s before any query', async (after) => {
    // Arrange
    const { reader, query } = readerOverStubs();
    const page = { after: after as CoreId, take: 10 } satisfies CatalogFactsPage;

    // Act
    const read = reader.pageIds(ctx, scopeA, page);

    // Assert
    await expect(read).rejects.toBeInstanceOf(InvalidCatalogInputError);
    expect(query.pageIds).not.toHaveBeenCalled();
  });

  it('refuses a search longer than the catalog search cap before any query', async () => {
    // Arrange
    const { reader, query } = readerOverStubs();

    // Act
    const read = reader.pageIds(ctx, scopeA, { after: null, take: 10, search: 'x'.repeat(PRODUCT_SEARCH_MAX + 1) });

    // Assert
    await expect(read).rejects.toBeInstanceOf(InvalidCatalogInputError);
    expect(query.pageIds).not.toHaveBeenCalled();
  });

  it('reads a blank search as no search, and asks one id more than the page to find the next one', async () => {
    // Arrange
    const { reader, query } = readerOverStubs();

    // Act
    const page = await reader.pageIds(ctx, scopeA, { after: '10' as CoreId, take: 1, search: '   ' });

    // Assert
    expect(query.pageIds).toHaveBeenCalledWith(ctx, { after: '10', limit: 2, search: null });
    expect(page).toEqual({ ids: ['9'], next: '9' });
  });
});

describe('CatalogProductFactsReader weights (D3119)', () => {
  it("answers each live product's weight in grams, null when none is set, from one read of the parsed ids", async () => {
    // Arrange
    const { reader, query } = readerOverStubs();

    // Act
    const weights = await reader.weightsOf(ctx, scopeA, ['7', '8', '07', 'abc']);

    // Assert
    expect(query.weights).toHaveBeenCalledWith(ctx, ['7', '8']);
    expect([...weights]).toEqual([
      ['7', 1200],
      ['8', null],
    ]);
  });

  it('reads nothing for ids that name no product', async () => {
    // Arrange
    const { reader, query } = readerOverStubs();

    // Act
    const weights = await reader.weightsOf(ctx, scopeA, ['abc', '0']);

    // Assert
    expect(weights.size).toBe(0);
    expect(query.weights).not.toHaveBeenCalled();
  });

  it('refuses more than the most ids one read takes, before any query', async () => {
    // Arrange
    const { reader, query } = readerOverStubs();

    // Act
    const read = reader.weightsOf(ctx, scopeA, Array<string>(CATALOG_FACTS_MAX_IDS + 1).fill('1'));

    // Assert
    await expect(read).rejects.toBeInstanceOf(InvalidCatalogInputError);
    expect(query.weights).not.toHaveBeenCalled();
  });

  it("refuses a context that is not on the store's channel", async () => {
    // Arrange
    const { reader, query } = readerOverStubs(false);

    // Act
    const read = reader.weightsOf(ctx, scopeA, ['7']);

    // Assert
    await expect(read).rejects.toBeInstanceOf(CatalogStoreChannelMismatchError);
    expect(query.weights).not.toHaveBeenCalled();
  });
});
