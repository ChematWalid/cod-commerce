import { MONEY_MAX_DZD, toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { UNRESOLVED_QUOTE } from '../../domain/quote';
import type { ShippingQuoteRequest } from '../../domain/quote-request';
import { storeKeyOf } from '../fakes/in-memory-fee-groups';
import { ctx, groupInput, quoteWorld, STORE_A1, STORE_A2, STORE_B1 } from '../support/world';

/** Home delivery to Alger (16) of one product without a sent weight. */
const request = (fields: Partial<ShippingQuoteRequest> = {}): ShippingQuoteRequest => ({
  provinceCode: '16',
  stopdesk: false,
  items: [{ productId: '7', quantity: 1 }],
  ...fields,
});

/** A world whose store A1 uses a group priced 600 home / 400 desk everywhere, overweight charged 50/kg over 5 kg. */
async function storeWithGroup(chargeOverweight = true) {
  const world = quoteWorld();
  const group = await world.saving.create(ctx, STORE_A1, groupInput({ chargeOverweight }));
  world.storeDefaults.defaults.set(storeKeyOf(STORE_A1), group.id);
  return { ...world, group };
}

describe('ShippingQuoteService', () => {
  it("quotes the wilaya price of the store's default group", async () => {
    // Arrange
    const { quotes } = await storeWithGroup();

    // Act
    const quote = await quotes.quote(ctx, STORE_A1, request());

    // Assert
    expect(quote).toMatchObject({ resolved: true, baseFee: 600, totalFee: 600, source: 'wilaya', speed: 'standard' });
  });

  it('quotes the stop-desk price for a stop-desk delivery', async () => {
    // Arrange
    const { quotes } = await storeWithGroup();

    // Act and Assert
    await expect(quotes.quote(ctx, STORE_A1, request({ stopdesk: true }))).resolves.toMatchObject({ baseFee: 400 });
  });

  it("quotes a commune's own price with its source", async () => {
    // Arrange
    const { quotes, communes, group } = await storeWithGroup();
    await communes.set(ctx, STORE_A1, group.id, {
      provinceCode: '16',
      rows: [{ codeOns: 1601, homePrice: 750, deskPrice: null, deliveryEnabled: null, deskEnabled: null }],
    });

    // Act
    const inCommune = await quotes.quote(ctx, STORE_A1, request({ townOns: 1601 }));
    const otherCommune = await quotes.quote(ctx, STORE_A1, request({ townOns: 1652 }));

    // Assert
    expect(inCommune).toMatchObject({ baseFee: 750, source: 'commune' });
    expect(otherCommune).toMatchObject({ baseFee: 600, source: 'wilaya' });
  });

  it.each([
    ['a commune of another wilaya', 101],
    ['an unknown commune', 999_999],
  ])('answers unresolved for %s, never the wilaya price', async (_label, townOns) => {
    // Arrange
    const { quotes } = await storeWithGroup();

    // Act and Assert
    await expect(quotes.quote(ctx, STORE_A1, request({ townOns }))).resolves.toEqual(UNRESOLVED_QUOTE);
  });

  it('refuses desk in a commune without a reference stop desk (D3125)', async () => {
    // Arrange
    const { quotes } = await storeWithGroup();

    // Act and Assert
    await expect(quotes.quote(ctx, STORE_A1, request({ townOns: 1652, stopdesk: true }))).resolves.toEqual(
      UNRESOLVED_QUOTE,
    );
    await expect(quotes.quote(ctx, STORE_A1, request({ townOns: 1601, stopdesk: true }))).resolves.toMatchObject({
      resolved: true,
    });
  });

  it('answers unresolved for a store with no default group', async () => {
    // Arrange
    const { quotes } = quoteWorld();

    // Act and Assert
    await expect(quotes.quote(ctx, STORE_A1, request())).resolves.toEqual(UNRESOLVED_QUOTE);
  });

  it.each([
    ['another business', STORE_B1],
    ['another store of the same business', STORE_A2],
  ])("answers unresolved when the store's default names a group of %s (defence in depth)", async (_label, owner) => {
    // Arrange
    const world = quoteWorld();
    const foreign = await world.saving.create(ctx, owner, groupInput());
    world.storeDefaults.defaults.set(storeKeyOf(STORE_A1), foreign.id);

    // Act and Assert
    await expect(world.quotes.quote(ctx, STORE_A1, request())).resolves.toEqual(UNRESOLVED_QUOTE);
  });

  it('answers unresolved for a default id that names no group', async () => {
    // Arrange
    const world = quoteWorld();
    world.storeDefaults.defaults.set(storeKeyOf(STORE_A1), toSnowflake('4242'));

    // Act and Assert
    await expect(world.quotes.quote(ctx, STORE_A1, request())).resolves.toEqual(UNRESOLVED_QUOTE);
  });

  it('weighs lines by the sent unit weight, else the product weight, times the quantity', async () => {
    // Arrange
    const { quotes, weights } = await storeWithGroup();
    weights.set('7', 2000);
    const items = [
      { productId: '7', quantity: 2 },
      { productId: '8', quantity: 1, weightGrams: 2500 },
    ];

    // Act
    const quote = await quotes.quote(ctx, STORE_A1, request({ items }));

    // Assert: 6 500 g is 1 500 g over the 5 kg allowance, two started kilograms at 50.
    expect(quote).toMatchObject({ baseFee: 600, overweightFee: 100, totalFee: 700 });
    expect(weights.asked).toEqual([['7']]);
  });

  it('counts a product without a weight as 0 g', async () => {
    // Arrange
    const { quotes, weights } = await storeWithGroup();
    weights.set('7', null);

    // Act and Assert
    await expect(
      quotes.quote(ctx, STORE_A1, request({ items: [{ productId: '7', quantity: 50 }] })),
    ).resolves.toMatchObject({ overweightFee: 0, totalFee: 600 });
  });

  it('reads no product weight when the group does not charge overweight', async () => {
    // Arrange
    const { quotes, weights } = await storeWithGroup(false);
    weights.set('7', 90_000);

    // Act
    const quote = await quotes.quote(ctx, STORE_A1, request());

    // Assert
    expect(quote).toMatchObject({ overweightFee: 0, totalFee: 600 });
    expect(weights.asked).toEqual([]);
  });

  it.each([
    ['a quantity of 0', { productId: '7', quantity: 0 }],
    ['a negative quantity', { productId: '7', quantity: -3 }],
    ['a fractional quantity', { productId: '7', quantity: 1.5 }],
    ['a negative sent weight', { productId: '7', quantity: 1, weightGrams: -1 }],
  ])('answers unresolved for a line with %s even when the group does not charge overweight', async (_label, item) => {
    // Arrange
    const { quotes, weights } = await storeWithGroup(false);

    // Act
    const quote = await quotes.quote(ctx, STORE_A1, request({ items: [item] }));

    // Assert
    expect(quote).toEqual(UNRESOLVED_QUOTE);
    expect(weights.asked).toEqual([]);
  });

  it('answers unresolved for a cart whose weight is safe but whose fee passes the money ceiling', async () => {
    // Arrange: MONEY_MAX_DZD kilograms is a safe weight, but 50 DZD per kilogram over 5 kg is past the ceiling.
    const { quotes } = await storeWithGroup();
    const items = [{ productId: '8', quantity: MONEY_MAX_DZD, weightGrams: 1000 }];

    // Act and Assert
    expect(Number.isSafeInteger(MONEY_MAX_DZD * 1000)).toBe(true);
    await expect(quotes.quote(ctx, STORE_A1, request({ items }))).resolves.toEqual(UNRESOLVED_QUOTE);
  });

  it('answers unresolved for a cart whose weight passes the safe integers (huge quantity)', async () => {
    // Arrange
    const { quotes } = await storeWithGroup();
    const items = [{ productId: '8', quantity: Number.MAX_SAFE_INTEGER, weightGrams: 1000 }];

    // Act and Assert
    await expect(quotes.quote(ctx, STORE_A1, request({ items }))).resolves.toEqual(UNRESOLVED_QUOTE);
  });

  it('waives the fee when asked: the buyer pays 0', async () => {
    // Arrange
    const { quotes } = await storeWithGroup();

    // Act and Assert
    await expect(quotes.quote(ctx, STORE_A1, request({ waive: true }))).resolves.toMatchObject({
      totalFee: 0,
      freeShipping: true,
      waivedFee: 600,
    });
  });
});
