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

describe('VendureProductCatalog.list', () => {
  it('asks for the statuses of a public context and leaves out the excluded products (D2109)', async () => {
    // Arrange
    const findAll = vi.fn().mockResolvedValue({ items: [], totalItems: 0 });
    const catalog = catalogOver(findAll);

    // Act
    await catalog.list(ctx, {
      skip: 0,
      take: 20,
      productIds: [toCoreId('1'), toCoreId('2')],
      excludedProductIds: [toCoreId('2')],
      statuses: ['active', 'hidden'],
    });

    // Assert
    expect(findAll).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        filter: { id: { in: ['1', '2'], notIn: ['2'] }, status: { in: ['active', 'hidden'] } },
      }),
      [],
    );
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

  interface ListOptions {
    readonly skip: number;
    readonly take: number;
    readonly filter: { readonly brandId: { readonly eq: string }; readonly id?: { readonly notIn: readonly string[] } };
  }

  /**
   * A store whose products `ids` name the brand; `brandOf` holds what each names now, and the list answers from it as
   * Postgres would, so a change between two page reads shows in the next one. `afterList` runs after each list read.
   */
  function storeWith(ids: readonly number[], afterList: (brandOf: Map<number, string | null>) => void = () => {}) {
    const log: string[] = [];
    const brandOf = new Map<number, string | null>(ids.map((id) => [id, brandId]));
    const findAll = vi.fn((_ctx: unknown, options: ListOptions) => {
      const excluded = new Set(options.filter.id?.notIn ?? []);
      const matching = ids.filter((id) => brandOf.get(id) === options.filter.brandId.eq && !excluded.has(String(id)));
      const items = matching.slice(options.skip, options.skip + options.take).map((id) => ({ id }));
      afterList(brandOf);
      return Promise.resolve({ items, totalItems: matching.length });
    });
    const products = {
      findAll,
      findOne: vi.fn((_ctx: unknown, id: string) => {
        log.push(`read:${id}`);
        return Promise.resolve({ id: Number(id), customFields: { brandId: brandOf.get(Number(id)) ?? null } });
      }),
      update: vi.fn((_ctx: unknown, input: { id: number }) => {
        log.push(`update:${String(input.id)}`);
        brandOf.set(input.id, null);
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

  it('clears every product of the brand past one page, locking and re-reading each one first', async () => {
    // Arrange
    const ids = Array.from({ length: CATALOG_MAX_PAGE_SIZE + 1 }, (_, index) => index + 1);
    const { catalog, log } = storeWith(ids);

    // Act
    const cleared = await catalog.clearBrand(ctx, brandId);

    // Assert
    expect(cleared).toHaveLength(CATALOG_MAX_PAGE_SIZE + 1);
    expect(log.slice(0, 3)).toEqual(['lock:1', 'read:1', 'update:1']);
  });

  it('skips no product when one leaves the brand between two page reads', async () => {
    // Arrange: after the first page is read, another save moves product 1 to another brand
    const ids = Array.from({ length: CATALOG_MAX_PAGE_SIZE + 1 }, (_, index) => index + 1);
    let lists = 0;
    const { catalog } = storeWith(ids, (brandOf) => {
      lists += 1;
      if (lists === 1) brandOf.set(1, otherBrandId);
    });

    // Act
    const cleared = await catalog.clearBrand(ctx, brandId);

    // Assert
    expect(cleared).toContain(toCoreId(String(CATALOG_MAX_PAGE_SIZE + 1)));
    expect(cleared).toHaveLength(CATALOG_MAX_PAGE_SIZE);
  });

  it('leaves a product whose brand changed before its lock was taken', async () => {
    // Arrange
    const { catalog, log } = storeWith([1, 2], (brandOf) => {
      brandOf.set(2, otherBrandId);
    });

    // Act
    const cleared = await catalog.clearBrand(ctx, brandId);

    // Assert
    expect(cleared).toEqual([toCoreId('1')]);
    expect(log).not.toContain('update:2');
  });
});
