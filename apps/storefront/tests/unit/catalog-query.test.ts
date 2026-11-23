import { describe, expect, it } from 'vitest';
import { listingApiQuery, listingQueryOf, MAX_LISTING_PAGE, searchQueryOf } from '../../src/catalog/listing-query';
import { isStorefrontSlug } from '../../src/catalog/slug';

describe('storefront slugs', () => {
  it.each(['kettle', 'a', 'wool-scarf-2', '9lives', 'a'.repeat(255)])('accepts %j', (slug) => {
    expect(isStorefrontSlug(slug)).toBe(true);
  });

  // The catalog keeps the letters of the title in a slug it derives (D2103), so an Arabic store's products have Arabic
  // slugs: the demo seed's "صندل جلدي تجريبي" is served at /product/صندل-جلدي-تجريبي.
  it.each(['صندل-جلدي-تجريبي', 'ك', 'قَمِيص', 'سروال-2', 'été-2026'])('accepts the letters of any language: %j', (slug) => {
    expect(isStorefrontSlug(slug)).toBe(true);
  });

  it.each([
    '',
    '-a',
    'A',
    'Été',
    'a.b',
    'a/b',
    '../x',
    'a%2Fb',
    'a b',
    'a?b',
    'a#b',
    'a'.repeat(256),
    'ك\u200fx',
    'ك\u202ex',
    '\u064ex',
  ])('refuses %j', (slug) => {
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
