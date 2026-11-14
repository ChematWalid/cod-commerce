import { describe, expect, it } from 'vitest';
import { CATALOG_MAX_PAGE_SIZE, CATALOG_PAGE_SIZE, productListQuerySchema } from '../../src/index';

describe('productListQuerySchema', () => {
  it('defaults to the all tab, first page of twenty', () => {
    expect(productListQuerySchema.parse({})).toEqual({ tab: 'all', skip: 0, take: CATALOG_PAGE_SIZE });
  });

  it('reads a REST query string and drops a blank search', () => {
    const parsed = productListQuerySchema.parse({ tab: 'draft', q: '   ', skip: '20', take: '50', brandId: '' });

    expect(parsed).toEqual({ tab: 'draft', skip: 20, take: 50 });
  });

  it('keeps the filters and a trimmed search', () => {
    const parsed = productListQuerySchema.parse({ q: ' shoe ', collectionId: '3', brandId: '1', tagId: '2' });

    expect(parsed).toMatchObject({ q: 'shoe', collectionId: '3', brandId: '1', tagId: '2' });
  });

  it('refuses a page larger than the cap, a negative skip and an unknown tab', () => {
    expect(productListQuerySchema.safeParse({ take: CATALOG_MAX_PAGE_SIZE }).success).toBe(true);
    expect(productListQuerySchema.safeParse({ take: CATALOG_MAX_PAGE_SIZE + 1 }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ skip: -1 }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ tab: 'hidden' }).success).toBe(false);
  });

  it.each([
    ['a NUL', String.fromCodePoint(0)],
    ['a bidi override', String.fromCodePoint(0x202e)],
  ])('refuses %s in the product search', (_name, character) => {
    expect(productListQuerySchema.safeParse({ q: `a${character}b` }).success).toBe(false);
  });

  it('takes a null field from an unset GraphQL variable as not asked', () => {
    expect(productListQuerySchema.parse({ q: null, take: null })).toEqual({ tab: 'all', skip: 0, take: 20 });
  });
});
