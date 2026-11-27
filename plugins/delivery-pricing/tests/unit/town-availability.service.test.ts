import type { StoreId } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { FeeGroupPorts } from '../../application/fee-group-ports';
import { SaveFeeGroupService } from '../../application/save-fee-group.service';
import { SetCommuneRatesService } from '../../application/set-commune-rates.service';
import { TownAvailabilityService } from '../../application/town-availability.service';
import type { ServedStoresPort } from '../../domain/ports/served-stores.port';
import type { StoreScope } from '../../domain/store-scope';
import { NOTHING_OFFERED } from '../../domain/store-modes';
import {
  FixedStoreDefaults,
  FixedTowns,
  InMemoryFeeGroups,
  inlineTransaction,
  storeKeyOf,
} from '../fakes/in-memory-fee-groups';
import { ctx, groupInput, STORE_A1, STORE_A2, STORE_B1 } from '../support/world';

/** {@link ServedStoresPort} over the listed scopes: any other store id is not served. */
class ListedServedStores implements ServedStoresPort {
  constructor(private readonly scopes: readonly StoreScope[]) {}

  scopeOf(storeId: StoreId): Promise<StoreScope | null> {
    return Promise.resolve(this.scopes.find((scope) => scope.storeId === storeId) ?? null);
  }
}

/** Stores A1 and B1 served, each with its own default group, every wilaya delivered with desk. */
function availabilityWorld() {
  const groups = new InMemoryFeeGroups();
  const storeDefaults = new FixedStoreDefaults();
  const ports: FeeGroupPorts = {
    groups,
    transaction: inlineTransaction,
    storeDefaults,
    towns: new FixedTowns({ '16': [1601, 1652], '01': [101] }),
  };
  const saving = new SaveFeeGroupService(ports);
  const groupOf = async (scope: StoreScope, deskInAlger = true) => {
    const input = groupInput();
    const rates = input.rates.map((rate) =>
      rate.provinceCode === '16' ? { ...rate, deskEnabled: deskInAlger } : rate,
    );
    const group = await saving.create(ctx, scope, { ...input, rates });
    storeDefaults.defaults.set(storeKeyOf(scope), group.id);
    return group.id;
  };
  return {
    storeDefaults,
    groupOf,
    communes: new SetCommuneRatesService(ports),
    availability: new TownAvailabilityService(ports, new ListedServedStores([STORE_A1, STORE_B1])),
  };
}

describe('TownAvailabilityService', () => {
  it("answers the wilaya's modes and its differing communes from the store's default group (D3125)", async () => {
    // Arrange
    const { availability, groupOf, communes } = availabilityWorld();
    const groupId = await groupOf(STORE_A1, false);
    await communes.set(ctx, STORE_A1, groupId, {
      provinceCode: '16',
      rows: [{ codeOns: 1652, homePrice: null, deskPrice: null, deliveryEnabled: null, deskEnabled: true }],
    });

    // Act
    const modes = await availability.modesIn(ctx, STORE_A1.storeId, '16');

    // Assert
    expect(modes).toMatchObject({ home: true, desk: false });
    expect([...modes.towns.entries()]).toEqual([[1652, { home: true, desk: true }]]);
  });

  it("never answers with another store's table: each store reads its own default group", async () => {
    // Arrange
    const { availability, groupOf } = availabilityWorld();
    await groupOf(STORE_A1, false);
    await groupOf(STORE_B1, true);

    // Act
    const ofA = await availability.modesIn(ctx, STORE_A1.storeId, '16');
    const ofB = await availability.modesIn(ctx, STORE_B1.storeId, '16');

    // Assert
    expect(ofA.desk).toBe(false);
    expect(ofB.desk).toBe(true);
  });

  it('offers nothing for a store that is not served, even with a default group', async () => {
    // Arrange
    const { availability, groupOf } = availabilityWorld();
    await groupOf(STORE_A2);

    // Act and Assert
    await expect(availability.modesIn(ctx, STORE_A2.storeId, '16')).resolves.toEqual(NOTHING_OFFERED);
  });

  it('offers nothing for a served store without a default group, or whose default is not its own', async () => {
    // Arrange
    const { availability, groupOf, storeDefaults } = availabilityWorld();
    const withoutGroup = await availability.modesIn(ctx, STORE_A1.storeId, '16');
    storeDefaults.defaults.set(storeKeyOf(STORE_A1), await groupOf(STORE_B1));

    // Act
    const pointingAtB = await availability.modesIn(ctx, STORE_A1.storeId, '16');

    // Assert
    expect(withoutGroup).toEqual(NOTHING_OFFERED);
    expect(pointingAtB).toEqual(NOTHING_OFFERED);
  });
});
