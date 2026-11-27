import type { SnowflakeIdGeneratorPort, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { toSnowflake } from '@cod/shared';
import { describe, expect, it, vi } from 'vitest';
import { DeliveryFeeGroupNotFoundError } from '../../domain/errors';
import type { FeeGroupSettings, WilayaRateRow } from '../../domain/fee-group';
import type { CommuneRowsChange } from '../../domain/ports/fee-group-repository.port';
import { FeeCommuneRateEntity } from '../../infrastructure/fee-commune-rate.entity';
import { FeeGroupEntity } from '../../infrastructure/fee-group.entity';
import { FeeRateEntity } from '../../infrastructure/fee-rate.entity';
import { TypeOrmFeeGroupRepository } from '../../infrastructure/typeorm-fee-group.repository';
import { ctx, STORE_A1 } from '../support/world';

/** A tenant repository stub whose `update` reports `affected` rows and whose writes are recorded. */
const repositoryStub = (affected: number) => ({
  update: vi.fn(() => Promise.resolve(affected)),
  insert: vi.fn(() => Promise.resolve()),
  delete: vi.fn(() => Promise.resolve()),
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
  return { repository, groups, rates, communes };
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

const COMMUNE_CHANGE: CommuneRowsChange = {
  upserts: [
    {
      provinceCode: '16',
      codeOns: 1601,
      baseHome: null,
      baseDesk: null,
      overrideHome: 800,
      overrideDesk: null,
      deliveryEnabled: null,
      deskEnabled: null,
    },
  ],
  removals: [],
};

describe('TypeOrmFeeGroupRepository.writeCommuneRows', () => {
  it('moves the group updatedAt forward with the commune rows it writes', async () => {
    // Arrange
    const { repository, groups, communes } = repositoryWith(1);

    // Act
    await repository.writeCommuneRows(ctx, STORE_A1, toSnowflake('42'), COMMUNE_CHANGE);

    // Assert
    expect(groups.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: '42' }), {
      updatedAt: expect.any(Date) as unknown,
    });
    expect(communes.insert).toHaveBeenCalledTimes(1);
  });

  it('writes no commune row and answers not found when the group header UPDATE touches no row', async () => {
    // Arrange
    const { repository, communes } = repositoryWith(0);

    // Act
    const write = repository.writeCommuneRows(ctx, STORE_A1, toSnowflake('42'), COMMUNE_CHANGE);

    // Assert
    await expect(write).rejects.toBeInstanceOf(DeliveryFeeGroupNotFoundError);
    expect(communes.delete).not.toHaveBeenCalled();
    expect(communes.insert).not.toHaveBeenCalled();
  });
});
