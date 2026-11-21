import type { OfferTarget } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { addedTargets, catalogRefsOf, holdsEvery } from '../../domain/target-refs';

const variant = (refId: string, role: OfferTarget['role'] = 'buy'): OfferTarget => ({
  role,
  refType: 'variant',
  refId,
});
const product = (refId: string): OfferTarget => ({ role: 'buy', refType: 'product', refId });
const collection = (refId: string): OfferTarget => ({ role: 'buy', refType: 'collection', refId });

describe('target refs (D2537)', () => {
  it('collects the variant, product and collection ids once each (D2342)', () => {
    // Act
    const refs = catalogRefsOf([
      variant('11'),
      variant('11', 'get'),
      product('3'),
      collection('5'),
      product('3'),
      collection('5'),
    ]);

    // Assert
    expect(refs).toEqual({ variantIds: ['11'], productIds: ['3'], collectionIds: ['5'] });
  });

  it('finds the targets an edit adds, whatever their role', () => {
    // Act
    const added = addedTargets([variant('11'), product('3')], [variant('11', 'get'), product('3'), variant('12')]);

    // Assert
    expect(added).toEqual([variant('12')]);
  });

  it('holds every wanted id only when each one was found', () => {
    // Arrange
    const wanted = { variantIds: ['11', '12'], productIds: ['3'], collectionIds: ['5'] };

    // Act
    const complete = holdsEvery(wanted, { variantIds: ['12', '11'], productIds: ['3'], collectionIds: ['5'] });
    const partial = holdsEvery(wanted, { variantIds: ['11'], productIds: ['3'], collectionIds: ['5'] });
    const noCollection = holdsEvery(wanted, { variantIds: ['12', '11'], productIds: ['3'], collectionIds: [] });

    // Assert
    expect([complete, partial, noCollection]).toEqual([true, false, false]);
  });
});
