import { QUOTE_TTL_SECONDS, type QuoteRequestInput } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { InvalidQuoteRequestError, NoActiveStoreError } from '../../domain/errors';
import type { StoreScope } from '../../domain/store-scope';
import { T0 } from '../support/builders';
import { scopeA, scopeA2, scopeB } from '../support/offer-records';
import { aRequest, setUpPricing } from '../support/pricing-service';
import { tampered } from '../support/quote-token';

const SECOND_MS = 1_000;

/** A token quoted in store A for two pieces, and the service and contexts to verify it with. */
async function quotedInStoreA() {
  const pricing = setUpPricing();
  const token = (await pricing.service.quote(pricing.stores.contextOf(scopeA), aRequest(2))).quoteToken ?? '';
  const verifyIn = (scope: StoreScope, cart: QuoteRequestInput = aRequest(2), candidate = token) =>
    pricing.service.verifyQuoteForScope(pricing.stores.contextOf(scope), scope, candidate, cart);
  return { ...pricing, token, verifyIn };
}

describe('PricingService.verifyQuote', () => {
  it('fails a token whose cart quantity changed as cart_mismatch', async () => {
    // Arrange
    const { verifyIn } = await quotedInStoreA();

    // Act
    const verdict = await verifyIn(scopeA, aRequest(3));

    // Assert
    expect(verdict).toEqual({ ok: false, reason: 'cart_mismatch' });
  });

  it('fails a token whose signed total was lowered as bad_signature', async () => {
    // Arrange
    const { verifyIn, token } = await quotedInStoreA();
    const cheaper = tampered(token, (payload) => {
      payload.t = 1;
    });

    // Act
    const verdict = await verifyIn(scopeA, aRequest(2), cheaper);

    // Assert
    expect(verdict).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('fails a token signed for store A when verified in store A2', async () => {
    // Arrange
    const { verifyIn } = await quotedInStoreA();

    // Act
    const verdict = await verifyIn(scopeA2);

    // Assert
    expect(verdict).toEqual({ ok: false, reason: 'store_mismatch' });
  });

  it('fails a token signed for business A when verified in business B', async () => {
    // Arrange
    const { verifyIn } = await quotedInStoreA();

    // Act
    const verdict = await verifyIn(scopeB);

    // Assert
    expect(verdict).toEqual({ ok: false, reason: 'business_mismatch' });
  });

  it('fails a token at its expiry, not before', async () => {
    // Arrange
    const { verifyIn, setNow } = await quotedInStoreA();
    setNow(new Date(T0.getTime() + (QUOTE_TTL_SECONDS - 1) * SECOND_MS));
    const justBefore = await verifyIn(scopeA);
    setNow(new Date(T0.getTime() + QUOTE_TTL_SECONDS * SECOND_MS));

    // Act
    const atExpiry = await verifyIn(scopeA);

    // Assert
    expect(justBefore.ok).toBe(true);
    expect(atExpiry).toEqual({ ok: false, reason: 'expired' });
  });

  it('refuses verifyQuoteForScope on a ctx of another channel as NoActiveStoreError', async () => {
    // Arrange
    const { service, stores, token } = await quotedInStoreA();

    // Act
    const verifying = service.verifyQuoteForScope(stores.contextOf(scopeA2), scopeA, token, aRequest(2));

    // Assert
    await expect(verifying).rejects.toBeInstanceOf(NoActiveStoreError);
  });

  it('refuses verifyQuote without a resolved tenant as NoActiveStoreError', async () => {
    // Arrange
    const { service, stores, token } = await quotedInStoreA();

    // Act
    const verifying = service.verifyQuote(stores.contextOf(scopeA, { resolvedTenant: false }), token, aRequest(2));

    // Assert
    await expect(verifying).rejects.toBeInstanceOf(NoActiveStoreError);
  });

  it('refuses a cart that breaks the request schema as InvalidQuoteRequestError', async () => {
    // Arrange
    const { verifyIn } = await quotedInStoreA();

    // Act
    const verifying = verifyIn(scopeA, aRequest(0));

    // Assert
    await expect(verifying).rejects.toBeInstanceOf(InvalidQuoteRequestError);
  });
});
