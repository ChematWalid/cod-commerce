import { describe, expect, it } from 'vitest';
import { CollectionOptionsService } from '../../application/collection-options.service';
import { toCoreId } from '../../domain/core-id';
import { ProductWorld } from '../fakes/product-world';
import { StoreKeyedCollectionSource } from '../fakes/store-keyed-collection-source';
import { scopeA, scopeA2, scopeB } from '../support/builders';

const optionsByStore = new Map([
  [scopeA.storeId, [{ id: toCoreId('71'), title: 'A1 summer' }]],
  [scopeB.storeId, [{ id: toCoreId('72'), title: 'B summer' }]],
]);

describe('CollectionOptionsService (D2324)', () => {
  it('lists nothing while no source is registered', async () => {
    // Arrange
    const world = new ProductWorld();

    // Act
    const options = await new CollectionOptionsService(world.ports).list(world.ctxOf(scopeA), scopeA);

    // Assert
    expect(options).toEqual([]);
  });

  it("answers the registered source's options of the caller's store only", async () => {
    // Arrange
    const world = new ProductWorld();
    const source = new StoreKeyedCollectionSource(optionsByStore);
    world.membership.register(source);
    const service = new CollectionOptionsService(world.ports);

    // Act
    const ofA = await service.list(world.ctxOf(scopeA), scopeA);
    const ofA2 = await service.list(world.ctxOf(scopeA2), scopeA2);
    const ofB = await service.list(world.ctxOf(scopeB), scopeB);

    // Assert
    expect(ofA).toEqual([{ id: '71', title: 'A1 summer' }]);
    expect(ofA2).toEqual([]);
    expect(ofB).toEqual([{ id: '72', title: 'B summer' }]);
    expect(source.optionScopes).toEqual([scopeA, scopeA2, scopeB]);
  });
});
