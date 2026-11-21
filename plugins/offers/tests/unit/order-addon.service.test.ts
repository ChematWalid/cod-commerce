import { PRICING_ERROR_CODES } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { anActiveOffer, scopeA, scopeB } from '../support/offer-records';
import { anAddonOrder, aThankYouAddon, ORDER_ID, setUpOrderAddons } from '../support/order-addon';

/** The add-on of `offerId` on variant 12, `quantity` pieces, for the order of these tests. */
const anAddonInput = (offerId: string, quantity = 1) => ({ orderId: ORDER_ID, offerId, variantId: '12', quantity });

describe('OrderAddonService.addAddonToOrder', () => {
  it('appends the add-on to a pending order at the engine price', async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = aThankYouAddon({ price: { mode: 'percent', value: 20 } });
    world.seed(scopeA, offer);
    world.target.add(scopeA, anAddonOrder());

    // Act
    const line = await world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, anAddonInput(offer.id, 2));

    // Assert
    const expected = {
      offerId: offer.id,
      kind: 'addon',
      productId: '2',
      variantId: '12',
      quantity: 2,
      originalPrice: 3_000,
      unitPrice: 2_400,
      parentVariantId: null,
    };
    expect(line).toEqual(expected);
    expect(world.target.appended).toEqual([{ scope: scopeA, orderId: ORDER_ID, line: expected }]);
  });

  it('prices a thank-you add-on for a pending order', async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = aThankYouAddon();
    world.seed(scopeA, offer);
    world.target.add(scopeA, anAddonOrder());

    // Act
    const line = await world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, anAddonInput(offer.id));

    // Assert
    expect(line.unitPrice).toBe(1_500);
    expect(world.quoteOptions).toEqual([{ addonPlacement: 'thank_you', orderUsage: anAddonOrder().orderUsage }]);
  });

  it('appends to an unconfirmed order', async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = aThankYouAddon();
    world.seed(scopeA, offer);
    world.target.add(scopeA, anAddonOrder({ status: 'unconfirmed' }));

    // Act
    await world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, anAddonInput(offer.id));

    // Assert
    expect(world.target.appended.map(({ line }) => line.offerId)).toEqual([offer.id]);
  });

  it('refuses a confirmed order with offers.order-not-editable', async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = aThankYouAddon();
    world.seed(scopeA, offer);
    world.target.add(scopeA, anAddonOrder({ status: 'confirmed' }));

    // Act
    const adding = world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, anAddonInput(offer.id));

    // Assert
    await expect(adding).rejects.toMatchObject({ code: PRICING_ERROR_CODES.ORDER_NOT_EDITABLE });
    expect(world.target.appended).toEqual([]);
    expect(world.quoteOptions).toEqual([]);
  });

  it('refuses while no order source is registered', async () => {
    // Arrange
    const world = setUpOrderAddons({ registerTarget: false });
    const offer = aThankYouAddon();
    world.seed(scopeA, offer);

    // Act
    const adding = world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, anAddonInput(offer.id));

    // Assert
    await expect(adding).rejects.toMatchObject({ code: PRICING_ERROR_CODES.ORDER_ADDON_UNAVAILABLE });
    expect(world.events.applied).toEqual([]);
  });

  it('refuses an unknown order', async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = aThankYouAddon();
    world.seed(scopeA, offer);
    world.target.add(scopeB, anAddonOrder());

    // Act
    const adding = world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, anAddonInput(offer.id));

    // Assert
    await expect(adding).rejects.toMatchObject({ code: PRICING_ERROR_CODES.ORDER_NOT_FOUND });
  });

  it('refuses a malformed order id as an unknown order', async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = aThankYouAddon();
    world.seed(scopeA, offer);

    // Act
    const adding = world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, {
      ...anAddonInput(offer.id),
      orderId: 'order-1',
    });

    // Assert
    await expect(adding).rejects.toMatchObject({ code: PRICING_ERROR_CODES.ORDER_NOT_FOUND });
  });

  it('refuses an order-form-only add-on offer', async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = aThankYouAddon({ placement: 'order_form' });
    world.seed(scopeA, offer);
    world.target.add(scopeA, anAddonOrder());

    // Act
    const adding = world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, anAddonInput(offer.id));

    // Assert
    await expect(adding).rejects.toMatchObject({ code: PRICING_ERROR_CODES.ADDON_NOT_OFFERED });
    expect(world.target.appended).toEqual([]);
  });

  it('refuses an offer that is not an add-on offer', async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = anActiveOffer({ kind: 'order_discount', config: { valueType: 'fixed', value: 400 } });
    world.seed(scopeA, offer);
    world.target.add(scopeA, anAddonOrder());

    // Act
    const adding = world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, anAddonInput(offer.id));

    // Assert
    await expect(adding).rejects.toMatchObject({ code: PRICING_ERROR_CODES.ADDON_NOT_OFFERED });
  });

  it('refuses a malformed offer id as an add-on not offered', async () => {
    // Arrange
    const world = setUpOrderAddons();
    world.target.add(scopeA, anAddonOrder());

    // Act
    const adding = world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, anAddonInput('offer-1'));

    // Assert
    await expect(adding).rejects.toMatchObject({ code: PRICING_ERROR_CODES.ADDON_NOT_OFFERED });
    expect(world.quoteOptions).toEqual([]);
  });

  it("refuses a ctx on another store's channel", async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = aThankYouAddon();
    world.seed(scopeA, offer);
    world.target.add(scopeA, anAddonOrder());

    // Act
    const adding = world.addons.addAddonToOrder(world.stores.contextOf(scopeB), scopeA, anAddonInput(offer.id));

    // Assert
    await expect(adding).rejects.toMatchObject({ code: PRICING_ERROR_CODES.NO_ACTIVE_STORE });
    expect(world.target.appended).toEqual([]);
  });

  it('emits offer.applied with ids and amount only', async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = aThankYouAddon();
    world.seed(scopeA, offer);
    world.target.add(scopeA, anAddonOrder());
    const ctx = world.stores.contextOf(scopeA);

    // Act
    await world.addons.addAddonToOrder(ctx, scopeA, anAddonInput(offer.id, 2));

    // Assert
    expect(world.events.applied).toEqual([
      {
        ctx,
        scope: scopeA,
        payload: {
          offerId: offer.id,
          kind: 'addon',
          orderId: ORDER_ID,
          storeId: scopeA.storeId,
          amount: (3_000 - 1_500) * 2,
          source: 'post_order_addon',
        },
      },
    ]);
  });

  it("caps a repeated add-on at the offer's per-order pieces", async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = aThankYouAddon({ maxPiecesPerOrder: 3 });
    world.seed(scopeA, offer);
    const cart = anAddonOrder().cart;
    world.target.add(
      scopeA,
      anAddonOrder({ cart: { ...cart, addons: [{ offerId: offer.id, variantId: '12', quantity: 2 }] } }),
    );
    const ctx = world.stores.contextOf(scopeA);

    // Act
    const line = await world.addons.addAddonToOrder(ctx, scopeA, anAddonInput(offer.id, 2));

    // Assert
    expect(line.quantity).toBe(1);
    expect(world.target.appended.map(({ line: appended }) => appended.quantity)).toEqual([1]);
    expect(world.events.applied.map(({ payload }) => payload.amount)).toEqual([(3_000 - 1_500) * 1]);
  });

  it('refuses a repeated add-on once the order holds its per-order pieces', async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = aThankYouAddon({ maxPiecesPerOrder: 2 });
    world.seed(scopeA, offer);
    const cart = anAddonOrder().cart;
    world.target.add(
      scopeA,
      anAddonOrder({ cart: { ...cart, addons: [{ offerId: offer.id, variantId: '12', quantity: 2 }] } }),
    );

    // Act
    const adding = world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, anAddonInput(offer.id, 2));

    // Assert
    await expect(adding).rejects.toMatchObject({ code: PRICING_ERROR_CODES.ADDON_NOT_OFFERED });
    expect(world.target.appended).toEqual([]);
    expect(world.events.applied).toEqual([]);
  });

  it('emits nothing when the append fails', async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = aThankYouAddon();
    world.seed(scopeA, offer);
    world.target.add(scopeA, anAddonOrder());
    world.target.failAppendsWith(new Error('order locked'));

    // Act
    const adding = world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, anAddonInput(offer.id));

    // Assert
    await expect(adding).rejects.toThrow('order locked');
    expect(world.events.applied).toEqual([]);
  });
});
