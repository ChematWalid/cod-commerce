import { type ConfigService, Logger, type ProductService, type ProductVariantService } from '@vendure/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { asOperationContext } from '../../domain/ports/operation-context';
import { SEARCH_MATCH_LIMIT, VendureProductSearch } from '../../infrastructure/vendure-product-search.adapter';

const ctx = asOperationContext({ apiType: 'admin' });
const page = <T>(items: T[], totalItems = items.length) => Promise.resolve({ items, totalItems });
/** Vendure's list caps; small ones here so a test can see the pages. */
const config = { apiOptions: { adminListQueryLimit: 1000, shopListQueryLimit: 2 } } as unknown as ConfigService;

function searchOver(productItems: { id: number }[], variantItems: { productId: number }[], variantTotal?: number) {
  const productFindAll = vi.fn(() => page(productItems));
  const variantFindAll = vi.fn(() => page(variantItems, variantTotal));
  const search = new VendureProductSearch(
    { findAll: productFindAll } as unknown as ProductService,
    { findAll: variantFindAll } as unknown as ProductVariantService,
    config,
  );
  return { search, productFindAll, variantFindAll };
}

/** A pre-query over `rows` that answers the page its options ask for. */
const pagedOver =
  <T>(rows: T[]) =>
  (_ctx: unknown, options: { skip: number; take: number }) =>
    page(rows.slice(options.skip, options.skip + options.take), rows.length);

describe('VendureProductSearch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('searches names on products and SKUs and barcodes on live variants only, merging product ids', async () => {
    // Arrange
    const { search, productFindAll, variantFindAll } = searchOver([{ id: 7 }], [{ productId: 7 }, { productId: 9 }]);

    // Act
    const ids = await search.matchingProductIds(ctx, 'SHOE');

    // Assert
    expect(ids).toEqual(['7', '9']);
    expect(productFindAll).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({ filter: { name: { contains: 'SHOE' } } }),
      [],
    );
    expect(variantFindAll).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        filter: { sku: { contains: 'SHOE' }, barcode: { contains: 'SHOE' } },
        filterOperator: 'OR',
      }),
    );
  });

  it('pages the pre-queries at the shop list cap for a REST call, so a search never asks past it', async () => {
    // Arrange: REST requests reach Vendure as the shop API, whose cap is smaller than the admin one.
    const restCtx = asOperationContext({ apiType: 'shop' });
    const productFindAll = vi.fn(pagedOver([{ id: 1 }, { id: 2 }, { id: 3 }]));
    const variantFindAll = vi.fn(pagedOver([{ productId: 4 }, { productId: 5 }, { productId: 6 }]));
    const search = new VendureProductSearch(
      { findAll: productFindAll } as unknown as ProductService,
      { findAll: variantFindAll } as unknown as ProductVariantService,
      config,
    );

    // Act
    const ids = await search.matchingProductIds(restCtx, 'SHOE');

    // Assert
    expect(ids).toEqual(['1', '2', '3', '4', '5', '6']);
    const calls = [...productFindAll.mock.calls, ...variantFindAll.mock.calls].map(([, options]) => options);
    expect(Math.max(...calls.map((options) => options.take))).toBeLessThanOrEqual(2);
    // Without an order, Postgres may hand back consecutive pages that overlap or skip rows.
    for (const options of calls) expect(options).toEqual(expect.objectContaining({ sort: { id: 'ASC' } }));
  });

  it('stops at the match limit when a term matches more, trimming the last page and logging the cut', async () => {
    // Arrange: a 300-row page reads 300, 300, 300, then only the 100 rows left under the limit.
    const warned = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    const rows = Array.from({ length: SEARCH_MATCH_LIMIT + 1 }, (_, index) => ({ id: index + 1 }));
    const productFindAll = vi.fn(pagedOver(rows));
    const wideConfig = {
      apiOptions: { adminListQueryLimit: 1000, shopListQueryLimit: 300 },
    } as unknown as ConfigService;
    const search = new VendureProductSearch(
      { findAll: productFindAll } as unknown as ProductService,
      { findAll: vi.fn(pagedOver([])) } as unknown as ProductVariantService,
      wideConfig,
    );

    // Act
    const ids = await search.matchingProductIds(asOperationContext({ apiType: 'shop' }), 'SHOE');

    // Assert
    expect(ids).toHaveLength(SEARCH_MATCH_LIMIT);
    expect(productFindAll.mock.calls.map(([, options]) => options.take)).toEqual([300, 300, 300, 100]);
    expect(warned).toHaveBeenCalledTimes(1);
  });

  it('stops paging at a short page, even when the total promises more', async () => {
    // Arrange: the total counts 5 rows, but the second page comes back short (rows gone between the two reads).
    const productFindAll = vi.fn((_ctx: unknown, options: { skip: number; take: number }) =>
      page([{ id: 1 }, { id: 2 }, { id: 3 }].slice(options.skip, options.skip + options.take), 5),
    );
    const search = new VendureProductSearch(
      { findAll: productFindAll } as unknown as ProductService,
      { findAll: vi.fn(pagedOver([])) } as unknown as ProductVariantService,
      config,
    );

    // Act
    const ids = await search.matchingProductIds(asOperationContext({ apiType: 'shop' }), 'SHOE');

    // Assert
    expect(ids).toEqual(['1', '2', '3']);
    expect(productFindAll).toHaveBeenCalledTimes(2);
  });

  it('logs a warning, without the text, when a pre-query is cut at the limit', async () => {
    // Arrange
    const warned = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined);
    const { search } = searchOver([], [{ productId: 1 }], SEARCH_MATCH_LIMIT + 1);

    // Act
    await search.matchingProductIds(ctx, 'synthetic-term');

    // Assert
    expect(warned).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warned.mock.calls)).not.toContain('synthetic-term');
  });
});
