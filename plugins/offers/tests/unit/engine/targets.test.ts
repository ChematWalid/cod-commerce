import type { OfferTarget } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { matchingLines } from '../../../domain/engine/targets';
import { aLine, anOffer } from '../../support/builders';

const red = aLine({ variantId: '11', productId: '1' });
const blue = aLine({ variantId: '12', productId: '1' });
const mug = aLine({ variantId: '21', productId: '2', collectionIds: ['301'] });
const cap = aLine({ variantId: '31', productId: '3' });

describe('matchingLines', () => {
  it('matches lines by variant, product and collection target', () => {
    // Arrange
    const offer = anOffer({
      targets: [
        { role: 'buy', refType: 'variant', refId: '31' },
        { role: 'buy', refType: 'product', refId: '1' },
        { role: 'buy', refType: 'collection', refId: '301' },
      ],
    });

    // Act
    const matched = matchingLines(offer, [red, blue, mug, cap]);

    // Assert
    expect(matched.map((line) => line.key)).toEqual(['11', '12', '21', '31']);
  });

  it('leaves out lines no target names', () => {
    // Arrange
    const offer = anOffer({ targets: [{ role: 'buy', refType: 'product', refId: '1' }] });

    // Act
    const matched = matchingLines(offer, [red, mug, cap]);

    // Assert
    expect(matched).toEqual([red]);
  });

  it('matches no line for an offer without targets', () => {
    // Arrange
    const offer = anOffer({ targets: [] });

    // Act
    const matched = matchingLines(offer, [red, mug]);

    // Assert
    expect(matched).toEqual([]);
  });

  it('does not confuse a product id with a variant id of the same number', () => {
    // Arrange
    const offer = anOffer({ targets: [{ role: 'buy', refType: 'variant', refId: '1' }] });

    // Act
    const matched = matchingLines(offer, [red]);

    // Assert
    expect(matched).toEqual([]);
  });

  it('matches every line for appliesTo all', () => {
    // Arrange
    const offer = anOffer({ kind: 'product_discount', targets: [] });

    // Act
    const matched = matchingLines(offer, [red, mug, cap], 'all');

    // Assert
    expect(matched).toEqual([red, mug, cap]);
  });

  it.each(['constructor', 'toString', '__proto__', 'tag'])(
    'matches no line for a stored target of unknown refType %s',
    (refType) => {
      // Arrange
      const target = { role: 'buy', refType, refId: '11' } as unknown as OfferTarget;
      const offer = anOffer({ targets: [target] });

      // Act
      const matched = matchingLines(offer, [red, blue]);

      // Assert
      expect(matched).toEqual([]);
    },
  );
});
