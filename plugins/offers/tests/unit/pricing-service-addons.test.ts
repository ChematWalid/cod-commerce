import type { QuoteRequestInput } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import type { OfferRecord } from '../../domain/offer-record';
import { anAddonConfig } from '../support/addon';
import { anActiveOffer, scopeA, scopeA2 } from '../support/offer-records';
import { aRequest, setUpPricing } from '../support/pricing-service';
import { payloadOf } from '../support/quote-token';

/** An active add-on offer of variant 12 (product 2, listed 3,000) at a fixed 1,500, changed by `raw`. */
const anAddonRecord = (raw: Record<string, unknown> = {}): OfferRecord =>
  anActiveOffer({
    kind: 'addon',
    config: anAddonConfig({ price: { mode: 'fixed', value: 1_500 }, ...raw }),
    targets: [{ role: 'addon', refType: 'variant', refId: '12' }],
  });

/** One piece of variant 11 with `quantity` of the add-on variant `variantId` of `offer`. */
const aRequestWithAddon = (offer: OfferRecord, quantity = 1, variantId = '12'): QuoteRequestInput =>
  aRequest(1, { addons: [{ offerId: offer.id, variantId, quantity }] });

describe('PricingService: add-ons in the quote', () => {
  it('signs a with offerId and a null parent, and keeps add-on lines out of l', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    const offer = anAddonRecord();
    seed(scopeA, offer);

    // Act
    const quote = await service.quote(stores.contextOf(scopeA), aRequestWithAddon(offer, 2));
    const payload = payloadOf(quote.quoteToken ?? '');

    // Assert
    expect(quote.lines.map(({ variantId, addonOf }) => ({ variantId, addonOf }))).toEqual([
      { variantId: '11', addonOf: undefined },
      { variantId: '12', addonOf: offer.id },
    ]);
    expect(payload.l.map(({ variantId }) => variantId)).toEqual(['11']);
    expect(payload.a).toEqual([
      { offerId: offer.id, variantId: '12', qty: 2, unitPrice: 1_500, parentVariantId: null },
    ]);
    expect(payload.o).toEqual([{ offerId: offer.id }]);
  });

  it('keeps add-on lines out of l and totals t from l, a, sh and d', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    const offer = anAddonRecord();
    const orderDiscount = anActiveOffer({ kind: 'order_discount', config: { valueType: 'fixed', value: 400 } });
    seed(scopeA, offer, orderDiscount);

    // Act
    const quote = await service.quote(stores.contextOf(scopeA), aRequestWithAddon(offer, 2));
    const { t, l, a, sh, d } = payloadOf(quote.quoteToken ?? '');

    // Assert
    const lines = l.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
    const addons = a.reduce((sum, addon) => sum + addon.unitPrice * addon.qty, 0);
    const discounts = d.reduce((sum, discount) => sum + discount.amount, 0);
    expect(t).toBe(lines + addons + sh - discounts);
    expect(t).toBe(4_900 + 3_000 - 400);
    expect(quote.total).toBe(t);
  });

  it("rejects an add-on of another store's offer as not_offered", async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    const offer = anAddonRecord();
    seed(scopeA2, offer);

    // Act
    const quote = await service.quote(stores.contextOf(scopeA), aRequestWithAddon(offer));

    // Assert
    expect(quote.rejectedAddons).toEqual([{ offerId: offer.id, variantId: '12', reason: 'not_offered' }]);
    expect(quote.lines.map(({ variantId }) => variantId)).toEqual(['11']);
    expect(payloadOf(quote.quoteToken ?? '').a).toEqual([]);
  });

  it('rejects an unavailable add-on variant without making the quote unavailable', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    const offer = anActiveOffer({
      kind: 'addon',
      config: anAddonConfig(),
      targets: [{ role: 'addon', refType: 'variant', refId: '99' }],
    });
    seed(scopeA, offer);

    // Act
    const quote = await service.quote(stores.contextOf(scopeA), aRequestWithAddon(offer, 1, '99'));

    // Assert
    expect(quote.rejectedAddons).toEqual([{ offerId: offer.id, variantId: '99', reason: 'unavailable' }]);
    expect(quote).toMatchObject({ available: true, unavailableVariantIds: [], total: 4_900 });
    expect(quote.quoteToken).toMatch(/^qt1\./);
  });
});

describe('PricingService: add-on placement (D2506)', () => {
  it('prices a thank-you add-on only with the thank_you placement context', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    const offer = anAddonRecord({ placement: 'thank_you' });
    seed(scopeA, offer);
    const ctx = stores.contextOf(scopeA);

    // Act
    const checkout = await service.quoteForScope(ctx, scopeA, aRequestWithAddon(offer));
    const thankYou = await service.quoteForScope(ctx, scopeA, aRequestWithAddon(offer), {
      addonPlacement: 'thank_you',
    });

    // Assert
    expect(checkout.rejectedAddons).toEqual([{ offerId: offer.id, variantId: '12', reason: 'not_offered' }]);
    expect(thankYou.rejectedAddons).toEqual([]);
    expect(thankYou.lines.map(({ addonOf }) => addonOf)).toEqual([undefined, offer.id]);
  });

  it('ignores an addonPlacement field in the public quote input', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    const offer = anAddonRecord({ placement: 'thank_you' });
    seed(scopeA, offer);
    const request = { ...aRequestWithAddon(offer), addonPlacement: 'thank_you' } as QuoteRequestInput;

    // Act
    const quote = await service.quote(stores.contextOf(scopeA), request);

    // Assert
    expect(quote.rejectedAddons).toEqual([{ offerId: offer.id, variantId: '12', reason: 'not_offered' }]);
  });
});

describe('PricingService.verifyQuote: add-ons', () => {
  it('verifies a token with the add-on it was signed for', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    const offer = anAddonRecord();
    seed(scopeA, offer);
    const ctx = stores.contextOf(scopeA);
    const quote = await service.quote(ctx, aRequestWithAddon(offer));

    // Act
    const verdict = await service.verifyQuote(ctx, quote.quoteToken ?? '', aRequestWithAddon(offer));

    // Assert
    expect(verdict).toMatchObject({ ok: true });
  });

  it('fails verify with cart_mismatch when the add-on differs', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    const offer = anAddonRecord();
    const other = anAddonRecord();
    seed(scopeA, offer, other);
    const ctx = stores.contextOf(scopeA);
    const token = (await service.quote(ctx, aRequestWithAddon(offer))).quoteToken ?? '';
    const carts = [
      aRequestWithAddon(other),
      aRequestWithAddon(offer, 2),
      aRequestWithAddon(offer, 1, '11'),
      aRequest(1),
    ];

    // Act
    const verdicts = await Promise.all(carts.map((cart) => service.verifyQuote(ctx, token, cart)));

    // Assert
    expect(verdicts).toEqual(carts.map(() => ({ ok: false, reason: 'cart_mismatch' })));
  });

  it('stores the add-on lines of a repriced order so its fields add up to the total', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    const offer = anAddonRecord();
    const orderDiscount = anActiveOffer({ kind: 'order_discount', config: { valueType: 'fixed', value: 400 } });
    seed(scopeA, offer, orderDiscount);
    const input = { current: aRequest(1), next: aRequestWithAddon(offer, 2), storedTotal: 4_500 };

    // Act
    const result = await service.repriceOrder(stores.contextOf(scopeA), {
      ...input,
      orderUsage: { offerIds: [], codes: [] },
    });

    // Assert
    if (!result.available) throw new Error('expected a priced order change');
    const { lines, addons, quotedShipping, quoteDiscounts } = result.orderFields;
    expect(addons).toEqual([
      { offerId: offer.id, variantId: '12', qty: 2, unitPrice: 1_500, parentVariantId: null },
    ]);
    expect(lines.map(({ variantId }) => variantId)).toEqual(['11']);
    // One piece of each cart line: the order line, not the order fields, holds the quantity.
    const lineSum = lines.reduce((sum, line) => sum + line.quotedUnitPrice, 0);
    const addonSum = addons.reduce((sum, addon) => sum + addon.unitPrice * addon.qty, 0);
    const discounts = (JSON.parse(quoteDiscounts) as { amount: number }[]).reduce((sum, d) => sum + d.amount, 0);
    expect(lineSum + addonSum + quotedShipping - discounts).toBe(result.after.total);
    expect(result.delta).toBe(3_000);
  });
});
