import { describe, expect, it } from 'vitest';
import { NameTakenError } from '../../domain/errors';
import type { BrandRepositoryPort } from '../../domain/ports/brand-repository.port';
import { renameBrand } from '../../domain/taxonomy';
import { at, brandOf, scopeA, scopeA2, scopeB } from '../support/builders';
import type { MakeHarness } from './repository-harness';

/** "é" written as one code point and as "e" plus a combining accent: the same name in two Unicode forms. */
const COMPOSED = 'Café';
const DECOMPOSED = 'CAFÉ';

/** The behaviour every {@link BrandRepositoryPort} adapter must have, store and business isolation included. */
export function describeBrandRepositoryContract(name: string, make: MakeHarness<BrandRepositoryPort>): void {
  describe(`${name} (BrandRepositoryPort contract)`, () => {
    it('finds a brand only in its business', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const brand = brandOf(scopeA);

      // Act
      await repo.insert(ctx, scopeA, brand);

      // Assert
      await expect(repo.findById(ctx, scopeA, brand.id)).resolves.toEqual(brand);
      await expect(repo.findById(ctx, scopeB, brand.id)).resolves.toBeUndefined();
      await expect(repo.findByNameKey(ctx, scopeB, brand.nameKey)).resolves.toBeUndefined();
    });

    it('finds a brand only in its store', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const brand = brandOf(scopeA);
      await repo.insert(ctx, scopeA, brand);

      // Act
      const fromOtherStore = await repo.findById(ctx, scopeA2, brand.id);
      const byIds = await repo.findByIds(ctx, scopeA2, [brand.id]);

      // Assert
      expect(fromOtherStore).toBeUndefined();
      expect(byIds).toEqual([]);
      await expect(repo.findByIds(ctx, scopeA, [brand.id])).resolves.toEqual([brand]);
    });

    it('counts the brands of its store only', async () => {
      // Arrange
      const { repo, ctx } = await make();
      await repo.insert(ctx, scopeA, brandOf(scopeA));
      await repo.insert(ctx, scopeA, brandOf(scopeA));
      await repo.insert(ctx, scopeA2, brandOf(scopeA2));
      await repo.insert(ctx, scopeB, brandOf(scopeB));

      // Act
      const counted = await repo.count(ctx, scopeA);

      // Assert
      expect(counted).toBe(2);
    });

    it('refuses a second brand of the same name in one store, whatever its case or Unicode form', async () => {
      // Arrange
      const { repo, ctx } = await make();
      await repo.insert(ctx, scopeA, brandOf(scopeA, COMPOSED));

      // Act
      const second = repo.insert(ctx, scopeA, brandOf(scopeA, DECOMPOSED));

      // Assert
      await expect(second).rejects.toBeInstanceOf(NameTakenError);
      await expect(repo.list(ctx, scopeA)).resolves.toHaveLength(1);
    });

    it('lets another store and another business use the same name', async () => {
      // Arrange
      const { repo, ctx } = await make();
      await repo.insert(ctx, scopeA, brandOf(scopeA, COMPOSED));

      // Act
      await repo.insert(ctx, scopeA2, brandOf(scopeA2, COMPOSED));
      await repo.insert(ctx, scopeB, brandOf(scopeB, DECOMPOSED));

      // Assert
      await expect(repo.list(ctx, scopeA2)).resolves.toHaveLength(1);
      await expect(repo.list(ctx, scopeB)).resolves.toHaveLength(1);
    });

    it('renames a brand of its store only, and refuses a name another brand holds', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [kept, other] = [brandOf(scopeA, 'Before'), brandOf(scopeA, 'Taken')];
      await repo.insert(ctx, scopeA, kept);
      await repo.insert(ctx, scopeA, other);
      const renamed = renameBrand(kept, 'After', at(5));

      // Act
      const fromOtherStore = await repo.update(ctx, scopeA2, renamed);
      const fromOwnStore = await repo.update(ctx, scopeA, renamed);

      // Assert
      expect([fromOtherStore, fromOwnStore]).toEqual([false, true]);
      await expect(repo.findById(ctx, scopeA, kept.id)).resolves.toEqual(renamed);
      await expect(repo.update(ctx, scopeA, renameBrand(kept, 'TAKEN', at(6)))).rejects.toBeInstanceOf(NameTakenError);
    });

    it('deletes a brand of its store only', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const brand = brandOf(scopeA);
      await repo.insert(ctx, scopeA, brand);

      // Act
      const fromB = await repo.delete(ctx, scopeB, brand.id);
      const fromOtherStore = await repo.delete(ctx, scopeA2, brand.id);
      const fromOwnStore = await repo.delete(ctx, scopeA, brand.id);

      // Assert
      expect([fromB, fromOtherStore, fromOwnStore]).toEqual([false, false, true]);
      await expect(repo.findById(ctx, scopeA, brand.id)).resolves.toBeUndefined();
    });
  });
}
