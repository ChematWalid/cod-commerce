import type { Provider } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { PricingService } from '../../application/pricing.service';
import { PRICING_SNAPSHOT_SOURCE } from '../../application/tokens';
import type { PricingSnapshotSource } from '../../domain/ports/pricing-snapshot-source.port';
import { OFFERS_PROVIDERS } from '../../infrastructure/offers.providers';
import { anActiveOffer, scopeA } from '../support/offer-records';
import { aRequest, PRODUCT_1_TARGET, setUpPricing } from '../support/pricing-service';

/** A source that answers from `inner` and counts the loads, as a caching adapter in front of the loader would. */
function countingSource(inner: PricingSnapshotSource): PricingSnapshotSource & { readonly loads: () => number } {
  let loads = 0;
  return {
    load: (ctx, scope, request) => {
      loads += 1;
      return inner.load(ctx, scope, request);
    },
    loads: () => loads,
  };
}

const providerOf = (token: unknown): Provider | undefined =>
  OFFERS_PROVIDERS.find(
    (provider) => typeof provider === 'object' && 'provide' in provider && provider.provide === token,
  );

describe('PricingSnapshotSource (D2424)', () => {
  it('prices through whatever source it is given, so a cache can wrap the loader', async () => {
    // Arrange
    const { stores, seed, loader, signer, kinds } = setUpPricing();
    seed(
      scopeA,
      anActiveOffer({
        config: { priceMode: 'percent', tiers: [{ quantity: 2, price: 10 }] },
        targets: PRODUCT_1_TARGET,
      }),
    );
    const source = countingSource(loader);
    const service = new PricingService({ stores, snapshots: source, signer, kinds });

    // Act
    const quote = await service.quote(stores.contextOf(scopeA), aRequest(2));

    // Assert
    expect(quote.total).toBe(8_820);
    expect(source.loads()).toBe(1);
  });

  it('wires the pricing service to the PRICING_SNAPSHOT_SOURCE token, not to the loader class', () => {
    // Arrange
    const pricing = providerOf(PricingService);

    // Act
    const inject = pricing !== undefined && 'inject' in pricing ? pricing.inject : [];

    // Assert
    expect(providerOf(PRICING_SNAPSHOT_SOURCE)).toBeDefined();
    expect(inject).toContain(PRICING_SNAPSHOT_SOURCE);
  });
});
