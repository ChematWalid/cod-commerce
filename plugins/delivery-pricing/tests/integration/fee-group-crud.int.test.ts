import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { DELIVERY_PRICING_ERROR_CODES, WILAYA_COUNT } from '@cod/shared';
import { failureOf } from '@cod/testing';
import gql from 'graphql-tag';
import { describe, expect, it } from 'vitest';
import {
  communeRow,
  CREATE_GROUP_ID,
  deliveryPricingSuite,
  DELETE_GROUP,
  groupInput,
  type GroupResult,
  LIST_GROUPS,
  SET_COMMUNES,
  UPDATE_GROUP,
} from './delivery-pricing-kit';

const suite = deliveryPricingSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const D = DELIVERY_PRICING_ERROR_CODES;

/** The codes a GraphQL call failed with. */
const codesOf = async (document: string, variables: Record<string, unknown>): Promise<readonly string[]> =>
  (await failureOf(suite.kit.client.query(gql(document), variables))).codes;

describe('fee-group CRUD over GraphQL', () => {
  it('creates a group with one row per wilaya, overrides only where it differs from the default', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const group = await suite.kit.createGroup('Standard', 500);

    // Assert
    const alger = group.rates.find((rate) => rate.provinceCode === '16');
    const adrar = group.rates.find((rate) => rate.provinceCode === '01');
    expect(group.rates).toHaveLength(WILAYA_COUNT);
    expect(group).toMatchObject({ name: 'Standard', carrierId: null, isPlatformDefault: false, communeRates: [] });
    expect(alger).toMatchObject({ homePrice: 500, baseHomePrice: 500, overridden: false });
    expect(adrar).toMatchObject({ homePrice: 500, baseHomePrice: 1100, overridden: true });
  });

  it('lists the store groups newest first and searches by name', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a, suite.fixtures.a.stores[1]);
    await suite.kit.createGroup('Nord 100%');
    await suite.kit.createGroup('Sud');

    // Act
    const all = await suite.kit.gql<{ deliveryFeeGroups: { items: GroupResult[]; totalItems: number } }>(LIST_GROUPS);
    const searched = await suite.kit.gql<{ deliveryFeeGroups: { items: GroupResult[] } }>(LIST_GROUPS, {
      options: { search: '100%' },
    });

    // Assert
    // The store's seeded table, made when the store was created (D3111), is the oldest.
    expect(all.deliveryFeeGroups.items.map((group) => group.name)).toEqual([
      'Sud',
      'Nord 100%',
      'أسعار المنصة الافتراضية',
    ]);
    expect(all.deliveryFeeGroups.totalItems).toBe(3);
    expect(searched.deliveryFeeGroups.items.map((group) => group.name)).toEqual(['Nord 100%']);
  });

  it('updates the settings and rates and keeps the commune rows', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await suite.kit.createGroup('Before');
    await suite.kit.gql(SET_COMMUNES, { groupId: group.id, provinceCode: '16', rows: [communeRow(1601, 450)] });

    // Act
    const { updateDeliveryFeeGroup } = await suite.kit.gql<{ updateDeliveryFeeGroup: GroupResult }>(UPDATE_GROUP, {
      id: group.id,
      input: groupInput('After', 500),
    });

    // Assert
    expect(updateDeliveryFeeGroup.name).toBe('After');
    expect(updateDeliveryFeeGroup.rates.find((rate) => rate.provinceCode === '16')?.overridden).toBe(false);
    expect(updateDeliveryFeeGroup.communeRates).toEqual([expect.objectContaining({ codeOns: 1601, homePrice: 450 })]);
  });

  it('writes back a wilaya row missing from the store, never dropping its rate', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await suite.kit.createGroup('Missing Alger');
    await suite.kit.query('DELETE FROM "delivery_fee_rate" WHERE "groupId" = $1 AND "provinceCode" = $2', [
      group.id,
      '16',
    ]);

    // Act
    await suite.kit.gql(UPDATE_GROUP, { id: group.id, input: groupInput('Missing Alger', 450) });

    // Assert
    const rows = await suite.kit.query<{ provinceCode: string; home: number }>(
      'SELECT "provinceCode", COALESCE("overrideHome", "baseHome") AS home FROM "delivery_fee_rate" WHERE "groupId" = $1',
      [group.id],
    );
    expect(rows).toHaveLength(WILAYA_COUNT);
    expect(rows.find((row) => row.provinceCode === '16')?.home).toBe(450);
  });

  it.each([
    ['one rate too few', () => ({ ...groupInput(), rates: groupInput().rates.slice(1) })],
    [
      'a wilaya listed twice',
      () => ({ ...groupInput(), rates: [...groupInput().rates.slice(1), groupInput().rates[1]] }),
    ],
    ['a negative price', () => ({ ...groupInput(), rates: groupInput('x', -1).rates })],
  ])('refuses %s as invalid input (one row per wilaya)', async (_label, input) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act and Assert
    expect(await codesOf(CREATE_GROUP_ID, { input: input() })).toEqual([D.INVALID_INPUT]);
  });

  it('refuses any carrier id as carrier not found (D3109)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act and Assert
    expect(await codesOf(CREATE_GROUP_ID, { input: { ...groupInput(), carrierId: '7' } })).toEqual([
      D.CARRIER_NOT_FOUND,
    ]);
  });

  it('deletes a group, then reads it as null', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await suite.kit.createGroup('Doomed');

    // Act
    await suite.kit.gql(DELETE_GROUP, { id: group.id });

    // Assert
    expect(await suite.kit.group(group.id)).toBeNull();
  });

  it("refuses to delete the store's default group and its platform default (D3108)", async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const linked = await suite.kit.createGroup('Linked');
    const store = suite.fixtures.a.stores[0];
    await suite.kit.query('UPDATE "store" SET "defaultDeliveryFeeGroupId" = $1 WHERE "id" = $2', [linked.id, store.id]);
    const platformDefault = await suite.kit.platformDefaultOf(suite.fixtures.a, store);

    // Act and Assert
    expect(await codesOf(DELETE_GROUP, { id: linked.id })).toEqual([D.GROUP_IN_USE]);
    expect(await codesOf(DELETE_GROUP, { id: platformDefault })).toEqual([D.GROUP_IN_USE]);
  });
});

describe('setDeliveryFeeCommuneRates (D3125)', () => {
  it('merges the named communes, leaves the others and reports overridden from the stored override', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await suite.kit.createGroup('Communes');
    await suite.kit.gql(SET_COMMUNES, {
      groupId: group.id,
      provinceCode: '16',
      rows: [communeRow(1601, 450), { ...communeRow(1652), deskEnabled: false }],
    });

    // Act
    const { setDeliveryFeeCommuneRates } = await suite.kit.gql<{ setDeliveryFeeCommuneRates: GroupResult }>(
      SET_COMMUNES,
      { groupId: group.id, provinceCode: '16', rows: [communeRow(1601, 470)] },
    );

    // Assert
    expect(setDeliveryFeeCommuneRates.communeRates).toEqual([
      expect.objectContaining({ codeOns: 1601, homePrice: 470, deskEnabled: null, overridden: true }),
      expect.objectContaining({ codeOns: 1652, homePrice: null, deskEnabled: false, overridden: false }),
    ]);
  });

  it('deletes a commune row reset to inherit everything', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await suite.kit.createGroup('Reset');
    await suite.kit.gql(SET_COMMUNES, { groupId: group.id, provinceCode: '16', rows: [communeRow(1601, 450)] });

    // Act
    await suite.kit.gql(SET_COMMUNES, { groupId: group.id, provinceCode: '16', rows: [communeRow(1601)] });

    // Assert
    const rows = await suite.kit.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM "delivery_fee_commune_rate" WHERE "groupId" = $1',
      [group.id],
    );
    expect(rows[0]?.n).toBe(0);
  });

  it.each([
    ['of another wilaya (Oran 3101 under Alger)', 3101],
    ['unknown', 9999],
  ])('refuses a commune %s as invalid input', async (_label, codeOns) => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await suite.kit.createGroup('Wrong commune');

    // Act and Assert
    expect(
      await codesOf(SET_COMMUNES, { groupId: group.id, provinceCode: '16', rows: [communeRow(codeOns, 450)] }),
    ).toEqual([D.INVALID_INPUT]);
  });
});

describe('fee-group CRUD over REST (the delivery-fees mirror)', () => {
  it('creates, reads, edits the communes of, and deletes a group', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);

    // Act
    const created = await suite.kit.rest('POST', '/delivery-fees', groupInput('Over REST'));
    const id = (created.body as GroupResult).id;
    const read = await suite.kit.rest('GET', `/delivery-fees/${id}`);
    const communes = await suite.kit.rest('PUT', `/delivery-fees/${id}/communes/16`, { rows: [communeRow(1601, 450)] });
    const listed = await suite.kit.rest('GET', '/delivery-fees?search=Over%20REST&take=5');
    const deleted = await suite.kit.rest('DELETE', `/delivery-fees/${id}`);
    const gone = await suite.kit.rest('GET', `/delivery-fees/${id}`);

    // Assert
    expect(created.status).toBe(201);
    expect(read).toMatchObject({ status: 200, body: { id, name: 'Over REST' } });
    expect((communes.body as GroupResult).communeRates).toHaveLength(1);
    expect((listed.body as { items: GroupResult[] }).items.map((group) => group.id)).toEqual([id]);
    expect(deleted).toMatchObject({ status: 200, body: { success: true } });
    expect(gone).toMatchObject({ status: 404, body: { code: D.NOT_FOUND } });
  });

  it('answers 400 invalid-input for a bad body and 409 group-in-use for the platform default', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const platformDefault = await suite.kit.platformDefaultOf(suite.fixtures.a, suite.fixtures.a.stores[0]);

    // Act
    const invalid = await suite.kit.rest('POST', '/delivery-fees', { name: '' });
    const inUse = await suite.kit.rest('DELETE', `/delivery-fees/${platformDefault}`);

    // Assert
    expect(invalid).toMatchObject({ status: 400, body: { code: D.INVALID_INPUT } });
    expect(inUse).toMatchObject({ status: 409, body: { code: D.GROUP_IN_USE } });
  });
});

describe('the platform default table', () => {
  it('holds one enabled row per wilaya at the default base, once per store', async () => {
    // Arrange
    const store = suite.fixtures.b.stores[0];

    // Act
    const first = await suite.kit.platformDefaultOf(suite.fixtures.b, store);
    const again = await suite.kit.platformDefaultOf(suite.fixtures.b, store);
    await suite.kit.asOwner(suite.fixtures.b);
    const group = await suite.kit.group(first);

    // Assert
    expect(again).toBe(first);
    // Fixture stores are Arabic, so the seeded table is named in Arabic (D3124).
    expect(group).toMatchObject({ name: 'أسعار المنصة الافتراضية', isPlatformDefault: true });
    expect(group?.rates).toHaveLength(WILAYA_COUNT);
    expect(group?.rates.every((rate) => rate.deliveryEnabled && rate.deskEnabled && !rate.overridden)).toBe(true);
    expect(group?.rates.find((rate) => rate.provinceCode === '16')).toMatchObject({ homePrice: 500, deskPrice: 400 });
  });
});
