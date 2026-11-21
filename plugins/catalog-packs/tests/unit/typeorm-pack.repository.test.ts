import type { SnowflakeIdGeneratorPort, TenantRepositoryFactory } from '@cod/plugin-tenancy';
import { describe, expect, it } from 'vitest';
import { PackComponentEntity } from '../../infrastructure/pack-component.entity';
import { PackEntity } from '../../infrastructure/pack.entity';
import { TypeOrmPackRepository } from '../../infrastructure/typeorm-pack.repository';
import { CTX, SCOPE_A } from '../fakes/pack-world';

/** Rows a fake table answers with; `find` filters on `packId` when the filter names one. */
type Row = Record<string, unknown>;

/** Counts the queries in flight on the one context the repository is given (D2282). */
class QueryCounter {
  inFlight = 0;
  max = 0;

  async answer<T>(value: T): Promise<T> {
    this.inFlight += 1;
    this.max = Math.max(this.max, this.inFlight);
    await new Promise<void>((resolve) => setImmediate(resolve));
    this.inFlight -= 1;
    return value;
  }
}

/** A table that answers `find` with its rows, filtered on the `packId` the filter names. */
function fakeTable(counter: QueryCounter, rows: readonly Row[]) {
  return {
    find: (_scope: unknown, options: { where: Row }) =>
      counter.answer(
        rows.filter((row) => options.where['packId'] === undefined || row['packId'] === options.where['packId']),
      ),
  };
}

const packRow = (id: string, productId: number): Row => ({
  id,
  productId,
  status: 'ok',
  pricingMode: 'components_sum',
  fixedPrice: null,
  discountType: 'percent',
  discountValue: 10,
  variantMode: 'per_component',
  sharedOption: null,
  weightMode: 'components_sum',
  fixedWeightGrams: null,
});

const line = (packId: string, position: number): Row => ({
  packId,
  position,
  productId: 11,
  variantId: null,
  quantity: 1,
});

describe('TypeOrmPackRepository', () => {
  it("reads each pack's component lines one after another, never two queries at once on one context (#260, D2282)", async () => {
    // Arrange
    const counter = new QueryCounter();
    const tables = new Map<unknown, unknown>([
      [PackEntity, fakeTable(counter, [packRow('901', 20), packRow('902', 21), packRow('903', 22)])],
      [PackComponentEntity, fakeTable(counter, [line('901', 0), line('902', 0), line('903', 0)])],
    ]);
    const factory = { for: (entity: unknown) => tables.get(entity) } as unknown as TenantRepositoryFactory;
    const ids = { next: () => '1' } as unknown as SnowflakeIdGeneratorPort;
    const repository = new TypeOrmPackRepository(factory, ids);

    // Act
    const packs = await repository.holding(CTX, SCOPE_A, '11');

    // Assert
    expect(packs.map((pack) => pack.productId)).toEqual(['20', '21', '22']);
    expect(counter.max).toBe(1);
  });
});
