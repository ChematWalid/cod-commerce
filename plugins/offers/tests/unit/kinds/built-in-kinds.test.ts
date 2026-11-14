import { describe, expect, it } from 'vitest';
import { OfferKindRegistry } from '../../../domain/engine/kind-registry';
import { BUILT_IN_OFFER_KINDS } from '../../../domain/kinds';

describe('BUILT_IN_OFFER_KINDS', () => {
  it('registers the quantity and product-discount kinds', () => {
    // Arrange
    const registry = new OfferKindRegistry(BUILT_IN_OFFER_KINDS);

    // Act
    const kinds = registry.kinds();

    // Assert
    expect(kinds).toEqual(expect.arrayContaining(['quantity', 'product_discount']));
  });
});
