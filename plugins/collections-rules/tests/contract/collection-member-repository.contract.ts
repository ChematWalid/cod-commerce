import { describe, expect, it } from 'vitest';
import { CollectionNotFoundError } from '../../domain/errors';
import type { StoreScope } from '../../domain/store-scope';
import { definitionOf, newCoreId, scopeA, scopeA2, scopeB } from '../support/builders';
import type { MakeHarness, RepositoryHarness } from './repository-harness';

/** Stores a fresh manual definition of `scope` and returns its collection id. */
async function collectionIn({ repos, ctx }: RepositoryHarness, scope: StoreScope): Promise<string> {
  const definition = definitionOf(scope);
  await repos.definitions.insert(ctx, scope, definition);
  return definition.collectionId;
}

const at = (productId: string, position: number) => ({ productId, position });

/** The behaviour every `CollectionMemberRepositoryPort` adapter must have, store and business isolation included. */
export function describeCollectionMemberRepositoryContract(name: string, make: MakeHarness): void {
  describe(`${name} (CollectionMemberRepositoryPort contract)`, () => {
    it('reads members by position, then newest product first', async () => {
      // Arrange
      const harness = await make();
      const collectionId = await collectionIn(harness, scopeA);
      const rows = [at('9', 1), at('10', 0), at('2', 1), at('3', 0)];

      // Act
      await harness.repos.members.replaceMembers(harness.ctx, scopeA, collectionId, rows);

      // Assert
      expect(await harness.repos.members.membersOf(harness.ctx, scopeA, collectionId)).toEqual([
        at('10', 0),
        at('3', 0),
        at('9', 1),
        at('2', 1),
      ]);
    });

    it('replaceMembers writes only the diff', async () => {
      // Arrange
      const harness = await make();
      const collectionId = await collectionIn(harness, scopeA);
      const [kept, moved, removed, added] = [newCoreId(), newCoreId(), newCoreId(), newCoreId()];
      await harness.repos.members.replaceMembers(harness.ctx, scopeA, collectionId, [
        at(kept, 0),
        at(moved, 1),
        at(removed, 2),
      ]);
      const before = await harness.memberRowIds(scopeA, collectionId);

      // Act
      await harness.repos.members.replaceMembers(harness.ctx, scopeA, collectionId, [
        at(kept, 0),
        at(added, 1),
        at(moved, 2),
      ]);

      // Assert
      const after = await harness.memberRowIds(scopeA, collectionId);
      expect(after.get(kept)).toBe(before.get(kept));
      expect(after.get(moved)).toBe(before.get(moved));
      expect(after.has(removed)).toBe(false);
      expect(after.has(added)).toBe(true);
      expect(await harness.repos.members.membersOf(harness.ctx, scopeA, collectionId)).toEqual([
        at(kept, 0),
        at(added, 1),
        at(moved, 2),
      ]);
    });

    it('a repeated insert is ignored, not a unique violation', async () => {
      // Arrange
      const harness = await make();
      const collectionId = await collectionIn(harness, scopeA);
      const productId = newCoreId();
      await harness.repos.members.replaceMembers(harness.ctx, scopeA, collectionId, [at(productId, 3)]);

      // Act
      await harness.repos.members.replaceMembers(harness.ctx, scopeA, collectionId, [at(productId, 3)]);
      await harness.repos.members.setProductIn(harness.ctx, scopeA, productId, {
        in: [{ collectionId, position: 8 }],
        out: [],
      });

      // Assert
      expect(await harness.repos.members.membersOf(harness.ctx, scopeA, collectionId)).toEqual([at(productId, 3)]);
    });

    it('deleting a definition cascades its members', async () => {
      // Arrange
      const harness = await make();
      const [removed, kept] = [await collectionIn(harness, scopeA), await collectionIn(harness, scopeA)];
      const productId = newCoreId();
      await harness.repos.members.replaceMembers(harness.ctx, scopeA, removed, [at(productId, 0)]);
      await harness.repos.members.replaceMembers(harness.ctx, scopeA, kept, [at(productId, 0)]);

      // Act
      await harness.repos.definitions.delete(harness.ctx, scopeA, removed);

      // Assert
      expect(await harness.memberRowIds(scopeA, removed)).toEqual(new Map());
      expect(await harness.repos.members.membersOf(harness.ctx, scopeA, kept)).toEqual([at(productId, 0)]);
    });

    it('a member row for a missing definition is refused by the FK', async () => {
      // Arrange
      const harness = await make();
      const missing = newCoreId();
      const foreign = await collectionIn(harness, scopeB);

      // Act and Assert: each call is awaited on its own, so no rejection is ever left without a handler.
      await expect(
        harness.repos.members.replaceMembers(harness.ctx, scopeA, missing, [at(newCoreId(), 0)]),
      ).rejects.toBeInstanceOf(CollectionNotFoundError);
      await expect(
        harness.repos.members.setProductIn(harness.ctx, scopeA, newCoreId(), {
          in: [{ collectionId: foreign, position: 0 }],
          out: [],
        }),
      ).rejects.toBeInstanceOf(CollectionNotFoundError);
    });

    it("a member write into the business's other store's collection is refused", async () => {
      // Arrange
      const harness = await make();
      const otherStore = await collectionIn(harness, scopeA2);
      const productId = newCoreId();

      // Act and Assert
      await expect(
        harness.repos.members.replaceMembers(harness.ctx, scopeA, otherStore, [at(productId, 0)]),
      ).rejects.toBeInstanceOf(CollectionNotFoundError);
      await expect(
        harness.repos.members.setProductIn(harness.ctx, scopeA, productId, {
          in: [{ collectionId: otherStore, position: 0 }],
          out: [],
        }),
      ).rejects.toBeInstanceOf(CollectionNotFoundError);
      expect(await harness.repos.members.collectionIdsOfProducts(harness.ctx, scopeA, [productId])).toEqual(new Map());
      expect(await harness.repos.members.membersOf(harness.ctx, scopeA2, otherStore)).toEqual([]);
    });

    it('deleteProduct removes the product from every collection of its store only', async () => {
      // Arrange
      const harness = await make();
      const productId = newCoreId();
      const [first, second] = [await collectionIn(harness, scopeA), await collectionIn(harness, scopeA)];
      const [otherStore, otherBusiness] = [await collectionIn(harness, scopeA2), await collectionIn(harness, scopeB)];
      for (const [scope, collectionId] of [
        [scopeA, first],
        [scopeA, second],
        [scopeA2, otherStore],
        [scopeB, otherBusiness],
      ] as const) {
        await harness.repos.members.replaceMembers(harness.ctx, scope, collectionId, [at(productId, 0)]);
      }

      // Act
      await harness.repos.members.deleteProduct(harness.ctx, scopeA, productId);

      // Assert
      const { members } = harness.repos;
      expect(await members.collectionIdsOfProducts(harness.ctx, scopeA, [productId])).toEqual(new Map());
      expect(await members.membersOf(harness.ctx, scopeA2, otherStore)).toEqual([at(productId, 0)]);
      expect(await members.membersOf(harness.ctx, scopeB, otherBusiness)).toEqual([at(productId, 0)]);
    });

    it("never reads another store's members of a collection", async () => {
      // Arrange
      const harness = await make();
      const collectionId = await collectionIn(harness, scopeA);
      const productId = newCoreId();
      await harness.repos.members.replaceMembers(harness.ctx, scopeA, collectionId, [at(productId, 0)]);

      // Act
      const seen = await Promise.all(
        [scopeA2, scopeB].map((scope) => harness.repos.members.membersOf(harness.ctx, scope, collectionId)),
      );

      // Assert
      expect(seen).toEqual([[], []]);
      for (const scope of [scopeA2, scopeB]) {
        expect(await harness.repos.members.countsOf(harness.ctx, scope, [collectionId])).toEqual(new Map());
        expect(await harness.repos.members.collectionIdsOfProducts(harness.ctx, scope, [productId])).toEqual(new Map());
      }
    });

    it('collectionIdsOfProducts answers a batch of products', async () => {
      // Arrange
      const harness = await make();
      const [first, second] = [await collectionIn(harness, scopeA), await collectionIn(harness, scopeA)];
      const [both, one, none] = [newCoreId(), newCoreId(), newCoreId()];
      await harness.repos.members.replaceMembers(harness.ctx, scopeA, first, [at(both, 0), at(one, 1)]);
      await harness.repos.members.replaceMembers(harness.ctx, scopeA, second, [at(both, 0)]);

      // Act
      const found = await harness.repos.members.collectionIdsOfProducts(harness.ctx, scopeA, [both, one, none]);

      // Assert
      expect(found.get(both)).toEqual(expect.arrayContaining([first, second]));
      expect(found.get(both)).toHaveLength(2);
      expect(found.get(one)).toEqual([first]);
      expect(found.has(none)).toBe(false);
    });

    it('setProductIn joins and leaves collections, keeping the place of one it is already in', async () => {
      // Arrange
      const harness = await make();
      const [stays, joins, leaves] = [
        await collectionIn(harness, scopeA),
        await collectionIn(harness, scopeA),
        await collectionIn(harness, scopeA),
      ];
      const productId = newCoreId();
      await harness.repos.members.replaceMembers(harness.ctx, scopeA, stays, [at(productId, 4)]);
      await harness.repos.members.replaceMembers(harness.ctx, scopeA, leaves, [at(productId, 0)]);

      // Act
      await harness.repos.members.setProductIn(harness.ctx, scopeA, productId, {
        in: [
          { collectionId: stays, position: 0 },
          { collectionId: joins, position: 2 },
        ],
        out: [leaves],
      });

      // Assert
      expect(await harness.repos.members.membersOf(harness.ctx, scopeA, stays)).toEqual([at(productId, 4)]);
      expect(await harness.repos.members.membersOf(harness.ctx, scopeA, joins)).toEqual([at(productId, 2)]);
      expect(await harness.repos.members.membersOf(harness.ctx, scopeA, leaves)).toEqual([]);
    });

    it('counts members and gives the position after the last one', async () => {
      // Arrange
      const harness = await make();
      const [filled, empty] = [await collectionIn(harness, scopeA), await collectionIn(harness, scopeA)];
      await harness.repos.members.replaceMembers(harness.ctx, scopeA, filled, [at(newCoreId(), 0), at(newCoreId(), 6)]);

      // Act
      const counts = await harness.repos.members.countsOf(harness.ctx, scopeA, [filled, empty]);
      const positions = await Promise.all(
        [filled, empty].map((collectionId) => harness.repos.members.nextPosition(harness.ctx, scopeA, collectionId)),
      );

      // Assert
      expect(counts).toEqual(new Map([[filled, 2]]));
      expect(positions).toEqual([7, 0]);
    });
  });
}
