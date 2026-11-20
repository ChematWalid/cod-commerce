import { describe, expect, it } from 'vitest';
import { automaticOf, definitionOf, priceRule, scopeA, scopeA2, scopeB } from '../support/builders';
import type { MakeHarness } from './repository-harness';

/** The behaviour every `CollectionDefinitionRepositoryPort` adapter must have, store and business isolation included. */
export function describeCollectionDefinitionRepositoryContract(name: string, make: MakeHarness): void {
  describe(`${name} (CollectionDefinitionRepositoryPort contract)`, () => {
    it('finds a stored definition by its collection id, rule included', async () => {
      // Arrange
      const { repos, ctx } = await make();
      const definition = automaticOf(scopeA, { visible: false, position: 7 });

      // Act
      await repos.definitions.insert(ctx, scopeA, definition);

      // Assert
      expect(await repos.definitions.findByCollectionId(ctx, scopeA, definition.collectionId)).toEqual(definition);
    });

    it("never finds, changes or deletes another store's definition", async () => {
      // Arrange
      const { repos, ctx } = await make();
      const definition = definitionOf(scopeA);
      await repos.definitions.insert(ctx, scopeA, definition);
      const moved = { ...definition, position: 9 };

      // Act
      const updated = await Promise.all([scopeA2, scopeB].map((scope) => repos.definitions.update(ctx, scope, moved)));
      const deleted = await Promise.all(
        [scopeA2, scopeB].map((scope) => repos.definitions.delete(ctx, scope, definition.collectionId)),
      );

      // Assert
      for (const scope of [scopeA2, scopeB]) {
        expect(await repos.definitions.findByCollectionId(ctx, scope, definition.collectionId)).toBeUndefined();
        expect(await repos.definitions.existing(ctx, scope, [definition.collectionId])).toEqual([]);
      }
      expect([...updated, ...deleted]).toEqual([false, false, false, false]);
      expect(await repos.definitions.findByCollectionId(ctx, scopeA, definition.collectionId)).toEqual(definition);
    });

    it('list orders by position then id, pages, counts and narrows to the store', async () => {
      // Arrange
      const { repos, ctx } = await make();
      const [late, firstOfTwo, secondOfTwo] = [
        definitionOf(scopeA, { position: 5 }),
        definitionOf(scopeA, { position: 1 }),
        definitionOf(scopeA, { position: 1 }),
      ];
      for (const definition of [late, secondOfTwo, firstOfTwo]) {
        await repos.definitions.insert(ctx, scopeA, definition);
      }
      await repos.definitions.insert(ctx, scopeA2, definitionOf(scopeA2, { position: 0 }));
      await repos.definitions.insert(ctx, scopeB, definitionOf(scopeB, { position: 0 }));

      // Act
      const all = await repos.definitions.list(ctx, scopeA, { skip: 0, take: 10 });
      const page = await repos.definitions.list(ctx, scopeA, { skip: 1, take: 1 });
      const narrowed = await repos.definitions.list(ctx, scopeA, {
        skip: 0,
        take: 10,
        collectionIds: [late.collectionId],
      });

      // Assert
      expect(all.items.map((item) => item.collectionId)).toEqual(
        [firstOfTwo, secondOfTwo, late].map((definition) => definition.collectionId),
      );
      expect(all.totalItems).toBe(3);
      expect(page).toEqual({ items: [secondOfTwo], totalItems: 3 });
      expect(narrowed).toEqual({ items: [late], totalItems: 1 });
    });

    it('narrowing to no collection ids lists nothing', async () => {
      // Arrange
      const { repos, ctx } = await make();
      await repos.definitions.insert(ctx, scopeA, definitionOf(scopeA));

      // Act
      const page = await repos.definitions.list(ctx, scopeA, { skip: 0, take: 10, collectionIds: [] });

      // Assert
      expect(page).toEqual({ items: [], totalItems: 0 });
    });

    it("lists only the store's automatic definitions", async () => {
      // Arrange
      const { repos, ctx } = await make();
      const automatic = automaticOf(scopeA);
      await repos.definitions.insert(ctx, scopeA, automatic);
      await repos.definitions.insert(ctx, scopeA, definitionOf(scopeA));
      await repos.definitions.insert(ctx, scopeA2, automaticOf(scopeA2));
      await repos.definitions.insert(ctx, scopeB, automaticOf(scopeB));

      // Act
      const found = await repos.definitions.listAutomatic(ctx, scopeA);

      // Assert
      expect(found).toEqual([automatic]);
    });

    it("keeps the store's collection ids among the given ones, in the given order", async () => {
      // Arrange
      const { repos, ctx } = await make();
      const [first, second, foreign] = [definitionOf(scopeA), definitionOf(scopeA), definitionOf(scopeB)];
      await repos.definitions.insert(ctx, scopeA, first);
      await repos.definitions.insert(ctx, scopeA, second);
      await repos.definitions.insert(ctx, scopeB, foreign);

      // Act
      const found = await repos.definitions.existing(ctx, scopeA, [
        second.collectionId,
        foreign.collectionId,
        first.collectionId,
      ]);

      // Assert
      expect(found).toEqual([second.collectionId, first.collectionId]);
    });

    it('saves a changed mode, rule, version, visibility and position', async () => {
      // Arrange
      const { repos, ctx } = await make();
      const definition = definitionOf(scopeA);
      await repos.definitions.insert(ctx, scopeA, definition);
      const changed = {
        ...definition,
        mode: 'automatic' as const,
        rule: priceRule(10, 20),
        matchVersion: 2,
        visible: false,
        position: 42,
      };

      // Act
      const updated = await repos.definitions.update(ctx, scopeA, changed);

      // Assert
      expect(updated).toBe(true);
      expect(await repos.definitions.findByCollectionId(ctx, scopeA, definition.collectionId)).toEqual(changed);
    });

    it('counts the definitions of the store only and forgets a deleted one', async () => {
      // Arrange
      const { repos, ctx } = await make();
      const [kept, removed] = [definitionOf(scopeA), definitionOf(scopeA)];
      await repos.definitions.insert(ctx, scopeA, kept);
      await repos.definitions.insert(ctx, scopeA, removed);
      await repos.definitions.insert(ctx, scopeA2, definitionOf(scopeA2));

      // Act
      const deleted = await repos.definitions.delete(ctx, scopeA, removed.collectionId);

      // Assert
      expect(deleted).toBe(true);
      expect(await repos.definitions.countInStore(ctx, scopeA)).toBe(1);
      expect(await repos.definitions.findByCollectionId(ctx, scopeA, removed.collectionId)).toBeUndefined();
    });

    it("names the business's stores with automatic collections, or those built below a version (D2336)", async () => {
      // Arrange
      const { repos, ctx } = await make();
      await repos.definitions.insert(ctx, scopeA, automaticOf(scopeA, { matchVersion: 2 }));
      await repos.definitions.insert(ctx, scopeA2, automaticOf(scopeA2, { matchVersion: 1 }));
      await repos.definitions.insert(ctx, scopeA2, automaticOf(scopeA2, { matchVersion: 2 }));
      await repos.definitions.insert(ctx, scopeA2, definitionOf(scopeA2, { matchVersion: 1 }));
      await repos.definitions.insert(ctx, scopeB, automaticOf(scopeB, { matchVersion: 1 }));
      const business = { businessId: scopeA.businessId };

      // Act
      const every = await repos.definitions.automaticStores(ctx, business);
      const older = await repos.definitions.automaticStores(ctx, business, 2);

      // Assert
      expect(every).toEqual([scopeA.storeId, scopeA2.storeId]);
      expect(older).toEqual([scopeA2.storeId]);
    });

    it('names no store when the business has only manual collections', async () => {
      // Arrange
      const { repos, ctx } = await make();
      await repos.definitions.insert(ctx, scopeA, definitionOf(scopeA, { matchVersion: 1 }));

      // Act
      const stores = await repos.definitions.automaticStores(ctx, { businessId: scopeA.businessId }, 2);

      // Assert
      expect(stores).toEqual([]);
    });
  });
}
