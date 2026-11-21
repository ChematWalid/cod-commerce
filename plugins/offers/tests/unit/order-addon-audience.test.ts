import { PRICING_ERROR_CODES, quoteRequestSchema } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { scopeA } from '../support/offer-records';
import { anAddonOrder, aThankYouAddon, ORDER_ID, setUpOrderAddons } from '../support/order-addon';
import { aRequest } from '../support/pricing-service';

const BUYER_PHONE = '0555123456';

/** A buyer history whose count already includes the pending order, as P3.S4's source will. */
const ORDER_COUNT_WITH_THIS_ORDER = 1;

/** The thank-you add-on of variant 12 for buyers of `audience` only. */
const anAudienceAddon = (audience: 'first' | 'returning') => ({
  ...aThankYouAddon(),
  eligibility: { audience, channels: [], wilayas: [], deliveryMethods: [] },
});

/** The pending order of the buyer's first purchase: recorded with no order before it. */
const aFirstOrder = () =>
  anAddonOrder({
    cart: quoteRequestSchema.parse(aRequest(1, { phone: BUYER_PHONE })),
    orderUsage: { offerIds: [], codes: [], buyerOrdersBefore: 0 },
  });

describe('OrderAddonService.addAddonToOrder audience', () => {
  it("offers a first-order add-on on the buyer's first order, which the history already counts", async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = anAudienceAddon('first');
    world.seed(scopeA, offer);
    world.buyers.register({ orderCountOf: () => Promise.resolve(ORDER_COUNT_WITH_THIS_ORDER) });
    world.target.add(scopeA, aFirstOrder());

    // Act
    const line = await world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, {
      orderId: ORDER_ID,
      offerId: offer.id,
      variantId: '12',
      quantity: 1,
    });

    // Assert
    expect(line.unitPrice).toBe(1_500);
  });

  it("refuses a returning-buyer add-on on the buyer's first order", async () => {
    // Arrange
    const world = setUpOrderAddons();
    const offer = anAudienceAddon('returning');
    world.seed(scopeA, offer);
    world.buyers.register({ orderCountOf: () => Promise.resolve(ORDER_COUNT_WITH_THIS_ORDER) });
    world.target.add(scopeA, aFirstOrder());

    // Act
    const adding = world.addons.addAddonToOrder(world.stores.contextOf(scopeA), scopeA, {
      orderId: ORDER_ID,
      offerId: offer.id,
      variantId: '12',
      quantity: 1,
    });

    // Assert
    await expect(adding).rejects.toMatchObject({ code: PRICING_ERROR_CODES.ADDON_NOT_OFFERED });
    expect(world.target.appended).toEqual([]);
  });
});
