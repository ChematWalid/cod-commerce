import { describe, expect, it } from 'vitest';
import { NoActiveStoreError } from '../../domain/errors';
import { scopeA, scopeA2, scopeB } from '../support/offer-records';
import { aRequest, setUpPricing } from '../support/pricing-service';

/** An order of one piece placed without any offer or code, changed to two pieces. */
const ONE_TO_TWO_PIECES = {
  current: aRequest(1),
  next: aRequest(2),
  storedTotal: 4_900,
  orderUsage: { offerIds: [], codes: [] },
};

describe('PricingService.repriceOrder tenant guards (D2408)', () => {
  it.each([
    ['store A2', scopeA2],
    ['business B', scopeB],
  ])("refuses repriceOrderForScope on a ctx of %s's channel as NoActiveStoreError", async (_name, foreignScope) => {
    // Arrange
    const { service, stores } = setUpPricing();
    const ctx = stores.contextOf(foreignScope);

    // Act
    const repricing = service.repriceOrderForScope(ctx, scopeA, ONE_TO_TWO_PIECES);

    // Assert
    await expect(repricing).rejects.toBeInstanceOf(NoActiveStoreError);
  });

  it('refuses repriceOrder without a resolved tenant as NoActiveStoreError', async () => {
    // Arrange
    const { service, stores } = setUpPricing();
    const ctx = stores.contextOf(scopeA, { resolvedTenant: false });

    // Act
    const repricing = service.repriceOrder(ctx, ONE_TO_TWO_PIECES);

    // Assert
    await expect(repricing).rejects.toBeInstanceOf(NoActiveStoreError);
  });

  it("reprices on the scope's own channel and in the resolved tenant", async () => {
    // Arrange
    const { service, stores } = setUpPricing();
    const ctx = stores.contextOf(scopeA);

    // Act
    const scoped = await service.repriceOrderForScope(ctx, scopeA, ONE_TO_TWO_PIECES);
    const resolved = await service.repriceOrder(ctx, ONE_TO_TWO_PIECES);

    // Assert
    expect(scoped.available && scoped.delta).toBe(4_900);
    expect(resolved).toEqual(scoped);
  });
});
