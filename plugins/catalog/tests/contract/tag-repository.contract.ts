import { describe, expect, it } from 'vitest';
import { NameTakenError } from '../../domain/errors';
import type { TagRepositoryPort } from '../../domain/ports/tag-repository.port';
import { at, newCoreId, scopeA, scopeA2, scopeB, tagOf } from '../support/builders';
import type { MakeHarness } from './repository-harness';

/** The behaviour every {@link TagRepositoryPort} adapter must have, product links and isolation included. */
export function describeTagRepositoryContract(name: string, make: MakeHarness<TagRepositoryPort>): void {
  describe(`${name} (TagRepositoryPort contract)`, () => {
    it('lists tags newest first, of its store only', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [oldest, middle, newest] = [
        tagOf(scopeA, 'Old', at(1)),
        tagOf(scopeA, 'Mid', at(2)),
        tagOf(scopeA, 'New', at(3)),
      ];
      for (const tag of [middle, newest, oldest]) await repo.insert(ctx, scopeA, tag);
      await repo.insert(ctx, scopeA2, tagOf(scopeA2, 'Other store', at(4)));
      await repo.insert(ctx, scopeB, tagOf(scopeB, 'Other business', at(5)));

      // Act
      const listed = await repo.list(ctx, scopeA);

      // Assert
      expect(listed).toEqual([newest, middle, oldest]);
    });

    it('refuses a second tag of the same name in one store', async () => {
      // Arrange
      const { repo, ctx } = await make();
      await repo.insert(ctx, scopeA, tagOf(scopeA, 'Summer'));

      // Act
      const second = repo.insert(ctx, scopeA, tagOf(scopeA, ' SUMMER '));

      // Assert
      await expect(second).rejects.toBeInstanceOf(NameTakenError);
    });

    it("replaces a product's tag links", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [first, second, third] = [tagOf(scopeA), tagOf(scopeA), tagOf(scopeA)];
      for (const tag of [first, second, third]) await repo.insert(ctx, scopeA, tag);
      const productId = newCoreId();
      await repo.replaceProductTags(ctx, scopeA, productId, [first.id, second.id]);

      // Act
      await repo.replaceProductTags(ctx, scopeA, productId, [third.id, first.id]);

      // Assert
      await expect(repo.tagIdsOf(ctx, scopeA, productId)).resolves.toEqual([third.id, first.id]);
      await expect(repo.productIdsWithTag(ctx, scopeA, second.id)).resolves.toEqual([]);
      await expect(repo.productIdsWithTag(ctx, scopeA, third.id)).resolves.toEqual([productId]);
    });

    it("never reads another store's or business's links", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const tag = tagOf(scopeA);
      await repo.insert(ctx, scopeA, tag);
      const productId = newCoreId();
      await repo.replaceProductTags(ctx, scopeA, productId, [tag.id]);

      // Act
      const fromOtherStore = await repo.tagIdsOf(ctx, scopeA2, productId);
      const fromB = await repo.productIdsWithTag(ctx, scopeB, tag.id);
      await repo.replaceProductTags(ctx, scopeA2, productId, []);
      await repo.replaceProductTags(ctx, scopeB, productId, []);

      // Assert
      expect(fromOtherStore).toEqual([]);
      expect(fromB).toEqual([]);
      await expect(repo.tagIdsOf(ctx, scopeA, productId)).resolves.toEqual([tag.id]);
    });

    it('deletes a tag with its product links', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [removed, kept] = [tagOf(scopeA), tagOf(scopeA)];
      await repo.insert(ctx, scopeA, removed);
      await repo.insert(ctx, scopeA, kept);
      const productId = newCoreId();
      await repo.replaceProductTags(ctx, scopeA, productId, [removed.id, kept.id]);

      // Act
      const fromB = await repo.delete(ctx, scopeB, removed.id);
      const fromOwnStore = await repo.delete(ctx, scopeA, removed.id);

      // Assert
      expect([fromB, fromOwnStore]).toEqual([false, true]);
      await expect(repo.tagIdsOf(ctx, scopeA, productId)).resolves.toEqual([kept.id]);
    });

    it('links a repeated tag once, at its first place', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [first, second] = [tagOf(scopeA), tagOf(scopeA)];
      for (const tag of [first, second]) await repo.insert(ctx, scopeA, tag);
      const productId = newCoreId();

      // Act
      await repo.replaceProductTags(ctx, scopeA, productId, [second.id, first.id, second.id]);

      // Assert
      await expect(repo.tagIdsOf(ctx, scopeA, productId)).resolves.toEqual([second.id, first.id]);
    });
  });
}
