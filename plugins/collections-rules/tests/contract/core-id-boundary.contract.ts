import { describe, expect, it } from 'vitest';
import { FIRST_MANUAL_POSITION } from '../../domain/constants';
import { CollectionRowConflictError } from '../../domain/collection-row-conflict.error';
import { CollectionNotFoundError, CollectionProductNotFoundError } from '../../domain/errors';
import { definitionOf, newCoreId, scopeA, scopeA2 } from '../support/builders';
import type { MakeHarness } from './repository-harness';

/** Ids no Vendure int column holds: not decimal, exponent form, past the int range, and zero. */
const MALFORMED_IDS = ['abc', '1e3', '2147483648', '0'] as const;

/**
 * How both repositories meet a core id they are handed: a malformed one never reaches Postgres (where it would fail
 * with an error carrying the SQL); reads answer it as absent and writes refuse it like a foreign id.
 */
export function describeCoreIdBoundaryContract(name: string, make: MakeHarness): void {
  describe(`${name} (core id boundary contract)`, () => {
    it.each(MALFORMED_IDS)('reads the malformed id %s as absent', async (malformed) => {
      // Arrange
      const { repos, ctx } = await make();
      await repos.definitions.insert(ctx, scopeA, definitionOf(scopeA));
      const { definitions, members } = repos;

      // Act
      const answers = [
        await definitions.findByCollectionId(ctx, scopeA, malformed),
        await definitions.existing(ctx, scopeA, [malformed]),
        (await definitions.list(ctx, scopeA, { skip: 0, take: 10, collectionIds: [malformed] })).items,
        await definitions.update(ctx, scopeA, definitionOf(scopeA, { collectionId: malformed })),
        await definitions.delete(ctx, scopeA, malformed),
        await members.membersOf(ctx, scopeA, malformed),
        await members.countsOf(ctx, scopeA, [malformed]),
        await members.nextPosition(ctx, scopeA, malformed),
        await members.collectionIdsOfProducts(ctx, scopeA, [malformed]),
      ];
      const deleted = members.deleteProduct(ctx, scopeA, malformed);

      // Assert
      expect(answers).toEqual([undefined, [], [], false, false, [], new Map(), FIRST_MANUAL_POSITION, new Map()]);
      await expect(deleted).resolves.toBeUndefined();
    });

    it.each(MALFORMED_IDS)('refuses a member write naming the malformed id %s', async (malformed) => {
      // Arrange
      const { repos, ctx } = await make();
      const definition = definitionOf(scopeA);
      await repos.definitions.insert(ctx, scopeA, definition);
      const placement = { collectionId: definition.collectionId, position: 0 };

      // Act and Assert: each call is awaited on its own, so no rejection is left without a handler.
      await expect(
        repos.members.replaceMembers(ctx, scopeA, malformed, [{ productId: newCoreId(), position: 0 }]),
      ).rejects.toBeInstanceOf(CollectionNotFoundError);
      await expect(
        repos.members.setProductIn(ctx, scopeA, newCoreId(), {
          in: [{ collectionId: malformed, position: 0 }],
          out: [],
        }),
      ).rejects.toBeInstanceOf(CollectionNotFoundError);
      await expect(
        repos.members.setProductIn(ctx, scopeA, malformed, { in: [placement], out: [] }),
      ).rejects.toBeInstanceOf(CollectionProductNotFoundError);
      expect(await repos.members.membersOf(ctx, scopeA, definition.collectionId)).toEqual([]);
    });

    it('setProductIn inserts a repeated collection once and keys the product by its canonical id', async () => {
      // Arrange
      const { repos, ctx } = await make();
      const definition = definitionOf(scopeA);
      await repos.definitions.insert(ctx, scopeA, definition);
      const productId = newCoreId();

      // Act
      await repos.members.setProductIn(ctx, scopeA, `00${productId}`, {
        in: [
          { collectionId: definition.collectionId, position: 2 },
          { collectionId: `0${definition.collectionId}`, position: 5 },
        ],
        out: [],
      });

      // Assert
      expect(await repos.members.membersOf(ctx, scopeA, definition.collectionId)).toEqual([{ productId, position: 2 }]);
    });
    it.each(MALFORMED_IDS)('refuses a definition naming the malformed collection id %s', async (malformed) => {
      // Arrange
      const { repos, ctx } = await make();

      // Act
      const inserted = repos.definitions.insert(ctx, scopeA, definitionOf(scopeA, { collectionId: malformed }));

      // Assert
      await expect(inserted).rejects.toBeInstanceOf(CollectionNotFoundError);
      expect(await repos.definitions.countInStore(ctx, scopeA)).toBe(0);
    });

    it('stores a padded collection id canonical', async () => {
      // Arrange
      const { repos, ctx } = await make();
      const definition = definitionOf(scopeA);

      // Act
      await repos.definitions.insert(ctx, scopeA, { ...definition, collectionId: `0${definition.collectionId}` });

      // Assert
      const stored = await repos.definitions.findByCollectionId(ctx, scopeA, definition.collectionId);
      expect(stored?.collectionId).toBe(definition.collectionId);
    });

    it("refuses a second definition of a collection, in the business's other store too", async () => {
      // Arrange
      const { repos, ctx } = await make();
      const definition = definitionOf(scopeA);
      await repos.definitions.insert(ctx, scopeA, definition);

      // Act
      const repeated = repos.definitions.insert(
        ctx,
        scopeA2,
        definitionOf(scopeA2, { collectionId: definition.collectionId }),
      );

      // Assert
      await expect(repeated).rejects.toBeInstanceOf(CollectionRowConflictError);
    });

    it('existing answers each found collection once, canonical, in first-given order', async () => {
      // Arrange
      const { repos, ctx } = await make();
      const [first, second] = [definitionOf(scopeA), definitionOf(scopeA)];
      await repos.definitions.insert(ctx, scopeA, first);
      await repos.definitions.insert(ctx, scopeA, second);
      const asked = [`0${second.collectionId}`, first.collectionId, second.collectionId, newCoreId()];

      // Act
      const found = await repos.definitions.existing(ctx, scopeA, asked);

      // Assert
      expect(found).toEqual([second.collectionId, first.collectionId]);
    });

    it('collectionIdsOfProducts keys a padded product id by its canonical id', async () => {
      // Arrange
      const { repos, ctx } = await make();
      const definition = definitionOf(scopeA);
      await repos.definitions.insert(ctx, scopeA, definition);
      const productId = newCoreId();
      await repos.members.setProductIn(ctx, scopeA, productId, {
        in: [{ collectionId: definition.collectionId, position: 0 }],
        out: [],
      });

      // Act
      const found = await repos.members.collectionIdsOfProducts(ctx, scopeA, [`0${productId}`]);

      // Assert
      expect(found).toEqual(new Map([[productId, [definition.collectionId]]]));
    });

    it('setProductIn lets `in` win over `out` for the same collection, at the `in` position', async () => {
      // Arrange
      const { repos, ctx } = await make();
      const definition = definitionOf(scopeA);
      await repos.definitions.insert(ctx, scopeA, definition);
      const productId = newCoreId();
      const { collectionId } = definition;
      await repos.members.setProductIn(ctx, scopeA, productId, { in: [{ collectionId, position: 1 }], out: [] });

      // Act
      await repos.members.setProductIn(ctx, scopeA, productId, {
        in: [{ collectionId, position: 4 }],
        out: [`0${collectionId}`],
      });

      // Assert
      expect(await repos.members.membersOf(ctx, scopeA, collectionId)).toEqual([{ productId, position: 4 }]);
    });
  });
}
