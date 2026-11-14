import { MAX_TAXONOMY_ENTRIES_PER_STORE, productInputSchema } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { BrandService } from '../../application/brand.service';
import { CreateProductService } from '../../application/create-product.service';
import { HighlightService } from '../../application/highlight.service';
import { TagService } from '../../application/tag.service';
import { UpdateProductService } from '../../application/update-product.service';
import { BrandNotFoundError, TagNotFoundError, TaxonomyLimitError } from '../../domain/errors';
import { ProductWorld } from '../fakes/product-world';
import { brandOf, highlightOf, scopeA, scopeA2, scopeB, tagOf } from '../support/builders';

describe('product saves and taxonomy deletes stay apart', () => {
  let world: ProductWorld;
  let brands: BrandService;
  let tags: TagService;
  let highlights: HighlightService;

  beforeEach(() => {
    world = new ProductWorld();
    brands = new BrandService(world.ports);
    tags = new TagService(world.ports);
    highlights = new HighlightService(world.ports);
  });

  const create = (input: Record<string, unknown>) =>
    new CreateProductService(world.ports).create(
      world.ctxOf(scopeA),
      scopeA,
      productInputSchema.parse({ title: 'Shirt', status: 'active', price: 2500, ...input }),
    );

  it.each([
    [
      'brand',
      () => brands.create(world.ctxOf(scopeA), scopeA, { name: 'Acme' }),
      (id: string) => brands.delete(world.ctxOf(scopeA), scopeA, id),
    ],
    [
      'tag',
      () => tags.create(world.ctxOf(scopeA), scopeA, { name: 'Summer' }),
      (id: string) => tags.delete(world.ctxOf(scopeA), scopeA, id),
    ],
    [
      'highlight',
      () => highlights.create(world.ctxOf(scopeA), scopeA, { text: 'Free returns' }),
      (id: string) => highlights.delete(world.ctxOf(scopeA), scopeA, id),
    ],
  ] as const)('deleting a %s takes its exclusive lock first, inside the transaction', async (_kind, add, remove) => {
    // Arrange
    const { id } = await add();
    world.products.calls.length = 0;

    // Act
    await remove(id);

    // Assert
    expect(world.products.calls[0]).toBe(`exclusive:${id}`);
    expect(world.locksOutsideTransaction).toBe(0);
  });

  it('an update shares the locks of the brand, tags and highlights it names before it locks the product', async () => {
    // Arrange
    const { product } = await create({});
    const brand = await brands.create(world.ctxOf(scopeA), scopeA, { name: 'Acme' });
    const tag = await tags.create(world.ctxOf(scopeA), scopeA, { name: 'Summer' });
    const highlight = await highlights.create(world.ctxOf(scopeA), scopeA, { text: 'Free returns' });
    world.products.calls.length = 0;

    // Act
    await new UpdateProductService(world.ports).update(world.ctxOf(scopeA), scopeA, product.id, {
      brandId: brand.id,
      tagIds: [tag.id],
      highlightIds: [highlight.id],
    });

    // Assert
    expect(world.products.calls.slice(0, 2)).toEqual([
      `share:${[brand.id, tag.id, highlight.id].sort().join(',')}`,
      `lock:${product.id}`,
    ]);
    expect(world.locksOutsideTransaction).toBe(0);
  });

  it('a create checks the names it uses under shared locks inside its transaction', async () => {
    // Arrange
    const brand = await brands.create(world.ctxOf(scopeA), scopeA, { name: 'Acme' });
    world.products.calls.length = 0;

    // Act
    await create({ brandId: brand.id });

    // Assert
    expect(world.products.calls[0]).toBe(`share:${brand.id}`);
    expect(world.locksOutsideTransaction).toBe(0);
  });

  it("keys every lock by the caller's business, so another business's id never holds that business's lock", async () => {
    // Arrange
    const brand = await brands.create(world.ctxOf(scopeA), scopeA, { name: 'Acme' });
    const tag = await tags.create(world.ctxOf(scopeA), scopeA, { name: 'Summer' });
    world.lockBusinesses.length = 0;

    // Act
    const deleting = await brands.delete(world.ctxOf(scopeB), scopeB, brand.id).catch((error: unknown) => error);
    const saving = await new CreateProductService(world.ports)
      .create(
        world.ctxOf(scopeB),
        scopeB,
        productInputSchema.parse({ title: 'Shirt', status: 'active', price: 2500, tagIds: [tag.id] }),
      )
      .catch((error: unknown) => error);

    // Assert
    expect(deleting).toBeInstanceOf(BrandNotFoundError);
    expect(saving).toBeInstanceOf(TagNotFoundError);
    expect(world.lockBusinesses).toEqual([scopeB.businessId, scopeB.businessId]);
  });

  it("an owner's delete and save lock under the same business, so they still wait on each other", async () => {
    // Arrange
    const brand = await brands.create(world.ctxOf(scopeA), scopeA, { name: 'Acme' });
    world.lockBusinesses.length = 0;

    // Act
    await create({ brandId: brand.id });
    const fromOtherStore = await brands
      .delete(world.ctxOf(scopeA2), scopeA2, brand.id)
      .catch((error: unknown) => error);
    await brands.delete(world.ctxOf(scopeA), scopeA, brand.id);

    // Assert
    expect(fromOtherStore).toBeInstanceOf(BrandNotFoundError);
    expect(world.lockBusinesses).toEqual([scopeA.businessId, scopeA2.businessId, scopeA.businessId]);
  });

  it('locks no malformed id and still answers not found for it', async () => {
    // Arrange
    world.products.calls.length = 0;

    // Act
    const saving = create({ brandId: 'abc' });

    // Assert
    await expect(saving).rejects.toBeInstanceOf(BrandNotFoundError);
    expect(world.products.calls.filter((call) => call.startsWith('share:'))).toEqual([]);
  });
});

describe('the most brands, tags and highlights a store keeps', () => {
  it('refuses one more brand, tag or highlight in a full store and allows it in another store', async () => {
    // Arrange
    const world = new ProductWorld();
    const full = Array.from({ length: MAX_TAXONOMY_ENTRIES_PER_STORE }, () => scopeA);
    world.brands.rows.push(...full.map((scope) => brandOf(scope)));
    world.tags.rows.push(...full.map((scope) => tagOf(scope)));
    world.highlights.rows.push(...full.map((scope) => highlightOf(scope)));
    const brands = new BrandService(world.ports);
    const tags = new TagService(world.ports);
    const highlights = new HighlightService(world.ports);

    // Act
    const attempts = [
      brands.create(world.ctxOf(scopeA), scopeA, { name: 'One more' }),
      tags.create(world.ctxOf(scopeA), scopeA, { name: 'One more' }),
      highlights.create(world.ctxOf(scopeA), scopeA, { text: 'One more' }),
    ];
    const elsewhere = await brands.create(world.ctxOf(scopeA2), scopeA2, { name: 'One more' });

    // Assert
    for (const attempt of attempts) await expect(attempt).rejects.toBeInstanceOf(TaxonomyLimitError);
    expect(elsewhere.storeId).toBe(scopeA2.storeId);
  });
});
