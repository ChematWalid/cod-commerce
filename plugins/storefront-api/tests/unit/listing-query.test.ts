import { STOREFRONT_LIST_DEFAULT_TAKE, STOREFRONT_LIST_MAX_TAKE } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { LISTING_MAX_SKIP, listingQueryOf } from '../../domain/listing-query';

describe('listingQueryOf', () => {
  it.each([
    ['0', 1],
    ['-1', 1],
    ['1000', STOREFRONT_LIST_MAX_TAKE],
    [12, 12],
  ])('clamps take %s to %s', (take, expected) => {
    // Act / Assert
    expect(listingQueryOf({ take }).take).toBe(expected);
  });

  it.each([undefined, 'abc', '1e3', '12.5', ['3', '4'], { n: 1 }, '99999999999999999999'])(
    'reads a malformed take %j as the default',
    (take) => {
      // Act / Assert
      expect(listingQueryOf({ take }).take).toBe(STOREFRONT_LIST_DEFAULT_TAKE);
    },
  );

  it('clamps skip to zero below and to the largest skip above, and reads a malformed one as zero', () => {
    // Act / Assert
    expect(listingQueryOf({ skip: '-5' }).skip).toBe(0);
    expect(listingQueryOf({ skip: '999999999999' }).skip).toBe(LISTING_MAX_SKIP);
    expect(listingQueryOf({ skip: 'x' }).skip).toBe(0);
    expect(listingQueryOf({ skip: '48' }).skip).toBe(48);
  });

  it('keeps a known sort and reads an unknown one as newest', () => {
    // Act / Assert
    expect(listingQueryOf({ sort: 'price-asc' }).sort).toBe('price-asc');
    expect(listingQueryOf({ sort: 'price-desc' }).sort).toBe('price-desc');
    expect(listingQueryOf({ sort: 'cheapest' }).sort).toBe('newest');
    expect(listingQueryOf({}).sort).toBe('newest');
  });
});
