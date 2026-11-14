import { describe, expect, it } from 'vitest';
import { InvalidCatalogInputError } from '../../domain/errors';
import type { MediaRepositoryPort } from '../../domain/ports/media-repository.port';
import { at, mediaOf, scopeA, scopeA2, scopeB } from '../support/builders';
import type { MakeHarness } from './repository-harness';

const ALL_ON_ONE_PAGE = { skip: 0, take: 50 };
const EMPTY = { items: [], totalItems: 0 };

/**
 * The behaviour every {@link MediaRepositoryPort} adapter must have. The library is business-wide, and a caller reads
 * only the stores it may reach (D2132): the store list is the filter, never the active store alone.
 */
export function describeMediaRepositoryContract(name: string, make: MakeHarness<MediaRepositoryPort>): void {
  describe(`${name} (MediaRepositoryPort contract)`, () => {
    it('lists media of the given stores of the business', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [inA1, inA2, newestInA1] = [mediaOf(scopeA, at(1)), mediaOf(scopeA2, at(2)), mediaOf(scopeA, at(3))];
      for (const item of [inA1, inA2, newestInA1]) await repo.insert(ctx, scopeA, item);
      await repo.insert(ctx, scopeB, mediaOf(scopeB, at(4)));

      // Act
      const both = await repo.list(ctx, scopeA, [scopeA.storeId, scopeA2.storeId], ALL_ON_ONE_PAGE);
      const firstStoreOnly = await repo.list(ctx, scopeA, [scopeA.storeId], ALL_ON_ONE_PAGE);
      const ofB = await repo.list(ctx, scopeB, [scopeA.storeId, scopeA2.storeId], ALL_ON_ONE_PAGE);

      // Assert
      expect(both).toEqual({ items: [newestInA1, inA2, inA1], totalItems: 3 });
      expect(firstStoreOnly).toEqual({ items: [newestInA1, inA1], totalItems: 2 });
      expect(ofB).toEqual({ items: [], totalItems: 0 });
    });

    it('pages the list and counts every match', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const items = [mediaOf(scopeA, at(1)), mediaOf(scopeA, at(2)), mediaOf(scopeA, at(3))];
      for (const item of items) await repo.insert(ctx, scopeA, item);

      // Act
      const page = await repo.list(ctx, scopeA, [scopeA.storeId], { skip: 1, take: 1 });

      // Assert
      expect(page).toEqual({ items: [items[1]], totalItems: 3 });
    });

    it('lists nothing for an empty store list', async () => {
      // Arrange
      const { repo, ctx } = await make();
      await repo.insert(ctx, scopeA, mediaOf(scopeA));

      // Act
      const listed = await repo.list(ctx, scopeA, [], ALL_ON_ONE_PAGE);

      // Assert
      expect(listed).toEqual({ items: [], totalItems: 0 });
    });

    it('finds an item by id or asset id only among the given stores of its business', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const item = mediaOf(scopeA2);
      await repo.insert(ctx, scopeA, item);

      // Act
      const reachable = await repo.findById(ctx, scopeA, [scopeA2.storeId], item.id);
      const otherStoreOnly = await repo.findById(ctx, scopeA, [scopeA.storeId], item.id);
      const fromB = await repo.findById(ctx, scopeB, [scopeA2.storeId], item.id);

      // Assert
      expect([reachable, otherStoreOnly, fromB]).toEqual([item, undefined, undefined]);
      await expect(repo.findByAssetIds(ctx, scopeA, [scopeA2.storeId], [item.assetId])).resolves.toEqual([item]);
      await expect(repo.findByAssetIds(ctx, scopeA, [scopeA.storeId], [item.assetId])).resolves.toEqual([]);
    });

    it('deletes an item of its business and the given stores only', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [item, ofOtherStore] = [mediaOf(scopeA), mediaOf(scopeA2)];
      await repo.insert(ctx, scopeA, item);
      await repo.insert(ctx, scopeA, ofOtherStore);

      // Act
      const fromB = await repo.delete(ctx, scopeB, [scopeA.storeId], item.id);
      const outsideStores = await repo.delete(ctx, scopeA, [scopeA.storeId], ofOtherStore.id);
      const noStores = await repo.delete(ctx, scopeA, [], item.id);
      const fromA = await repo.delete(ctx, scopeA, [scopeA.storeId], item.id);

      // Assert
      expect([fromB, outsideStores, noStores, fromA]).toEqual([false, false, false, true]);
      const left = await repo.list(ctx, scopeA, [scopeA.storeId, scopeA2.storeId], ALL_ON_ONE_PAGE);
      expect(left).toEqual({ items: [ofOtherStore], totalItems: 1 });
    });

    it('refuses an item of another business', async () => {
      // Arrange
      const { repo, ctx } = await make();

      // Act
      const insert = repo.insert(ctx, scopeB, mediaOf(scopeA));

      // Assert
      await expect(insert).rejects.toBeInstanceOf(InvalidCatalogInputError);
      await expect(repo.list(ctx, scopeB, [scopeA.storeId], ALL_ON_ONE_PAGE)).resolves.toEqual(EMPTY);
    });

    it('refuses a second item for the same asset', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const first = mediaOf(scopeA);
      await repo.insert(ctx, scopeA, first);

      // Act
      const second = repo.insert(ctx, scopeA, { ...mediaOf(scopeA2), assetId: first.assetId });

      // Assert
      await expect(second).rejects.toThrow();
      const listed = await repo.list(ctx, scopeA, [scopeA.storeId, scopeA2.storeId], ALL_ON_ONE_PAGE);
      expect(listed).toEqual({ items: [first], totalItems: 1 });
    });
  });
}
