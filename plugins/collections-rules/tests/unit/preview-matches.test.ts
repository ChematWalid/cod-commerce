import { beforeEach, describe, expect, it } from 'vitest';
import { PreviewMatchesService } from '../../application/preview-matches.service';
import { ProductSearchService } from '../../application/product-search.service';
import { RuleOptionsService } from '../../application/rule-options.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import { FakeCollectionWorld } from '../fakes/collection-ports';
import { scopeA, scopeB } from '../support/builders';
import { facts, PROMO_TAG, ruleOf, tagIs } from './rule-fixtures';

const ctx = asOperationContext({});
const PROMO_RULE = ruleOf('all', tagIs('is_any_of', PROMO_TAG));

let world: FakeCollectionWorld;

beforeEach(() => {
  world = new FakeCollectionWorld();
});

describe('PreviewMatchesService.run (D2331)', () => {
  it('counts every match of the store and returns the asked page newest first', async () => {
    // Arrange
    for (let id = 1; id <= 150; id += 1) {
      world.facts.put(scopeA, facts({ productId: String(id), title: `Item ${String(id)}`, tagIds: [PROMO_TAG] }));
    }
    world.facts.put(scopeA, facts({ productId: '151' }));

    // Act
    const page = await new PreviewMatchesService(world.ports).run(ctx, scopeA, PROMO_RULE, { skip: 2, take: 3 });

    // Assert
    expect(page.totalItems).toBe(150);
    expect(page.items).toEqual([
      { productId: '148', title: 'Item 148', status: 'active', price: 2_000 },
      { productId: '147', title: 'Item 147', status: 'active', price: 2_000 },
      { productId: '146', title: 'Item 146', status: 'active', price: 2_000 },
    ]);
  });

  it('writes nothing: no transaction, no lock, no member, no event', async () => {
    // Arrange
    world.facts.put(scopeA, facts({ productId: '1', tagIds: [PROMO_TAG] }));

    // Act
    await new PreviewMatchesService(world.ports).run(ctx, scopeA, PROMO_RULE, { skip: 0, take: 50 });

    // Assert
    expect(world.steps).toEqual([]);
    expect(world.tables.memberRows).toEqual([]);
    expect(world.events.published).toEqual([]);
  });

  it("never matches another store's products", async () => {
    // Arrange
    world.facts.put(scopeB, facts({ productId: '9', tagIds: [PROMO_TAG] }));

    // Act
    const page = await new PreviewMatchesService(world.ports).run(ctx, scopeA, PROMO_RULE, { skip: 0, take: 50 });

    // Assert
    expect(page).toEqual({ totalItems: 0, items: [] });
  });
});

describe('ProductSearchService.run', () => {
  it('finds products of the store by title, newest first, with the total of all pages', async () => {
    // Arrange
    for (let id = 1; id <= 120; id += 1) {
      world.facts.put(scopeA, facts({ productId: String(id), title: id % 2 === 0 ? `Shoe ${String(id)}` : 'Hat' }));
    }
    world.facts.put(scopeB, facts({ productId: '500', title: 'Shoe of B' }));

    // Act
    const page = await new ProductSearchService(world.ports).run(ctx, scopeA, { search: 'shoe', skip: 1, take: 2 });

    // Assert
    expect(page.totalItems).toBe(60);
    expect(page.items.map((item) => item.productId)).toEqual(['118', '116']);
  });

  it('lists every product of the store without a search', async () => {
    // Arrange
    world.facts.add(scopeA, '1', '2');

    // Act
    const page = await new ProductSearchService(world.ports).run(ctx, scopeA, { skip: 0, take: 20 });

    // Assert
    expect(page).toMatchObject({ totalItems: 2, items: [{ productId: '2' }, { productId: '1' }] });
    expect(world.facts.pageRequests[0]?.search).toBeUndefined();
  });
});

describe('RuleOptionsService.of', () => {
  it("answers the store's brands, tags and option names", async () => {
    // Arrange
    world.facts.ruleOptions = {
      brands: [{ id: '1300000000000000001', name: 'Acme' }],
      tags: [{ id: PROMO_TAG, name: 'promo' }],
      options: [{ name: 'Color', values: ['Blue', 'Red'] }],
    };

    // Act
    const options = await new RuleOptionsService(world.ports).of(ctx, scopeA);

    // Assert
    expect(options).toEqual(world.facts.ruleOptions);
  });
});
