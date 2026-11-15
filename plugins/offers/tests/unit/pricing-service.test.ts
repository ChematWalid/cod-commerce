import { QUOTE_TTL_SECONDS, type QuoteRequestInput } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { MS_PER_SECOND } from '../../domain/constants';
import { NoActiveStoreError } from '../../domain/errors';
import { anActiveOffer, scopeA, scopeA2, scopeB } from '../support/offer-records';
import { aRequest, PRODUCT_1_TARGET, setUpPricing, T0_SECONDS } from '../support/pricing-service';
import { payloadOf } from '../support/quote-token';

const TWO_PIECES_10_PERCENT = { priceMode: 'percent', tiers: [{ quantity: 2, price: 10 }] };

/** The quantity offer of the worked examples: 10 % off from two pieces of product 1. */
const aTwoPieceOffer = () => anActiveOffer({ config: TWO_PIECES_10_PERCENT, targets: PRODUCT_1_TARGET });

describe('PricingService.quote', () => {
  it('quotes and signs a token that verifyQuote accepts', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    seed(scopeA, aTwoPieceOffer());
    const ctx = stores.contextOf(scopeA);

    // Act
    const quote = await service.quote(ctx, aRequest(2));
    const verdict = await service.verifyQuote(ctx, quote.quoteToken ?? '', aRequest(2));

    // Assert
    expect(quote).toMatchObject({ available: true, subtotal: 8_820, total: 8_820, unavailableVariantIds: [] });
    expect(quote.quoteToken).toMatch(/^qt1\./);
    expect(quote.expiresAt).toBe(new Date((T0_SECONDS + QUOTE_TTL_SECONDS) * MS_PER_SECOND).toISOString());
    expect(verdict).toMatchObject({ ok: true, payload: { b: scopeA.businessId, s: scopeA.storeId, t: 8_820 } });
  });

  it('returns no token when a line is unavailable', async () => {
    // Arrange
    const { service, stores } = setUpPricing();
    const request = aRequest(1, {
      lines: [
        { variantId: '11', quantity: 1 },
        { variantId: '99', quantity: 1 },
      ],
    });

    // Act
    const quote = await service.quote(stores.contextOf(scopeA), request);

    // Assert
    expect(quote).toMatchObject({ available: false, quoteToken: null, expiresAt: null });
    expect(quote.unavailableVariantIds).toEqual(['99']);
    expect(quote.lines.map((line) => line.variantId)).toEqual(['11']);
  });

  it('ignores a storeId or businessId sent in the request body', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    seed(scopeA, aTwoPieceOffer());
    seed(scopeB, anActiveOffer({ kind: 'order_discount', config: { valueType: 'percent', value: 50 } }));
    const request = { ...aRequest(2), businessId: scopeB.businessId, storeId: scopeB.storeId } as QuoteRequestInput;

    // Act
    const quote = await service.quote(stores.contextOf(scopeA), request);

    // Assert
    expect(quote.total).toBe(8_820);
    expect(payloadOf(quote.quoteToken ?? '')).toMatchObject({ b: scopeA.businessId, s: scopeA.storeId });
  });

  it("ignores a productId that is not the variant's product", async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    const config = { valueType: 'percent', value: 50, appliesTo: 'targets' };
    seed(scopeA, anActiveOffer({ kind: 'product_discount', config, targets: PRODUCT_1_TARGET }));
    const lines = [{ variantId: '12', productId: '1', quantity: 1 }];
    const request = { ...aRequest(), lines } as QuoteRequestInput;

    // Act
    const quote = await service.quote(stores.contextOf(scopeA), request);

    // Assert
    expect(quote.lines[0]).toMatchObject({ productId: '2', unitPrice: 3_000, discounts: [] });
    expect(quote.applied).toEqual([]);
  });

  it('refuses quoteForScope on a ctx of another channel as NoActiveStoreError', async () => {
    // Arrange
    const { service, stores } = setUpPricing();
    const ctxOfA2 = stores.contextOf(scopeA2);

    // Act
    const quoting = service.quoteForScope(ctxOfA2, scopeA, aRequest());

    // Assert
    await expect(quoting).rejects.toBeInstanceOf(NoActiveStoreError);
  });

  it('refuses quote without a resolved tenant as NoActiveStoreError', async () => {
    // Arrange
    const { service, stores } = setUpPricing();
    const ctx = stores.contextOf(scopeA, { resolvedTenant: false });

    // Act
    const quoting = service.quote(ctx, aRequest());

    // Assert
    await expect(quoting).rejects.toBeInstanceOf(NoActiveStoreError);
  });

  it('verifies a quote whose token has p 1 only with the same phone in another format', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    const config = { valueType: 'percent', value: 10, appliesTo: 'targets' };
    seed(scopeA, anActiveOffer({ kind: 'product_discount', config, targets: PRODUCT_1_TARGET, perBuyerLimit: 1 }));
    const ctx = stores.contextOf(scopeA);
    const quote = await service.quote(ctx, aRequest(1, { phone: '0555123456' }));
    const token = quote.quoteToken ?? '';

    // Act
    const samePhone = await service.verifyQuote(ctx, token, aRequest(1, { phone: '+213555123456' }));
    const otherPhone = await service.verifyQuote(ctx, token, aRequest(1, { phone: '+213555654321' }));
    const noPhone = await service.verifyQuote(ctx, token, aRequest(1));

    // Assert
    expect(quote.lines[0]?.unitPrice).toBe(4_410);
    expect(payloadOf(token).p).toBe(1);
    expect(samePhone.ok).toBe(true);
    expect(otherPhone).toEqual({ ok: false, reason: 'cart_mismatch' });
    expect(noPhone).toEqual({ ok: false, reason: 'cart_mismatch' });
  });

  it('leaves the phone out of the token when no applied offer read it', async () => {
    // Arrange
    const { service, stores, seed } = setUpPricing();
    seed(scopeA, aTwoPieceOffer());
    const ctx = stores.contextOf(scopeA);
    const quote = await service.quote(ctx, aRequest(2, { phone: '0555123456' }));

    // Act
    const verdict = await service.verifyQuote(ctx, quote.quoteToken ?? '', aRequest(2, { phone: '0555999999' }));

    // Assert
    expect(payloadOf(quote.quoteToken ?? '').p).toBe(0);
    expect(verdict.ok).toBe(true);
  });
});
