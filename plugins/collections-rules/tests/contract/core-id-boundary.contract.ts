import { describe, expect, it } from 'vitest';
import { FIRST_MANUAL_POSITION } from '../../domain/constants';
import { CollectionNotFoundError, CollectionProductNotFoundError } from '../../domain/errors';
import { definitionOf, newCoreId, scopeA } from '../support/builders';
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
  });
}
