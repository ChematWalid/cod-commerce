import { TOWN_DIRECTORY, type TownDirectory } from '@cod/plugin-geo';
import { ACTIVITY_LOG_SCHEMA, RbacPlugin } from '@cod/plugin-rbac';
import { DELIVERY_PRICING_ERROR_CODES } from '@cod/shared';
import { failureOf } from '@cod/testing';
import gql from 'graphql-tag';
import { describe, expect, it } from 'vitest';
import {
  ADJUST_PRICES,
  communeRow,
  deliveryPricingSuite,
  DUPLICATE_GROUP,
  type GroupResult,
  priceAdjustment,
  SET_COMMUNE_PRICES,
  SET_COMMUNES,
} from './delivery-pricing-kit';

const suite = deliveryPricingSuite({ plugins: [RbacPlugin], partitionedSchemas: [ACTIVITY_LOG_SCHEMA] });
const D = DELIVERY_PRICING_ERROR_CODES;

const codesOf = async (document: string, variables: Record<string, unknown>): Promise<readonly string[]> =>
  (await failureOf(suite.kit.client.query(gql(document), variables))).codes;

const rateOf = (group: GroupResult, code: string) => group.rates.find((rate) => rate.provinceCode === code);

/** A group of A's first store at `homePrice` home / 400 desk, with Alger-Centre (1601) at 450 home. */
async function pricedGroup(name: string, homePrice = 600): Promise<GroupResult> {
  await suite.kit.asOwner(suite.fixtures.a);
  const group = await suite.kit.createGroup(name, homePrice);
  await suite.kit.gql(SET_COMMUNES, { groupId: group.id, provinceCode: '16', rows: [communeRow(1601, 450)] });
  return group;
}

describe('adjustDeliveryFeeGroupPrices', () => {
  it('raises the selected wilaya by a percent, rounded half up, as an override; commune overrides stay', async () => {
    // Arrange
    const group = await pricedGroup('Raise', 745);

    // Act
    const { adjustDeliveryFeeGroupPrices: adjusted } = await suite.kit.gql<{
      adjustDeliveryFeeGroupPrices: GroupResult;
    }>(ADJUST_PRICES, { groupId: group.id, input: priceAdjustment() });

    // Assert
    expect(rateOf(adjusted, '16')).toMatchObject({ homePrice: 820, baseHomePrice: 500, deskPrice: 400 });
    expect(rateOf(adjusted, '16')?.overridden).toBe(true);
    expect(rateOf(adjusted, '31')).toEqual(rateOf(group, '31'));
    expect(adjusted.communeRates).toEqual([expect.objectContaining({ codeOns: 1601, homePrice: 450 })]);
  });

  it('moves the commune overrides of the selected wilaya too when communes are included, over REST', async () => {
    // Arrange
    const group = await pricedGroup('Raise with communes');

    // Act
    const answer = await suite.kit.rest(
      'POST',
      `/delivery-fees/${group.id}/adjust`,
      priceAdjustment({ kind: 'amount', value: -100, desk: true, includeCommunes: true }),
    );

    // Assert
    const adjusted = answer.body as GroupResult;
    expect(answer.status).toBe(200);
    expect(rateOf(adjusted, '16')).toMatchObject({ homePrice: 500, overridden: true, deskPrice: 300 });
    expect(adjusted.communeRates).toEqual([expect.objectContaining({ codeOns: 1601, homePrice: 350 })]);
  });

  it('clamps a cut at 0', async () => {
    // Arrange
    const group = await pricedGroup('Clamp');

    // Act
    const { adjustDeliveryFeeGroupPrices: adjusted } = await suite.kit.gql<{
      adjustDeliveryFeeGroupPrices: GroupResult;
    }>(ADJUST_PRICES, { groupId: group.id, input: priceAdjustment({ kind: 'amount', value: -5000 }) });

    // Assert
    expect(rateOf(adjusted, '16')?.homePrice).toBe(0);
  });

  it.each([
    ['neither price', { home: false, desk: false }],
    ['a percent below -100', { value: -101 }],
    ['an unknown wilaya', { provinceCodes: ['99'] }],
  ])('refuses %s as invalid input, on both surfaces', async (_label, fields) => {
    // Arrange
    const group = await pricedGroup('Refused');

    // Act
    const codes = await codesOf(ADJUST_PRICES, { groupId: group.id, input: priceAdjustment(fields) });
    const rest = await suite.kit.rest('POST', `/delivery-fees/${group.id}/adjust`, priceAdjustment(fields));

    // Assert
    expect(codes).toEqual([D.INVALID_INPUT]);
    expect(rest).toMatchObject({ status: 400, body: { code: D.INVALID_INPUT } });
  });
});

describe('setDeliveryFeeProvinceCommunePrices', () => {
  it("gives every commune of geo's town directory for the wilaya the home price, keeping desk and wilaya", async () => {
    // Arrange
    const group = await pricedGroup('All communes');
    const towns = await suite.kit.app.get<TownDirectory>(TOWN_DIRECTORY).townsOf('16');

    // Act
    const { setDeliveryFeeProvinceCommunePrices: updated } = await suite.kit.gql<{
      setDeliveryFeeProvinceCommunePrices: GroupResult;
    }>(SET_COMMUNE_PRICES, { groupId: group.id, provinceCode: '16', input: { homePrice: 520 } });

    // Assert
    expect(updated.communeRates.map((row) => row.codeOns).sort((l, r) => l - r)).toEqual(
      [...towns].sort((l, r) => l - r),
    );
    expect(updated.communeRates.every((row) => row.homePrice === 520 && row.deskPrice === null)).toBe(true);
    expect(rateOf(updated, '16')).toEqual(rateOf(group, '16'));
  });

  it('moves the group updatedAt forward, so a client keyed on it reloads the communes', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const group = await suite.kit.createGroup('Communes reload');
    const { setDeliveryFeeCommuneRates: before } = await suite.kit.gql<{ setDeliveryFeeCommuneRates: GroupResult }>(
      SET_COMMUNES,
      { groupId: group.id, provinceCode: '16', rows: [communeRow(1601, 450)] },
    );

    // Act
    const { setDeliveryFeeProvinceCommunePrices: after } = await suite.kit.gql<{
      setDeliveryFeeProvinceCommunePrices: GroupResult;
    }>(SET_COMMUNE_PRICES, { groupId: group.id, provinceCode: '16', input: { homePrice: 800 } });

    // Assert
    expect(Date.parse(before.updatedAt)).toBeGreaterThan(Date.parse(group.updatedAt));
    expect(Date.parse(after.updatedAt)).toBeGreaterThan(Date.parse(before.updatedAt));
  });

  it('clears every commune override of the wilaya on null, over REST', async () => {
    // Arrange
    const group = await pricedGroup('Clear communes');

    // Act
    const answer = await suite.kit.rest('PUT', `/delivery-fees/${group.id}/communes/16/prices`, { homePrice: null });

    // Assert
    expect(answer.status).toBe(200);
    expect((answer.body as GroupResult).communeRates).toEqual([]);
  });

  it('refuses a body with no price as invalid input', async () => {
    // Arrange
    const group = await pricedGroup('No price');

    // Act
    const codes = await codesOf(SET_COMMUNE_PRICES, { groupId: group.id, provinceCode: '16', input: {} });

    // Assert
    expect(codes).toEqual([D.INVALID_INPUT]);
  });
});

describe('duplicateDeliveryFeeGroup', () => {
  it('copies the wilaya and commune rows with their overrides under the new name', async () => {
    // Arrange
    const source = await pricedGroup('Source', 650);
    const stored = await suite.kit.group(source.id);

    // Act
    const { duplicateDeliveryFeeGroup: copy } = await suite.kit.gql<{ duplicateDeliveryFeeGroup: GroupResult }>(
      DUPLICATE_GROUP,
      { groupId: source.id, name: 'Copy of Source' },
    );

    // Assert
    expect(copy.id).not.toBe(source.id);
    expect(copy).toMatchObject({ name: 'Copy of Source', isPlatformDefault: false, carrierId: null });
    expect(copy.rates).toEqual(stored?.rates);
    expect(copy.communeRates).toEqual(stored?.communeRates);
  });

  it('copies the platform default table into an ordinary group, over REST (201)', async () => {
    // Arrange
    await suite.kit.asOwner(suite.fixtures.a);
    const platformId = await suite.kit.platformDefaultOf(suite.fixtures.a, suite.fixtures.a.stores[0]);

    // Act
    const answer = await suite.kit.rest('POST', `/delivery-fees/${platformId}/duplicate`, { name: 'My prices' });

    // Assert
    expect(answer.status).toBe(201);
    expect(answer.body).toMatchObject({ name: 'My prices', isPlatformDefault: false });
    expect((await suite.kit.group(platformId))?.isPlatformDefault).toBe(true);
  });

  it('refuses a blank name as invalid input', async () => {
    // Arrange
    const source = await pricedGroup('Unnamed copy');

    // Act
    const codes = await codesOf(DUPLICATE_GROUP, { groupId: source.id, name: '  ' });

    // Assert
    expect(codes).toEqual([D.INVALID_INPUT]);
  });
});
