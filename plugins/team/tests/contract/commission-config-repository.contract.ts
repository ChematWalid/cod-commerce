import { describe, expect, it } from 'vitest';
import type { CommissionConfigRepositoryPort } from '../../domain/ports/commission-config-repository.port';
import { commissionConfig, newId, scopeA, scopeB } from '../support/builders';
import type { MakeHarness } from './repository-harness';

/** The behaviour every {@link CommissionConfigRepositoryPort} adapter must have, tenant isolation included. */
export function describeCommissionConfigRepositoryContract(
  name: string,
  make: MakeHarness<CommissionConfigRepositoryPort>,
): void {
  describe(`${name} (CommissionConfigRepositoryPort contract)`, () => {
    it('finds a saved config by id and by name key, in its business only', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const config = commissionConfig(scopeA);

      // Act
      await repo.insert(ctx, scopeA, config);

      // Assert
      await expect(repo.findById(ctx, scopeA, config.id)).resolves.toEqual(config);
      await expect(repo.findByNameKey(ctx, scopeA, config.nameKey)).resolves.toEqual(config);
      await expect(repo.findById(ctx, scopeB, config.id)).resolves.toBeUndefined();
      await expect(repo.findByNameKey(ctx, scopeB, config.nameKey)).resolves.toBeUndefined();
    });

    it('lets two businesses use one name, but not one business twice', async () => {
      // Arrange
      const { repo, ctx } = await make();
      await repo.insert(ctx, scopeA, commissionConfig(scopeA, { name: 'Delivery bonus' }));

      // Act
      await repo.insert(ctx, scopeB, commissionConfig(scopeB, { name: 'Delivery bonus' }));

      // Assert
      await expect(repo.insert(ctx, scopeA, commissionConfig(scopeA, { name: 'DELIVERY bonus' }))).rejects.toThrow();
    });

    it("lists the business's own configs by name key", async () => {
      // Arrange
      const { repo, ctx } = await make();
      const [beta, alpha, ofB] = [
        commissionConfig(scopeA, { name: 'Beta' }),
        commissionConfig(scopeA, { name: 'Alpha' }),
        commissionConfig(scopeB, { name: 'Gamma' }),
      ];
      await repo.insert(ctx, scopeA, beta);
      await repo.insert(ctx, scopeA, alpha);
      await repo.insert(ctx, scopeB, ofB);

      // Act
      const listed = await repo.list(ctx, scopeA);

      // Assert
      expect(listed).toEqual([alpha, beta]);
    });

    it('updates a config of its business only', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const config = commissionConfig(scopeA, { name: 'Before' });
      await repo.insert(ctx, scopeA, config);
      const renamed = { ...config, name: 'After', nameKey: 'after', value: 400, storeIds: [newId()] };

      // Act
      const fromB = await repo.update(ctx, scopeB, renamed);
      const fromA = await repo.update(ctx, scopeA, renamed);

      // Assert
      expect([fromB, fromA]).toEqual([false, true]);
      await expect(repo.findById(ctx, scopeA, config.id)).resolves.toEqual(renamed);
    });

    it('deletes a config of its business only', async () => {
      // Arrange
      const { repo, ctx } = await make();
      const config = commissionConfig(scopeA);
      await repo.insert(ctx, scopeA, config);

      // Act
      const fromB = await repo.delete(ctx, scopeB, config.id);
      const keptForA = await repo.findById(ctx, scopeA, config.id);
      const fromA = await repo.delete(ctx, scopeA, config.id);

      // Assert
      expect([fromB, fromA]).toEqual([false, true]);
      expect(keptForA).toEqual(config);
      await expect(repo.findById(ctx, scopeA, config.id)).resolves.toBeUndefined();
    });
  });
}
