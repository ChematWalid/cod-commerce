import { DELIVERY_PRICING_ERROR_CODES, type WilayaCode } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { CarrierRate } from '../../domain/carrier-prices';
import { InvalidCarrierRatesError } from '../../domain/errors';
import { ctx, groupInput, STORE_A1, STORE_A2, STORE_B1, syncWorld } from '../support/world';

const C = DELIVERY_PRICING_ERROR_CODES;

const rate = (provinceCode: WilayaCode, codeOns: number | null, home: number, desk: number): CarrierRate => ({
  provinceCode,
  codeOns,
  home,
  desk,
});

const commune = (codeOns: number, homePrice: number | null) => ({
  codeOns,
  homePrice,
  deskPrice: null,
  deliveryEnabled: null,
  deskEnabled: false,
});

/** A group in A1 at 650 home in every wilaya (an override of Alger's 500 base), with Alger's 1601 at 450 home. */
async function arrangeGroup(world: ReturnType<typeof syncWorld>) {
  const created = await world.saving.create(ctx, STORE_A1, groupInput({}, 650));
  await world.communes.set(ctx, STORE_A1, created.id, { provinceCode: '16', rows: [commune(1601, 450)] });
  const group = await world.groups.find(ctx, STORE_A1, created.id);
  if (group === undefined) throw new Error('the group was not stored');
  return group;
}

describe('CarrierSyncService', () => {
  it('changes nothing with the default no-op carrier port', async () => {
    // Arrange
    const world = syncWorld(null);
    const before = await arrangeGroup(world);

    // Act
    const result = await world.sync.syncDefaults(ctx, STORE_A1, before.id);

    // Assert
    expect(result).toBe('skipped');
    expect(await world.groups.find(ctx, STORE_A1, before.id)).toEqual(before);
  });

  it("asks the carrier port for the group's carrier", async () => {
    // Arrange
    const world = syncWorld(null);
    const group = await arrangeGroup(world);

    // Act
    await world.sync.syncDefaults(ctx, STORE_A1, group.id);

    // Assert
    expect(world.carrier.asked).toEqual([group.carrierId]);
  });

  it('writes the carrier bases and keeps every override and switch (D3107, D3125)', async () => {
    // Arrange
    const world = syncWorld([rate('16', null, 700, 450), rate('16', 1601, 300, 200), rate('16', 1652, 350, 250)]);
    const before = await arrangeGroup(world);

    // Act
    const result = await world.sync.syncDefaults(ctx, STORE_A1, before.id);

    // Assert
    const after = await world.groups.find(ctx, STORE_A1, before.id);
    const alger = after?.rates.find((row) => row.provinceCode === '16');
    const beforeAlger = before.rates.find((row) => row.provinceCode === '16');
    expect(result).toBe('synced');
    expect(alger).toEqual({ ...beforeAlger, baseHome: 700, baseDesk: 450 });
    expect(alger?.overrideHome).toBe(650);
    expect(after?.rates.filter((row) => row.provinceCode !== '16')).toEqual(
      before.rates.filter((row) => row.provinceCode !== '16'),
    );
    expect(after?.communeRates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codeOns: 1601, baseHome: 300, baseDesk: 200, overrideHome: 450, deskEnabled: false }),
        expect.objectContaining({ codeOns: 1652, baseHome: 350, baseDesk: 250, overrideHome: null, deskEnabled: null }),
      ]),
    );
  });

  it.each([
    ['another business', STORE_B1],
    ['another store of the same business', STORE_A2],
  ])('answers not found for a group of %s without asking the carrier', async (_label, caller) => {
    // Arrange
    const world = syncWorld([rate('16', null, 700, 450)]);
    const group = await arrangeGroup(world);

    // Act and Assert
    await expect(world.sync.syncDefaults(ctx, caller, group.id)).rejects.toMatchObject({ code: C.NOT_FOUND });
    expect(world.carrier.asked).toEqual([]);
  });

  it.each([
    ['an out-of-range price', [rate('16', null, -5, 450)]],
    ['a commune of another wilaya', [rate('01', 1601, 300, 200)]],
  ])('refuses carrier rates with %s and writes nothing', async (_label, rates) => {
    // Arrange
    const world = syncWorld(rates);
    const before = await arrangeGroup(world);

    // Act and Assert
    await expect(world.sync.syncDefaults(ctx, STORE_A1, before.id)).rejects.toBeInstanceOf(InvalidCarrierRatesError);
    expect(await world.groups.find(ctx, STORE_A1, before.id)).toEqual(before);
  });
});
