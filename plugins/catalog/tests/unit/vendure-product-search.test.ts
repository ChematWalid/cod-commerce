import { Logger, type ProductService, type ProductVariantService } from '@vendure/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { asOperationContext } from '../../domain/ports/operation-context';
import { SEARCH_MATCH_LIMIT, VendureProductSearch } from '../../infrastructure/vendure-product-search.adapter';

const ctx = asOperationContext({});
const page = <T>(items: T[], totalItems = items.length) => Promise.resolve({ items, totalItems });

function searchOver(productItems: { id: number }[], variantItems: { productId: number }[], variantTotal?: number) {
  const productFindAll = vi.fn(() => page(productItems));
  const variantFindAll = vi.fn(() => page(variantItems, variantTotal));
  const search = new VendureProductSearch(
    { findAll: productFindAll } as unknown as ProductService,
    { findAll: variantFindAll } as unknown as ProductVariantService,
  );
  return { search, productFindAll, variantFindAll };
}

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
