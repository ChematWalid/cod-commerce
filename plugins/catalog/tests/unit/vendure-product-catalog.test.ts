import { CATALOG_MAX_PAGE_SIZE, SLUG_MAX, toSnowflake } from '@cod/shared';
import type { CollectionService, ProductService, ProductVariantService } from '@vendure/core';
import { describe, expect, it, vi } from 'vitest';
import { InvalidCatalogInputError } from '../../domain/errors';
import { toCoreId } from '../../domain/core-id';
import { asOperationContext } from '../../domain/ports/operation-context';
import { VendureProductCatalog } from '../../infrastructure/vendure-product-catalog.adapter';
import type { VendureProductStructure } from '../../infrastructure/vendure-product-structure';

/** The adapter over a product service whose list is empty; the other collaborators are never reached here. */
function catalogOver(findAll: ProductService['findAll']): VendureProductCatalog {
  const products = { findAll } as unknown as ProductService;
  return new VendureProductCatalog(
    products,
    {} as ProductVariantService,
    {} as CollectionService,
    {} as VendureProductStructure,
  );
}

const ctx = asOperationContext({});

describe('VendureProductCatalog.findBySlug', () => {
  it.each([
    ['punctuation only, empty once stored', '???'],
    ['longer than the column once stored as NFD', 'أ'.repeat(SLUG_MAX)],
  ])('refuses a slug a save would refuse, without a query: %s', async (_case, slug) => {
    // Arrange
    const findAll = vi.fn();
    const catalog = catalogOver(findAll);

    // Act
    const looking = catalog.findBySlug(ctx, slug);

    // Assert
    await expect(looking).rejects.toBeInstanceOf(InvalidCatalogInputError);
    expect(findAll).not.toHaveBeenCalled();
  });

  it('looks up the stored NFD form of a valid slug', async () => {
    // Arrange
    const findAll = vi.fn().mockResolvedValue({ items: [], totalItems: 0 });
    const catalog = catalogOver(findAll);

    // Act
    const lookup = await catalog.findBySlug(ctx, 'حذاء أحمر'.normalize('NFC'));

    // Assert
    expect(lookup).toEqual({ slug: 'حذاء-أحمر'.normalize('NFD'), productId: undefined });
  });
});

describe('VendureProductCatalog.lockForUpdate', () => {
  const productId = toCoreId('41');

  function catalogWith(found: boolean) {
    const acquire = vi.fn().mockResolvedValue(undefined);
    const products = {
      findOne: vi.fn().mockResolvedValue(found ? { id: 41 } : undefined),
    } as unknown as ProductService;
    const structure = { lock: { acquire } } as unknown as VendureProductStructure;
    const catalog = new VendureProductCatalog(
      products,
      {} as ProductVariantService,
      {} as CollectionService,
      structure,
    );
    return { catalog, acquire };
  }

  it("takes the product's lock when the store has the product", async () => {
    // Arrange
    const { catalog, acquire } = catalogWith(true);

    // Act
    const locked = await catalog.lockForUpdate(ctx, productId);

    // Assert
    expect(locked).toBe(true);
    expect(acquire).toHaveBeenCalledWith(ctx, productId);
  });

  it('answers false and takes no lock for a product the store does not have', async () => {
    // Arrange
    const { catalog, acquire } = catalogWith(false);

    // Act
    const locked = await catalog.lockForUpdate(ctx, productId);

    // Assert
    expect(locked).toBe(false);
    expect(acquire).not.toHaveBeenCalled();
  });
});

describe('VendureProductCatalog.clearBrand', () => {
  const brandId = toSnowflake('1200000000000000777');
  const otherBrandId = toSnowflake('1200000000000000778');

  /** A store whose products `ids` named the brand when listed; `brandNow` is what each names once locked. */
  function storeWith(ids: readonly number[], brandNow: (id: number) => string | null) {
    const log: string[] = [];
    const findAll = vi.fn((_ctx: unknown, options: { skip: number; take: number }) =>
      Promise.resolve({
        items: ids.slice(options.skip, options.skip + options.take).map((id) => ({ id })),
        totalItems: ids.length,
      }),
    );
    const products = {
      findAll,
      findOne: vi.fn((_ctx: unknown, id: string) => {
        log.push(`read:${id}`);
        return Promise.resolve({ id: Number(id), customFields: { brandId: brandNow(Number(id)) } });
      }),
      update: vi.fn((_ctx: unknown, input: { id: string }) => {
        log.push(`update:${input.id}`);
        return Promise.resolve({});
      }),
    } as unknown as ProductService;
    const acquire = vi.fn((_ctx: unknown, id: string) => {
      log.push(`lock:${id}`);
      return Promise.resolve();
    });
    const structure = { lock: { acquire } } as unknown as VendureProductStructure;
    const catalog = new VendureProductCatalog(
      products,
      {} as ProductVariantService,
      {} as CollectionService,
      structure,
    );
    return { catalog, log, findAll };
  }

  it("reads every page of the brand's products, then locks, re-reads and clears each one", async () => {
    // Arrange
    const ids = Array.from({ length: CATALOG_MAX_PAGE_SIZE + 1 }, (_, index) => index + 1);
    const { catalog, log, findAll } = storeWith(ids, () => brandId);

    // Act
    const cleared = await catalog.clearBrand(ctx, brandId);

    // Assert
    expect(cleared).toHaveLength(CATALOG_MAX_PAGE_SIZE + 1);
    expect(findAll.mock.calls.map(([, options]) => options.skip)).toEqual([0, CATALOG_MAX_PAGE_SIZE]);
    expect(log.slice(0, 3)).toEqual(['lock:1', 'read:1', 'update:1']);
  });

  it('leaves a product whose brand changed before its lock was taken', async () => {
    // Arrange
    const { catalog, log } = storeWith([1, 2], (id) => (id === 2 ? otherBrandId : brandId));

    // Act
    const cleared = await catalog.clearBrand(ctx, brandId);

    // Assert
    expect(cleared).toEqual([toCoreId('1')]);
    expect(log).not.toContain('update:2');
  });
});
