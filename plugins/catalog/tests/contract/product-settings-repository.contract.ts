import { toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { ProductSettingsRepositoryPort } from '../../domain/ports/product-settings-repository.port';
import { at, newCoreId, newId, scopeA, scopeA2, scopeB, settingsOf } from '../support/builders';
import type { MakeHarness } from './repository-harness';

/** The behaviour every {@link ProductSettingsRepositoryPort} adapter must have, isolation included. */
export function describeProductSettingsRepositoryContract(
  name: string,
  make: MakeHarness<ProductSettingsRepositoryPort>,
): void {
  describe(`${name} (ProductSettingsRepositoryPort contract)`, () => {
    it('upserts product settings', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const productId = newCoreId();
      const first = settingsOf(scopeA, productId);
      await repo.upsert(ctx, scopeA, first);
      const second = settingsOf(scopeA, productId, {
        nameInDelivery: 'حذاء',
        isFragile: true,
        allowParcelOpening: false,
        allowOutOfStockOrders: false,
        soldOut: true,
        quantityRules: { enabled: true, min: 2, step: 3 },
        orderManagerIds: [toSnowflake('7001'), toSnowflake('7002')],
        customAttributes: [{ name: 'Material', value: 'Leather' }],
        updatedAt: at(10),
      });

      // Act
      await repo.upsert(ctx, scopeA, second);

      // Assert: one row, which keeps its first id and creation date
      const expected = { ...second, id: first.id, createdAt: first.createdAt };
      await expect(repo.findByProduct(ctx, scopeA, productId)).resolves.toEqual(expected);
    });

    it("never reads another store's or business's settings", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const productId = newCoreId();
      await repo.upsert(ctx, scopeA, settingsOf(scopeA, productId));

      // Act
      const fromOtherStore = await repo.findByProduct(ctx, scopeA2, productId);
      const fromB = await repo.findByProduct(ctx, scopeB, productId);

      // Assert
      expect([fromOtherStore, fromB]).toEqual([undefined, undefined]);
    });

    it("does not overwrite another business's settings of the same product id", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const productId = newCoreId();
      const ofA = settingsOf(scopeA, productId);
      await repo.upsert(ctx, scopeA, ofA);

      // Act
      await repo.upsert(ctx, scopeB, settingsOf(scopeB, productId, { id: newId(), isFragile: true }));

      // Assert
      await expect(repo.findByProduct(ctx, scopeA, productId)).resolves.toEqual(ofA);
    });

    it('deletes the settings of a product of its store only', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const productId = newCoreId();
      await repo.upsert(ctx, scopeA, settingsOf(scopeA, productId));

      // Act
      const fromOtherStore = await repo.delete(ctx, scopeA2, productId);
      const fromOwnStore = await repo.delete(ctx, scopeA, productId);

      // Assert
      expect([fromOtherStore, fromOwnStore]).toEqual([false, true]);
      await expect(repo.findByProduct(ctx, scopeA, productId)).resolves.toBeUndefined();
    });
  });
}
