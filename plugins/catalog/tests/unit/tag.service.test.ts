import { productInputSchema } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { CreateProductService } from '../../application/create-product.service';
import { TagService } from '../../application/tag.service';
import type { StoreScope } from '../../domain/store-scope';
import { ProductWorld } from '../fakes/product-world';
import { scopeA, scopeA2 } from '../support/builders';

describe('TagService delete (D2311)', () => {
  let world: ProductWorld;
  let tags: TagService;

  beforeEach(() => {
    world = new ProductWorld();
    tags = new TagService(world.ports);
  });

  const productIn = async (scope: StoreScope, tagIds: readonly string[]) => {
    const command = productInputSchema.parse({ title: 'Shirt', status: 'active', price: 2500, tagIds });
    return (await new CreateProductService(world.ports).create(world.ctxOf(scope), scope, command)).product;
  };

  it('publishes product.changed for each product a tag delete unlinks', async () => {
    // Arrange
    const promo = await tags.create(world.ctxOf(scopeA), scopeA, { name: 'Promo' });
    const other = await tags.create(world.ctxOf(scopeA), scopeA, { name: 'Other' });
    const first = await productIn(scopeA, [promo.id]);
    const second = await productIn(scopeA, [other.id, promo.id]);
    await productIn(scopeA, [other.id]);
    await productIn(scopeA, []);
    world.events.length = 0;

    // Act
    await tags.delete(world.ctxOf(scopeA), scopeA, promo.id);

    // Assert
    expect(world.events).toHaveLength(2);
    expect(world.events).toEqual(
      expect.arrayContaining([
        { scope: scopeA, productId: first.id, change: 'updated' },
        { scope: scopeA, productId: second.id, change: 'updated' },
      ]),
    );
  });

  it('publishes nothing for a tag no product carries, nor for the products of another store', async () => {
    // Arrange
    const unused = await tags.create(world.ctxOf(scopeA), scopeA, { name: 'Unused' });
    const elsewhere = await tags.create(world.ctxOf(scopeA2), scopeA2, { name: 'Unused' });
    await productIn(scopeA2, [elsewhere.id]);
    world.events.length = 0;

    // Act
    await tags.delete(world.ctxOf(scopeA), scopeA, unused.id);

    // Assert
    expect(world.events).toEqual([]);
  });

  it('publishes inside the delete transaction, which holds the tag lock', async () => {
    // Arrange
    const promo = await tags.create(world.ctxOf(scopeA), scopeA, { name: 'Promo' });
    await productIn(scopeA, [promo.id]);
    world.events.length = 0;
    const before = world.transactions;

    // Act
    await tags.delete(world.ctxOf(scopeA), scopeA, promo.id);

    // Assert
    expect(world.transactions).toBe(before + 1);
    expect(world.products.calls).toContain(`exclusive:${promo.id}`);
    expect(world.events).toHaveLength(1);
  });
});
