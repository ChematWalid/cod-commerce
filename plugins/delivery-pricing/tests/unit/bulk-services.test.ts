import { DELIVERY_PRICING_ERROR_CODES, type DeliveryFeePriceAdjustmentInput } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ctx, groupInput, STORE_A1, STORE_A2, STORE_B1, world } from '../support/world';

const C = DELIVERY_PRICING_ERROR_CODES;

const adjustment = (fields: Partial<DeliveryFeePriceAdjustmentInput> = {}): DeliveryFeePriceAdjustmentInput => ({
  provinceCodes: ['16'],
  kind: 'amount',
  value: 100,
  home: true,
  desk: false,
  includeCommunes: false,
  ...fields,
});

const commune = (codeOns: number, homePrice: number | null) => ({
  codeOns,
  homePrice,
  deskPrice: null,
  deliveryEnabled: null,
  deskEnabled: null,
});

/** A group of STORE_A1 at 600 home / 400 desk everywhere, with an Alger-Centre override at 450. */
async function pricedGroup(w: ReturnType<typeof world>) {
  const group = await w.saving.create(ctx, STORE_A1, groupInput());
  await w.communes.set(ctx, STORE_A1, group.id, { provinceCode: '16', rows: [commune(1601, 450)] });
  return group;
}

const rateOf = (group: { rates: readonly { provinceCode: string }[] }, code: string) =>
  group.rates.find((row) => row.provinceCode === code);

describe('AdjustPricesService', () => {
  it('raises the selected wilayas as overrides, leaving other wilayas and commune overrides as they are', async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);

    // Act
    const adjusted = await w.adjusting.adjust(ctx, STORE_A1, group.id, adjustment({ value: 50 }));

    // Assert
    expect(rateOf(adjusted, '16')).toMatchObject({ baseHome: 500, overrideHome: 650, overrideDesk: null });
    expect(rateOf(adjusted, '31')).toEqual(rateOf(group, '31'));
    expect(adjusted.communeRates).toEqual([expect.objectContaining({ codeOns: 1601, overrideHome: 450 })]);
    expect(w.groups.locked).toContain(group.id);
  });

  it('moves the commune overrides of the selected wilayas too when communes are included', async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);

    // Act
    const adjusted = await w.adjusting.adjust(
      ctx,
      STORE_A1,
      group.id,
      adjustment({ kind: 'percent', value: 10, includeCommunes: true }),
    );

    // Assert
    expect(rateOf(adjusted, '16')).toMatchObject({ overrideHome: 660 });
    expect(adjusted.communeRates).toEqual([expect.objectContaining({ codeOns: 1601, overrideHome: 495 })]);
  });

  it.each([
    ['the wilayas only', false],
    ['communes included', true],
  ])('writes nothing when the change leaves every price as it is (%s)', async (_label, includeCommunes) => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);
    const before = await w.reads.get(ctx, STORE_A1, group.id);

    // Act
    const adjusted = await w.adjusting.adjust(ctx, STORE_A1, group.id, adjustment({ value: 0, includeCommunes }));

    // Assert
    expect(adjusted).toEqual(before);
  });

  it('keeps the settings and name of the group', async () => {
    // Arrange
    const w = world();
    const group = await w.saving.create(ctx, STORE_A1, groupInput({ name: 'Kept', chargeOverweight: true }));

    // Act
    const adjusted = await w.adjusting.adjust(ctx, STORE_A1, group.id, adjustment());

    // Assert
    expect(adjusted).toMatchObject({ name: 'Kept', chargeOverweight: true, isPlatformDefault: false });
  });

  it.each([
    ['another business', STORE_B1],
    ['another store of the same business', STORE_A2],
  ])('answers not found for a group of %s, which stays unchanged', async (_label, owner) => {
    // Arrange
    const w = world();
    const foreign = await w.saving.create(ctx, owner, groupInput());

    // Act and Assert
    await expect(w.adjusting.adjust(ctx, STORE_A1, foreign.id, adjustment())).rejects.toMatchObject({
      code: C.NOT_FOUND,
    });
    expect(await w.reads.get(ctx, owner, foreign.id)).toEqual(foreign);
  });

  it.each(['abc', '', '-1'])('answers not found for the malformed id "%s"', async (id) => {
    await expect(world().adjusting.adjust(ctx, STORE_A1, id, adjustment())).rejects.toMatchObject({
      code: C.NOT_FOUND,
    });
  });
});

describe('SetCommunePricesService', () => {
  it('gives every commune of the wilaya (from the town directory) the home price', async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);

    // Act
    const updated = await w.communePrices.set(ctx, STORE_A1, group.id, {
      provinceCode: '16',
      prices: { homePrice: 520 },
    });

    // Assert
    expect(updated.communeRates.map((row) => [row.codeOns, row.overrideHome, row.overrideDesk])).toEqual([
      [1601, 520, null],
      [1652, 520, null],
    ]);
    expect(rateOf(updated, '16')).toEqual(rateOf(group, '16'));
  });

  it('moves the group updatedAt forward, so an editor keyed on it reloads the written communes', async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);
    const before = (await w.reads.get(ctx, STORE_A1, group.id))?.updatedAt.getTime() ?? Number.POSITIVE_INFINITY;

    // Act
    const updated = await w.communePrices.set(ctx, STORE_A1, group.id, {
      provinceCode: '16',
      prices: { homePrice: 800 },
    });

    // Assert
    expect(updated.updatedAt.getTime()).toBeGreaterThan(before);
  });

  it('clears every commune override of the wilaya on null', async () => {
    // Arrange
    const w = world();
    const group = await pricedGroup(w);

    // Act
    const updated = await w.communePrices.set(ctx, STORE_A1, group.id, {
      provinceCode: '16',
      prices: { homePrice: null },
    });

    // Assert
    expect(updated.communeRates).toEqual([]);
  });

  it.each([
    ['another business', STORE_B1],
    ['another store of the same business', STORE_A2],
  ])('answers not found for a group of %s, writing no commune row', async (_label, owner) => {
    // Arrange
    const w = world();
    const foreign = await w.saving.create(ctx, owner, groupInput());

    // Act and Assert
    await expect(
      w.communePrices.set(ctx, STORE_A1, foreign.id, { provinceCode: '16', prices: { homePrice: 520 } }),
    ).rejects.toMatchObject({ code: C.NOT_FOUND });
    expect((await w.reads.get(ctx, owner, foreign.id))?.communeRates).toEqual([]);
  });
});

describe('DuplicateFeeGroupService', () => {
  it('copies the settings, wilaya rows and commune rows with their overrides under the new name', async () => {
    // Arrange
    const w = world();
    const source = await pricedGroup(w);

    // Act
    const copy = await w.duplicating.duplicate(ctx, STORE_A1, source.id, { name: 'Copy' });

    // Assert
    expect(copy.id).not.toBe(source.id);
    expect(copy).toMatchObject({
      name: 'Copy',
      isPlatformDefault: false,
      chargeOverweight: source.chargeOverweight,
      overweightAllowanceKg: source.overweightAllowanceKg,
      overweightRate: source.overweightRate,
      carrierId: source.carrierId,
    });
    expect(copy.rates).toEqual(source.rates);
    expect(copy.communeRates).toEqual((await w.reads.get(ctx, STORE_A1, source.id))?.communeRates);
    expect(copy.communeRates).toHaveLength(1);
  });

  it('never copies the platform default flag', async () => {
    // Arrange
    const w = world();
    const id = await w.defaults.ensureFor(ctx, STORE_A1);

    // Act
    const copy = await w.duplicating.duplicate(ctx, STORE_A1, id, { name: 'My prices' });

    // Assert
    expect(copy.isPlatformDefault).toBe(false);
    expect(await w.groups.platformDefaultId(ctx, STORE_A1)).toBe(id);
  });

  it.each([
    ['another business', STORE_B1],
    ['another store of the same business', STORE_A2],
  ])('answers not found for a group of %s, creating nothing', async (_label, owner) => {
    // Arrange
    const w = world();
    const foreign = await w.saving.create(ctx, owner, groupInput());

    // Act and Assert
    await expect(w.duplicating.duplicate(ctx, STORE_A1, foreign.id, { name: 'Stolen' })).rejects.toMatchObject({
      code: C.NOT_FOUND,
    });
    const page = await w.reads.list(ctx, STORE_A1, { skip: 0, take: 10 });
    expect(page.totalItems).toBe(0);
  });
});
