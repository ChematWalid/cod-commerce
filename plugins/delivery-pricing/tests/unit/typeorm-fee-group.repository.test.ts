import type { SnowflakeIdGeneratorPort, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { toSnowflake } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { DeliveryFeeGroupNotFoundError } from '../../domain/errors';
import type { FeeGroupSettings, WilayaRateRow } from '../../domain/fee-group';
import { FeeCommuneRateEntity } from '../../infrastructure/fee-commune-rate.entity';
import { FeeGroupEntity } from '../../infrastructure/fee-group.entity';
import { FeeRateEntity } from '../../infrastructure/fee-rate.entity';
import { TypeOrmFeeGroupRepository } from '../../infrastructure/typeorm-fee-group.repository';
import { ctx, STORE_A1 } from '../support/world';

/** A tenant repository stub whose `update` reports `affected` rows and whose writes are recorded. */
const repositoryStub = (affected: number) => ({
  update: vi.fn(() => Promise.resolve(affected)),
  insert: vi.fn(() => Promise.resolve()),
});

/** The adapter over stubs: the group header UPDATE reports `headerAffected` rows. */
function repositoryWith(headerAffected: number) {
  const groups = repositoryStub(headerAffected);
  const rates = repositoryStub(0);
  const communes = repositoryStub(0);
  const byEntity = new Map<unknown, unknown>([
    [FeeGroupEntity, groups],
    [FeeRateEntity, rates],
    [FeeCommuneRateEntity, communes],
  ]);
  const factory = { for: (entity: unknown) => byEntity.get(entity) } as unknown as TenantRepositoryFactory;
  const repository = new TypeOrmFeeGroupRepository(factory, { next: () => '1' } as unknown as SnowflakeIdGeneratorPort);
  return { repository, groups, rates };
}

const CHANGE: { readonly settings: FeeGroupSettings; readonly rates: readonly WilayaRateRow[] } = {
  settings: { name: 'Renamed', carrierId: null, chargeOverweight: false, overweightAllowanceKg: 5, overweightRate: 0 },
  rates: [
    {
      provinceCode: '16',
      baseHome: 600,
      baseDesk: 400,
      overrideHome: null,
      overrideDesk: null,
      deliveryEnabled: true,
      deskEnabled: true,
    },
  ],
};

describe('TypeOrmFeeGroupRepository.update', () => {
  it('writes no wilaya row and answers not found when the group header UPDATE touches no row', async () => {
    // Arrange
    const { repository, rates } = repositoryWith(0);

    // Act
    const update = repository.update(ctx, STORE_A1, toSnowflake('42'), CHANGE);

    // Assert
    await expect(update).rejects.toBeInstanceOf(DeliveryFeeGroupNotFoundError);
    expect(rates.update).not.toHaveBeenCalled();
    expect(rates.insert).not.toHaveBeenCalled();
  });

  it('writes the wilaya rows when the group header UPDATE touches exactly its one row', async () => {
    // Arrange
    const { repository, rates } = repositoryWith(1);

    // Act
    await repository.update(ctx, STORE_A1, toSnowflake('42'), CHANGE);

    // Assert
    expect(rates.update).toHaveBeenCalledTimes(1);
    expect(rates.insert).toHaveBeenCalledTimes(1);
  });
});
