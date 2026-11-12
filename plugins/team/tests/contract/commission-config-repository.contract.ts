import { describe, expect, it } from 'vitest';
import type { CommissionConfigRepositoryPort } from '../../domain/ports/commission-config-repository.port';
import { commissionConfig, scopeA, scopeB } from '../support/builders';
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
  });
}
