import { describe, expect, it } from 'vitest';
import type { HighlightRepositoryPort } from '../../domain/ports/highlight-repository.port';
import { at, highlightOf, newCoreId, scopeA, scopeA2, scopeB } from '../support/builders';
import type { MakeHarness } from './repository-harness';

/** The behaviour every {@link HighlightRepositoryPort} adapter must have, link order and isolation included. */
export function describeHighlightRepositoryContract(name: string, make: MakeHarness<HighlightRepositoryPort>): void {
  describe(`${name} (HighlightRepositoryPort contract)`, () => {
    it('finds a highlight only in its store and business', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const highlight = highlightOf(scopeA);

      // Act
      await repo.insert(ctx, scopeA, highlight);

      // Assert
      await expect(repo.findById(ctx, scopeA, highlight.id)).resolves.toEqual(highlight);
      await expect(repo.findById(ctx, scopeA2, highlight.id)).resolves.toBeUndefined();
      await expect(repo.findByIds(ctx, scopeB, [highlight.id])).resolves.toEqual([]);
    });

    it('lists highlights newest first', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [older, newer] = [highlightOf(scopeA, 'Older', at(1)), highlightOf(scopeA, 'Newer', at(2))];
      await repo.insert(ctx, scopeA, older);
      await repo.insert(ctx, scopeA, newer);

      // Act
      const listed = await repo.list(ctx, scopeA);

      // Assert
      expect(listed).toEqual([newer, older]);
    });

    it('keeps highlight order', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [one, two, three] = [highlightOf(scopeA), highlightOf(scopeA), highlightOf(scopeA)];
      for (const highlight of [one, two, three]) await repo.insert(ctx, scopeA, highlight);
      const [first, second, third] = [one.id, two.id, three.id];
      const productId = newCoreId();
      await repo.replaceProductHighlights(ctx, scopeA, productId, [first, second, third]);

      // Act
      await repo.replaceProductHighlights(ctx, scopeA, productId, [third, first, second]);

      // Assert
      await expect(repo.highlightIdsOf(ctx, scopeA, productId)).resolves.toEqual([third, first, second]);
      await expect(repo.highlightIdsOf(ctx, scopeA2, productId)).resolves.toEqual([]);
    });

    it('updates a highlight of its store only', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const highlight = highlightOf(scopeA, 'Before');
      await repo.insert(ctx, scopeA, highlight);
      const changed = { ...highlight, text: 'After', updatedAt: at(3) };

      // Act
      const fromOtherStore = await repo.update(ctx, scopeA2, changed);
      const fromOwnStore = await repo.update(ctx, scopeA, changed);

      // Assert
      expect([fromOtherStore, fromOwnStore]).toEqual([false, true]);
      await expect(repo.findById(ctx, scopeA, highlight.id)).resolves.toEqual(changed);
    });

    it('deletes a highlight with its product links', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [removed, kept] = [highlightOf(scopeA), highlightOf(scopeA)];
      await repo.insert(ctx, scopeA, removed);
      await repo.insert(ctx, scopeA, kept);
      const productId = newCoreId();
      await repo.replaceProductHighlights(ctx, scopeA, productId, [removed.id, kept.id]);

      // Act
      const fromB = await repo.delete(ctx, scopeB, removed.id);
      const fromOtherStore = await repo.delete(ctx, scopeA2, removed.id);
      const fromOwnStore = await repo.delete(ctx, scopeA, removed.id);

      // Assert
      expect([fromB, fromOtherStore, fromOwnStore]).toEqual([false, false, true]);
      await expect(repo.highlightIdsOf(ctx, scopeA, productId)).resolves.toEqual([kept.id]);
    });

    it("never replaces another store's or business's links", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [first, second] = [highlightOf(scopeA), highlightOf(scopeA)];
      for (const highlight of [first, second]) await repo.insert(ctx, scopeA, highlight);
      const productId = newCoreId();
      await repo.replaceProductHighlights(ctx, scopeA, productId, [second.id, first.id]);

      // Act
      await repo.replaceProductHighlights(ctx, scopeA2, productId, []);
      await repo.replaceProductHighlights(ctx, scopeB, productId, []);

      // Assert
      await expect(repo.highlightIdsOf(ctx, scopeA, productId)).resolves.toEqual([second.id, first.id]);
    });

    it('links a repeated highlight once, at its first place', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [first, second] = [highlightOf(scopeA), highlightOf(scopeA)];
      for (const highlight of [first, second]) await repo.insert(ctx, scopeA, highlight);
      const productId = newCoreId();

      // Act
      await repo.replaceProductHighlights(ctx, scopeA, productId, [second.id, first.id, second.id]);

      // Assert
      await expect(repo.highlightIdsOf(ctx, scopeA, productId)).resolves.toEqual([second.id, first.id]);
    });
  });
}
