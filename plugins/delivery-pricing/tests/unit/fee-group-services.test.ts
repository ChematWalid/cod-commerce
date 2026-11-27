import { DELIVERY_PRICING_ERROR_CODES, WILAYA_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { storeKeyOf } from '../fakes/in-memory-fee-groups';
import { ctx, groupInput, STORE_A1, STORE_A2, STORE_B1, world } from '../support/world';

const C = DELIVERY_PRICING_ERROR_CODES;

describe('SaveFeeGroupService', () => {
  it('creates a group over the platform default bases, storing overrides only where prices differ', async () => {
    // Arrange
    const { saving } = world();

    // Act
    const group = await saving.create(ctx, STORE_A1, groupInput({}, 500));

    // Assert
    const alger = group.rates.find((row) => row.provinceCode === '16');
    const adrar = group.rates.find((row) => row.provinceCode === '01');
    expect(group.isPlatformDefault).toBe(false);
    expect(group.rates).toHaveLength(WILAYA_CODES.length);
    expect(alger).toMatchObject({ baseHome: 500, overrideHome: null, overrideDesk: null });
    expect(adrar).toMatchObject({ baseHome: 1100, baseDesk: 600, overrideHome: 500, overrideDesk: 400 });
  });

  it('refuses any carrier id as not found until carriers exist (D3109)', async () => {
    // Arrange
    const { saving } = world();

    // Act and Assert
    await expect(saving.create(ctx, STORE_A1, groupInput({ carrierId: '7' }))).rejects.toMatchObject({
      code: C.CARRIER_NOT_FOUND,
    });
  });

  it("keeps an edited group's stored bases and its commune rows", async () => {
    // Arrange
    const { saving, communes } = world();
    const created = await saving.create(ctx, STORE_A1, groupInput());
    await communes.set(ctx, STORE_A1, created.id, { provinceCode: '16', rows: [commune(1601, 450)] });

    // Act
    const updated = await saving.update(ctx, STORE_A1, created.id, groupInput({ name: 'Renamed' }, 500));

    // Assert
    expect(updated.name).toBe('Renamed');
    expect(updated.rates.find((row) => row.provinceCode === '16')).toMatchObject({ baseHome: 500, overrideHome: null });
    expect(updated.communeRates).toHaveLength(1);
  });

  it.each([
    ['another business', STORE_B1],
    ['another store of the same business', STORE_A2],
  ])('answers not found for a group of %s, before the carrier check', async (_label, owner) => {
    // Arrange
    const { saving, groups } = world();
    const foreign = await saving.create(ctx, owner, groupInput());

    // Act and Assert
    await expect(saving.update(ctx, STORE_A1, foreign.id, groupInput({ carrierId: '7' }))).rejects.toMatchObject({
      code: C.NOT_FOUND,
    });
    expect(groups.locked).toEqual([foreign.id]);
  });

  it.each(['abc', '', '-1'])('answers not found for the malformed id "%s"', async (id) => {
    await expect(world().saving.update(ctx, STORE_A1, id, groupInput())).rejects.toMatchObject({ code: C.NOT_FOUND });
  });
});

describe('DeleteFeeGroupService', () => {
  it('deletes a group of the store after locking it', async () => {
    // Arrange
    const { saving, deleting, reads, groups } = world();
    const group = await saving.create(ctx, STORE_A1, groupInput());

    // Act
    await deleting.delete(ctx, STORE_A1, group.id);

    // Assert
    expect(groups.locked).toEqual([group.id]);
    await expect(reads.get(ctx, STORE_A1, group.id)).resolves.toBeUndefined();
  });

  it('refuses the platform default group (D3108)', async () => {
    // Arrange
    const { defaults, deleting } = world();
    const id = await defaults.ensureFor(ctx, STORE_A1);

    // Act and Assert
    await expect(deleting.delete(ctx, STORE_A1, id)).rejects.toMatchObject({ code: C.GROUP_IN_USE });
  });

  it("refuses the store's default group (D3108)", async () => {
    // Arrange
    const { saving, deleting, storeDefaults } = world();
    const group = await saving.create(ctx, STORE_A1, groupInput());
    storeDefaults.defaults.set(storeKeyOf(STORE_A1), group.id);

    // Act and Assert
    await expect(deleting.delete(ctx, STORE_A1, group.id)).rejects.toMatchObject({ code: C.GROUP_IN_USE });
  });

  it('answers not found for a group of another business, which stays', async () => {
    // Arrange
    const { saving, deleting, reads } = world();
    const foreign = await saving.create(ctx, STORE_B1, groupInput());

    // Act and Assert
    await expect(deleting.delete(ctx, STORE_A1, foreign.id)).rejects.toMatchObject({ code: C.NOT_FOUND });
    await expect(reads.get(ctx, STORE_B1, foreign.id)).resolves.toBeDefined();
  });
});

function commune(codeOns: number, homePrice: number | null = null) {
  return { codeOns, homePrice, deskPrice: null, deliveryEnabled: null, deskEnabled: null };
}

describe('SetCommuneRatesService', () => {
  it('merges the named communes and leaves the others as they are', async () => {
    // Arrange
    const { saving, communes } = world();
    const group = await saving.create(ctx, STORE_A1, groupInput());
    await communes.set(ctx, STORE_A1, group.id, { provinceCode: '16', rows: [commune(1601, 450), commune(1652, 470)] });

    // Act
    const merged = await communes.set(ctx, STORE_A1, group.id, { provinceCode: '16', rows: [commune(1652, 480)] });

    // Assert
    const byCode = new Map(merged.communeRates.map((row) => [row.codeOns, row.overrideHome]));
    expect(byCode).toEqual(
      new Map([
        [1601, 450],
        [1652, 480],
      ]),
    );
  });

  it('deletes a commune row left with no override, switch or base', async () => {
    // Arrange
    const { saving, communes } = world();
    const group = await saving.create(ctx, STORE_A1, groupInput());
    await communes.set(ctx, STORE_A1, group.id, { provinceCode: '16', rows: [commune(1601, 450)] });

    // Act
    const reset = await communes.set(ctx, STORE_A1, group.id, { provinceCode: '16', rows: [commune(1601)] });

    // Assert
    expect(reset.communeRates).toEqual([]);
  });

  it('never writes a base and keeps a synced one through a reset', async () => {
    // Arrange
    const { saving, communes, groups } = world();
    const group = await saving.create(ctx, STORE_A1, groupInput());
    groups.seedCommuneRow(STORE_A1, group.id, {
      codeOns: 1601,
      provinceCode: '16',
      baseHome: 450,
      baseDesk: null,
      overrideHome: 500,
      overrideDesk: null,
      deliveryEnabled: null,
      deskEnabled: null,
    });

    // Act
    const reset = await communes.set(ctx, STORE_A1, group.id, { provinceCode: '16', rows: [commune(1601)] });

    // Assert
    expect(reset.communeRates).toEqual([expect.objectContaining({ codeOns: 1601, baseHome: 450, overrideHome: null })]);
  });

  it.each([
    ['of another wilaya', 101],
    ['unknown', 9999],
  ])('refuses a commune %s as invalid input', async (_label, codeOns) => {
    // Arrange
    const { saving, communes } = world();
    const group = await saving.create(ctx, STORE_A1, groupInput());

    // Act and Assert
    await expect(
      communes.set(ctx, STORE_A1, group.id, { provinceCode: '16', rows: [commune(codeOns, 450)] }),
    ).rejects.toMatchObject({ code: C.INVALID_INPUT });
  });

  it.each([
    ['another business', STORE_B1],
    ['another store of the same business', STORE_A2],
  ])('answers not found for a group of %s and leaves its communes', async (_label, owner) => {
    // Arrange
    const { saving, communes, reads } = world();
    const foreign = await saving.create(ctx, owner, groupInput());

    // Act and Assert
    await expect(
      communes.set(ctx, STORE_A1, foreign.id, { provinceCode: '16', rows: [commune(1601, 1)] }),
    ).rejects.toMatchObject({ code: C.NOT_FOUND });
    expect((await reads.get(ctx, owner, foreign.id))?.communeRates).toEqual([]);
  });
});

describe('DefaultTableService', () => {
  it('creates one platform default group per store with every wilaya enabled at the default base', async () => {
    // Arrange
    const { defaults, reads } = world();

    // Act
    const id = await defaults.ensureFor(ctx, STORE_A1);

    // Assert
    const group = await reads.get(ctx, STORE_A1, id);
    expect(group).toMatchObject({ name: 'أسعار المنصة الافتراضية', isPlatformDefault: true, chargeOverweight: false });
    expect(group?.rates).toHaveLength(WILAYA_CODES.length);
    expect(group?.rates.every((row) => row.deliveryEnabled && row.deskEnabled && row.overrideHome === null)).toBe(true);
  });

  it.each([
    ['ar', 'أسعار المنصة الافتراضية'],
    ['fr', 'Prix par défaut de la plateforme'],
    ['en', 'Platform default prices'],
  ])('names the table in the store language %s', async (language, name) => {
    // Arrange
    const { defaults, reads, storeDefaults } = world();
    storeDefaults.languages.set(storeKeyOf(STORE_A1), language);

    // Act
    const id = await defaults.ensureFor(ctx, STORE_A1);

    // Assert
    expect((await reads.get(ctx, STORE_A1, id))?.name).toBe(name);
  });

  it('names the table in English when the store language is unknown', async () => {
    // Arrange
    const { defaults, reads, storeDefaults } = world();
    storeDefaults.languages.set(storeKeyOf(STORE_A1), null);

    // Act
    const id = await defaults.ensureFor(ctx, STORE_A1);

    // Assert
    expect((await reads.get(ctx, STORE_A1, id))?.name).toBe('Platform default prices');
  });

  it('is idempotent and per store', async () => {
    // Arrange
    const { defaults, reads } = world();

    // Act
    const first = await defaults.ensureFor(ctx, STORE_A1);
    const again = await defaults.ensureFor(ctx, STORE_A1);
    const other = await defaults.ensureFor(ctx, STORE_A2);

    // Assert
    expect(again).toBe(first);
    expect(other).not.toBe(first);
    expect((await reads.list(ctx, STORE_A1, { skip: 0, take: 20 })).totalItems).toBe(1);
  });
});

describe('FeeGroupReadService', () => {
  it("lists only the store's groups, newest first, with the search", async () => {
    // Arrange
    const { saving, reads } = world();
    await saving.create(ctx, STORE_A1, groupInput({ name: 'Nord' }));
    await saving.create(ctx, STORE_A1, groupInput({ name: 'Sud' }));
    await saving.create(ctx, STORE_A2, groupInput({ name: 'Sud other store' }));

    // Act
    const all = await reads.list(ctx, STORE_A1, { skip: 0, take: 20 });
    const searched = await reads.list(ctx, STORE_A1, { skip: 0, take: 20, search: 'sud' });

    // Assert
    expect(all.items.map((group) => group.name)).toEqual(['Sud', 'Nord']);
    expect(searched.items.map((group) => group.name)).toEqual(['Sud']);
  });
});
