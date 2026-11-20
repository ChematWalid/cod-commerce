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
  it('collects the variant and product ids once each, without collections', () => {
    // Act
    const refs = catalogRefsOf([variant('11'), variant('11', 'get'), product('3'), collection('5'), product('3')]);

    // Assert
    expect(refs).toEqual({ variantIds: ['11'], productIds: ['3'] });
  });

  it('finds the targets an edit adds, whatever their role', () => {
    // Act
    const added = addedTargets([variant('11'), product('3')], [variant('11', 'get'), product('3'), variant('12')]);

    // Assert
    expect(added).toEqual([variant('12')]);
  });

  it('holds every wanted id only when each one was found', () => {
    // Arrange
    const wanted = { variantIds: ['11', '12'], productIds: ['3'] };

    // Act
    const complete = holdsEvery(wanted, { variantIds: ['12', '11'], productIds: ['3'] });
    const partial = holdsEvery(wanted, { variantIds: ['11'], productIds: ['3'] });

    // Assert
    expect([complete, partial]).toEqual([true, false]);
  });
});
