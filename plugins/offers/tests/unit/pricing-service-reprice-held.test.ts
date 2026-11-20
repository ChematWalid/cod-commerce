import { describe, expect, it } from 'vitest';
import { orderUsageOf } from '../../domain/engine/order-usage';
import { aCode, anActiveOffer, scopeA } from '../support/offer-records';
import { aRequest, PRODUCT_1_TARGET, setUpPricing } from '../support/pricing-service';
import { payloadOf } from '../support/quote-token';

const CODES = ['INFLU10'];
const DELIVERY_FEE = 800;

/** The influencer offer of D2403: 10 % off product 1 for whoever types one of its codes. */
const aCodeProductDiscount = () =>
  anActiveOffer({
    kind: 'product_discount',
    method: 'codes',
    config: { valueType: 'percent', value: 10, appliesTo: 'targets' },
    targets: PRODUCT_1_TARGET,
  });

/** Pricing whose fee table charges {@link DELIVERY_FEE} for every destination. */
function setUpWithDelivery() {
  const pricing = setUpPricing();
  pricing.shipping.register({
    quote: () => Promise.resolve({ resolved: true, baseFee: DELIVERY_FEE, overweightFee: 0, speed: null }),
  });
  return pricing;
}

describe('PricingService held uses (D2445)', () => {
  it("signs every applied offer with the code that activated it in the token's o", async () => {
    // Arrange
    const { service, stores, seed, tables } = setUpPricing();
    const offer = aCodeProductDiscount();
    seed(scopeA, offer);
    tables.codeRows.push({ ...scopeA, value: aCode(offer.id, 'INFLU10') });

    // Act
    const quote = await service.quote(stores.contextOf(scopeA), aRequest(1, { codes: CODES }));

    // Assert
    expect(quote.lines[0]?.unitPrice).toBe(4_410);
    expect(payloadOf(quote.quoteToken ?? '').o).toEqual([{ offerId: offer.id, code: 'INFLU10' }]);
  });

  it('keeps a code-activated product discount at its code limit, its use read from the stored order fields', async () => {
    // Arrange
    const { service, stores, seed, tables } = setUpPricing();
    const offer = aCodeProductDiscount();
    seed(scopeA, offer);
    const code = aCode(offer.id, 'INFLU10', { usageLimit: 1 });
    tables.codeRows.push({ ...scopeA, value: code });
    const ctx = stores.contextOf(scopeA);
    const intake = payloadOf((await service.quote(ctx, aRequest(1, { codes: CODES }))).quoteToken ?? '');
    tables.codeRows[0] = { ...scopeA, value: { ...code, usageCount: 1 } };

    // Act
    const result = await service.repriceOrder(ctx, {
      current: aRequest(1, { codes: CODES }),
      next: aRequest(2, { codes: CODES }),
      orderUsage: orderUsageOf(intake.o),
    });

    // Assert
    expect(result.before.rejectedCodes).toEqual([]);
    expect(result.after.lines[0]?.unitPrice).toBe(4_410);
    expect(result.available && result.orderFields.appliedOffers).toEqual([{ offerId: offer.id, code: 'INFLU10' }]);
  });

  it('keeps a free-delivery offer at its usage limit that the order holds', async () => {
    // Arrange
    const { service, stores, seed, tables } = setUpWithDelivery();
    const offer = anActiveOffer({ kind: 'free_delivery', config: {}, targets: [], totalUsageLimit: 1 });
    seed(scopeA, offer);
    const ctx = stores.contextOf(scopeA);
    const intake = payloadOf((await service.quote(ctx, aRequest(1))).quoteToken ?? '');
    tables.offerRows[0] = { ...scopeA, value: { ...offer, usageCount: 1 } };

    // Act
    const result = await service.repriceOrder(ctx, {
      current: aRequest(1),
      next: aRequest(2),
      orderUsage: orderUsageOf(intake.o),
    });

    // Assert
    expect(intake.o).toEqual([{ offerId: offer.id }]);
    expect(result.before.delivery.price).toBe(0);
    expect(result.after.delivery.price).toBe(0);
    expect(result.available && result.orderFields.appliedOffers).toEqual([{ offerId: offer.id }]);
  });

  it('keeps a quantity tier whose only effect is free delivery at its usage limit', async () => {
    // Arrange
    const { service, stores, seed, tables } = setUpWithDelivery();
    const config = { priceMode: 'percent', tiers: [{ quantity: 2, price: 0, freeDelivery: true }] };
    const offer = anActiveOffer({ config, targets: PRODUCT_1_TARGET, totalUsageLimit: 1 });
    seed(scopeA, offer);
    const ctx = stores.contextOf(scopeA);
    const intake = payloadOf((await service.quote(ctx, aRequest(2))).quoteToken ?? '');
    tables.offerRows[0] = { ...scopeA, value: { ...offer, usageCount: 1 } };

    // Act
    const result = await service.repriceOrder(ctx, {
      current: aRequest(2),
      next: aRequest(3),
      orderUsage: orderUsageOf(intake.o),
    });

    // Assert
    expect(intake.l[0]?.offerIds).toEqual([]);
    expect(intake.o).toEqual([{ offerId: offer.id }]);
    expect(result.after.delivery.price).toBe(0);
  });
});
