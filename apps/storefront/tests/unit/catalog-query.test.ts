import { describe, expect, it } from 'vitest';
import { listingApiQuery, listingQueryOf, MAX_LISTING_PAGE, searchQueryOf } from '../../src/catalog/listing-query';
import { isStorefrontSlug } from '../../src/catalog/slug';

describe('storefront slugs', () => {
  it.each(['kettle', 'a', 'wool-scarf-2', '9lives', 'a'.repeat(128)])('accepts %j', (slug) => {
    expect(isStorefrontSlug(slug)).toBe(true);
  });

  it.each(['', '-a', 'A', 'a.b', 'a/b', '../x', 'a%2Fb', 'a b', 'a'.repeat(129), 'ك'])('refuses %j', (slug) => {
    expect(isStorefrontSlug(slug)).toBe(false);
  });
});

describe('listing query', () => {
  it('reads a valid page and sort', () => {
    expect(listingQueryOf({ page: '3', sort: 'price-asc' })).toEqual({ page: 3, sort: 'price-asc' });
  });

  it.each([
    [{}, { page: 1, sort: 'newest' }],
    [
      { page: '0', sort: 'cheapest' },
      { page: 1, sort: 'newest' },
    ],
    [{ page: '-1' }, { page: 1, sort: 'newest' }],
    [{ page: '1e3' }, { page: 1, sort: 'newest' }],
    [{ page: String(MAX_LISTING_PAGE + 1) }, { page: 1, sort: 'newest' }],
    [
      { page: ['2', '9'], sort: ['price-desc', 'newest'] },
      { page: 2, sort: 'price-desc' },
    ],
  ])('bounds %j to %j before it enters a cache key', (raw, expected) => {
    expect(listingQueryOf(raw)).toEqual(expected);
  });

  it('asks the api for the page with the default page size', () => {
    expect(listingApiQuery({ page: 3, sort: 'price-asc' })).toBe('skip=48&take=24&sort=price-asc');
  });

  it('trims the search query and cuts it to the longest one the api reads', () => {
    // Act
    const query = searchQueryOf({ q: `  ${'ب'.repeat(150)}  `, page: '2' });
    // Assert
    expect(query.q).toHaveLength(100);
    expect(query.page).toBe(2);
  });

  it('reads no query as an empty one', () => {
    expect(searchQueryOf({})).toEqual({ q: '', page: 1 });
  });
});
