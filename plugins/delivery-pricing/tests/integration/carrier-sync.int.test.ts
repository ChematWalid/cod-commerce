import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { DELIVERY_PRICING_ERROR_CODES, toBusinessId, toSnowflake, toStoreId } from '@cod/shared';
import type { BusinessFixture, StoreFixture } from '@cod/testing';
import { RequestContextService } from '@vendure/core';
import { describe, expect, it } from 'vitest';
import { CarrierSyncService } from '../../application/carrier-sync.service';
import type { FeeGroupPorts } from '../../application/fee-group-ports';
import { FEE_GROUP_PORTS } from '../../application/tokens';
import type { CarrierRate } from '../../domain/carrier-prices';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { StoreScope } from '../../domain/store-scope';
import { FixedCarrierRates } from '../fakes/in-memory-fee-groups';
import { communeRow, deliveryPricingSuite, type GroupResult, SET_COMMUNES } from './delivery-pricing-kit';

const suite = deliveryPricingSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const ALGER_CENTRE = 1601;
const ALGER_OTHER = 1652;

/** A mock carrier: new Alger bases at wilaya level and for two of its communes. */
const CARRIER_RATES: readonly CarrierRate[] = [
  { provinceCode: '16', codeOns: null, home: 700, desk: 450 },
  { provinceCode: '16', codeOns: ALGER_CENTRE, home: 300, desk: 200 },
  { provinceCode: '16', codeOns: ALGER_OTHER, home: 350, desk: 250 },
];

const scopeOf = (business: BusinessFixture, store: StoreFixture): StoreScope => ({
  businessId: toBusinessId(business.businessId),
  storeId: toStoreId(toSnowflake(store.id)),
});

/** Syncs `groupId` in `store` through `service`, as a carrier integration (P5.S4–S7) will. */
async function syncIn(service: CarrierSyncService, business: BusinessFixture, store: StoreFixture, groupId: string) {
  const ctx = await suite.kit.app
    .get(RequestContextService)
    .create({ apiType: 'admin', channelOrToken: store.channelToken });
  return service.syncDefaults(asOperationContext(ctx), scopeOf(business, store), toSnowflake(groupId));
}

/** The real use case over the server's ports, with a mock carrier port in place of the no-op one. */
const mockSync = (rates: readonly CarrierRate[]) =>
  new CarrierSyncService(suite.kit.app.get<FeeGroupPorts>(FEE_GROUP_PORTS), new FixedCarrierRates(rates));

/** A group of A1 at 650 home everywhere (Alger's base is 500, so 650 is an override) and Alger centre at 450 home. */
async function overriddenGroup(): Promise<GroupResult> {
  await suite.kit.asOwner(suite.fixtures.a);
  const group = await suite.kit.createGroup('Synced', 650);
  await suite.kit.gql(SET_COMMUNES, {
    groupId: group.id,
    provinceCode: '16',
    rows: [{ ...communeRow(ALGER_CENTRE, 450), deskEnabled: false }],
  });
  return group;
}

describe('carrier price sync (D3107, D3136)', () => {
  it('keeps the merchant overrides and switches after a mock carrier sync, updating only the bases', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const group = await overriddenGroup();

    // Act
    const result = await syncIn(mockSync(CARRIER_RATES), a, a.stores[0], group.id);

    // Assert
    const after = await suite.kit.group(group.id);
    const alger = after?.rates.find((rate) => rate.provinceCode === '16');
    const communes = after?.communeRates ?? [];
    expect(result).toBe('synced');
    expect(alger).toEqual({
      provinceCode: '16',
      homePrice: 650,
      deskPrice: 450,
      baseHomePrice: 700,
      baseDeskPrice: 450,
      deliveryEnabled: true,
      deskEnabled: true,
      overridden: true,
    });
    expect(communes.find((row) => row.codeOns === ALGER_CENTRE)).toMatchObject({
      homePrice: 450,
      deskPrice: 200,
      baseHomePrice: 300,
      baseDeskPrice: 200,
      deskEnabled: false,
      overridden: true,
    });
    expect(communes.find((row) => row.codeOns === ALGER_OTHER)).toMatchObject({
      homePrice: 350,
      baseHomePrice: 350,
      deskEnabled: null,
      overridden: false,
    });
    expect(after?.rates.filter((rate) => rate.provinceCode !== '16')).toEqual(
      group.rates.filter((rate) => rate.provinceCode !== '16'),
    );
  });

  it('changes nothing through the wired no-op carrier port', async () => {
    // Arrange
    const { a } = suite.fixtures;
    const group = await overriddenGroup();
    const before = await suite.kit.group(group.id);

    // Act
    const result = await syncIn(suite.kit.app.get(CarrierSyncService), a, a.stores[0], group.id);

    // Assert
    expect(result).toBe('skipped');
    expect(await suite.kit.group(group.id)).toEqual(before);
  });

  it.each([
    ['another business', () => ({ business: suite.fixtures.b, store: suite.fixtures.b.stores[0] })],
    ['another store of the same business', () => ({ business: suite.fixtures.a, store: suite.fixtures.a.stores[1] })],
  ])("never syncs A1's group from %s", async (_label, callerOf) => {
    // Arrange
    const group = await overriddenGroup();
    const before = await suite.kit.group(group.id);
    const { business, store } = callerOf();

    // Act and Assert
    await expect(syncIn(mockSync(CARRIER_RATES), business, store, group.id)).rejects.toMatchObject({
      code: DELIVERY_PRICING_ERROR_CODES.NOT_FOUND,
    });
    await suite.kit.asOwner(suite.fixtures.a);
    expect(await suite.kit.group(group.id)).toEqual(before);
  });
});
