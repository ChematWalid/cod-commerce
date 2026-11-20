import { CATALOG_MAX_AMONG_IDS, type CatalogReadService, type PublicListContext } from '@cod/plugin-catalog';
import { Logger } from '@vendure/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { asOperationContext } from '../../domain/ports/operation-context';
import { CatalogVisibleProducts } from '../../infrastructure/catalog-visible-products.adapter';
import { scopeA } from '../support/builders';

const ctx = asOperationContext({});
const PAGE = { skip: 0, take: 10 };
const LISTING: PublicListContext = 'listing';

/** A catalog read that records the product ids each `listVisible` call was given. */
function stubCatalog(): { reads: CatalogReadService; given: unknown[][] } {
  const given: unknown[][] = [];
  const listVisible = (_ctx: unknown, _context: unknown, options: { productIds: unknown[] }) => {
    given.push(options.productIds);
    return Promise.resolve({ items: [], totalItems: 0 });
  };
  return { reads: { listVisible } as unknown as CatalogReadService, given };
}

const idsUpTo = (count: number): string[] => Array.from({ length: count }, (_, index) => String(count - index));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CatalogVisibleProducts.newestAmong (D2310 cap)', () => {
  it('over the cap warns once per collection, naming it, and forwards only the first cap ids', async () => {
    // Arrange
    const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    const { reads, given } = stubCatalog();
    const adapter = new CatalogVisibleProducts(reads);
    const ids = idsUpTo(CATALOG_MAX_AMONG_IDS + 1);
    const members = { scope: scopeA, collectionId: '77', productIds: ids };

    // Act
    await adapter.newestAmong(ctx, LISTING, members, PAGE);
    await adapter.newestAmong(ctx, LISTING, members, PAGE);

    // Assert
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain(`collection 77 of store ${scopeA.storeId}`);
    expect(given[0]).toHaveLength(CATALOG_MAX_AMONG_IDS);
    expect(String(given[0]?.[0])).toBe(ids[0]);
  });

  it('at the cap does not warn and forwards every id', async () => {
    // Arrange
    const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    const { reads, given } = stubCatalog();
    const adapter = new CatalogVisibleProducts(reads);
    const members = { scope: scopeA, collectionId: '78', productIds: idsUpTo(CATALOG_MAX_AMONG_IDS) };

    // Act
    await adapter.newestAmong(ctx, LISTING, members, PAGE);

    // Assert
    expect(warn).not.toHaveBeenCalled();
    expect(given[0]).toHaveLength(CATALOG_MAX_AMONG_IDS);
  });
});
