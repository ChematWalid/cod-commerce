import { productInputSchema } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { BrandService } from '../../application/brand.service';
import { CreateProductService } from '../../application/create-product.service';
import { GetProductService } from '../../application/get-product.service';
import { HighlightService } from '../../application/highlight.service';
import { TagService } from '../../application/tag.service';
import {
  BrandNotFoundError,
  HighlightNotFoundError,
  InvalidCatalogInputError,
  NameTakenError,
  TagNotFoundError,
} from '../../domain/errors';
import type { StoreScope } from '../../domain/store-scope';
import { ProductWorld } from '../fakes/product-world';
import { scopeA, scopeA2, scopeB } from '../support/builders';

const MALFORMED_IDS = ['abc', '-1', '1.5', '99999999999999999999999', ''];

describe('brands, tags and highlights of a store', () => {
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

  const ctx = (scope: StoreScope) => world.ctxOf(scope);

  const productIn = async (scope: StoreScope, input: Record<string, unknown>) => {
    const command = productInputSchema.parse({ title: 'Shirt', status: 'active', price: 2500, ...input });
    return (await new CreateProductService(world.ports).create(ctx(scope), scope, command)).product;
  };

  it('lists the brands of the store newest first', async () => {
    // Arrange
    const older = await brands.create(ctx(scopeA), scopeA, { name: 'Older' });
    const newer = await brands.create(ctx(scopeA), scopeA, { name: 'Newer' });
    await brands.create(ctx(scopeA2), scopeA2, { name: 'Other store' });

    // Act
    const listed = await brands.list(ctx(scopeA), scopeA);

    // Assert
    expect(listed.map((brand) => brand.id)).toEqual([newer.id, older.id]);
  });

  it('refuses a duplicate tag name in one store, allows it in another store', async () => {
    // Arrange
    await tags.create(ctx(scopeA), scopeA, { name: 'Summer' });

    // Act
    const duplicate = tags.create(ctx(scopeA), scopeA, { name: ' SUMMER ' });
    const elsewhere = await tags.create(ctx(scopeA2), scopeA2, { name: 'Summer' });

    // Assert
    await expect(duplicate).rejects.toBeInstanceOf(NameTakenError);
    expect(elsewhere.storeId).toBe(scopeA2.storeId);
  });

  it('renames a brand, and refuses a name another brand of the store holds', async () => {
    // Arrange
    const brand = await brands.create(ctx(scopeA), scopeA, { name: 'Acme' });
    await brands.create(ctx(scopeA), scopeA, { name: 'Taken' });

    // Act
    const renamed = await brands.update(ctx(scopeA), scopeA, brand.id, { name: 'Acme Two' });
    const clashing = brands.update(ctx(scopeA), scopeA, brand.id, { name: 'taken' });

    // Assert
    expect(renamed).toMatchObject({ id: brand.id, name: 'Acme Two' });
    await expect(clashing).rejects.toBeInstanceOf(NameTakenError);
  });

  it('keeps a brand its own name under another case', async () => {
    // Arrange
    const brand = await brands.create(ctx(scopeA), scopeA, { name: 'acme' });

    // Act
    const renamed = await brands.update(ctx(scopeA), scopeA, brand.id, { name: 'ACME' });

    // Assert
    expect(renamed.name).toBe('ACME');
  });

  it("refuses a brand, tag or highlight id of the business's other store", async () => {
    // Arrange
    const brand = await brands.create(ctx(scopeA), scopeA, { name: 'Acme' });
    const tag = await tags.create(ctx(scopeA), scopeA, { name: 'Summer' });
    const highlight = await highlights.create(ctx(scopeA), scopeA, { text: 'Free returns' });

    // Act
    const attempts = [
      brands.update(ctx(scopeA2), scopeA2, brand.id, { name: 'Moved' }),
      tags.delete(ctx(scopeA2), scopeA2, tag.id),
      highlights.update(ctx(scopeA2), scopeA2, highlight.id, { text: 'Moved' }),
    ];

    // Assert
    await expect(attempts[0]).rejects.toBeInstanceOf(BrandNotFoundError);
    await expect(attempts[1]).rejects.toBeInstanceOf(TagNotFoundError);
    await expect(attempts[2]).rejects.toBeInstanceOf(HighlightNotFoundError);
    expect(await tags.list(ctx(scopeA), scopeA)).toHaveLength(1);
  });

  it("refuses another business's brand id as not found", async () => {
    // Arrange
    const brand = await brands.create(ctx(scopeB), scopeB, { name: 'B brand' });

    // Act
    const deleting = brands.delete(ctx(scopeA), scopeA, brand.id);

    // Assert
    await expect(deleting).rejects.toBeInstanceOf(BrandNotFoundError);
    expect(await brands.list(ctx(scopeB), scopeB)).toHaveLength(1);
  });

  it.each(MALFORMED_IDS)('answers not found for the malformed id "%s"', async (id) => {
    // Act
    const attempts = [
      brands.delete(ctx(scopeA), scopeA, id),
      tags.update(ctx(scopeA), scopeA, id, { name: 'X' }),
      highlights.delete(ctx(scopeA), scopeA, id),
    ];

    // Assert
    await expect(attempts[0]).rejects.toBeInstanceOf(BrandNotFoundError);
    await expect(attempts[1]).rejects.toBeInstanceOf(TagNotFoundError);
    await expect(attempts[2]).rejects.toBeInstanceOf(HighlightNotFoundError);
  });

  it('deleting a brand clears it from products', async () => {
    // Arrange
    const brand = await brands.create(ctx(scopeA), scopeA, { name: 'Acme' });
    const branded = await productIn(scopeA, { brandId: brand.id });
    world.events.length = 0;

    // Act
    await brands.delete(ctx(scopeA), scopeA, brand.id);

    // Assert
    const reloaded = await new GetProductService(world.ports).byId(ctx(scopeA), scopeA, branded.id);
    expect(reloaded?.brandId).toBeNull();
    expect(await brands.list(ctx(scopeA), scopeA)).toEqual([]);
    expect(world.events).toEqual([{ scope: scopeA, productId: branded.id, change: 'updated' }]);
  });

  it('deleting a tag removes it from products', async () => {
    // Arrange
    const tag = await tags.create(ctx(scopeA), scopeA, { name: 'Summer' });
    const tagged = await productIn(scopeA, { tagIds: [tag.id] });

    // Act
    await tags.delete(ctx(scopeA), scopeA, tag.id);

    // Assert
    const reloaded = await new GetProductService(world.ports).byId(ctx(scopeA), scopeA, tagged.id);
    expect(reloaded?.tagIds).toEqual([]);
  });

  it('deleting a highlight removes it from products and keeps the others in order', async () => {
    // Arrange
    const first = await highlights.create(ctx(scopeA), scopeA, { text: 'First' });
    const gone = await highlights.create(ctx(scopeA), scopeA, { text: 'Gone' });
    const last = await highlights.create(ctx(scopeA), scopeA, { text: 'Last' });
    const product = await productIn(scopeA, { highlightIds: [first.id, gone.id, last.id] });

    // Act
    await highlights.delete(ctx(scopeA), scopeA, gone.id);

    // Assert
    const reloaded = await new GetProductService(world.ports).byId(ctx(scopeA), scopeA, product.id);
    expect(reloaded?.highlightIds).toEqual([first.id, last.id]);
  });

  it('rewords a highlight and refuses a blank or multi-line text', async () => {
    // Arrange
    const highlight = await highlights.create(ctx(scopeA), scopeA, { text: 'Fast delivery' });

    // Act
    const reworded = await highlights.update(ctx(scopeA), scopeA, highlight.id, { text: 'Delivery in 48 h' });
    const blank = highlights.create(ctx(scopeA), scopeA, { text: '   ' });
    const twoLines = highlights.update(ctx(scopeA), scopeA, highlight.id, { text: 'a\nb' });

    // Assert
    expect(reworded).toMatchObject({ id: highlight.id, text: 'Delivery in 48 h' });
    await expect(blank).rejects.toBeInstanceOf(InvalidCatalogInputError);
    await expect(twoLines).rejects.toBeInstanceOf(InvalidCatalogInputError);
  });

  it('writes every change inside a transaction', async () => {
    // Act
    const brand = await brands.create(ctx(scopeA), scopeA, { name: 'Acme' });
    await brands.update(ctx(scopeA), scopeA, brand.id, { name: 'Acme 2' });
    await brands.delete(ctx(scopeA), scopeA, brand.id);

    // Assert
    expect(world.transactions).toBe(3);
  });
});
