import { describe, expect, it } from 'vitest';
import { OfferKindRegistry } from '../../../domain/engine/kind-registry';
import { BUILT_IN_OFFER_KINDS } from '../../../domain/kinds';

describe('BUILT_IN_OFFER_KINDS', () => {
  it('registers the quantity, product-discount, order-discount and free-delivery kinds', () => {
    // Arrange
    const registry = new OfferKindRegistry(BUILT_IN_OFFER_KINDS);

    // Act
    const kinds = registry.kinds();

    // Assert
    expect(kinds).toEqual(['quantity', 'product_discount', 'order_discount', 'free_delivery']);
  });
});
