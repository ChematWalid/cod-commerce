import { describe, expect, it } from 'vitest';
import {
  STOREFRONT_CACHE_TAG_PATTERN,
  collectionTag,
  offersTag,
  productTag,
  storeCacheTag,
  storeTag,
  themeTag,
} from '../../src/storefront/cache-tags';
import { STOREFRONT_API_ROUTES, storefrontApiPath, tenantRoutePath } from '../../src/storefront/routes';

describe('storefront cache tags', () => {
  it('names each tag kind with its own prefix', () => {
    expect([storeTag('1'), productTag('2'), collectionTag('3'), themeTag('4'), offersTag('5')]).toEqual([
      'store:1',
      'product:2',
      'collection:3',
      'theme:4',
      'offers:5',
    ]);
  });

  it('keeps storeCacheTag as the same tag as storeTag', () => {
    expect(storeCacheTag('7300000000000000001')).toBe(storeTag('7300000000000000001'));
  });

  it('matches every tag it builds for a snowflake id', () => {
    const tags = [storeTag, productTag, collectionTag, themeTag, offersTag].map((tag) => tag('7300000000000000001'));
    expect(tags.every((tag) => STOREFRONT_CACHE_TAG_PATTERN.test(tag))).toBe(true);
  });

  it.each(['store:0', 'store:01', 'page:1', 'store:1:x', 'STORE:1', ' store:1'])('refuses the tag %j', (tag) => {
    expect(STOREFRONT_CACHE_TAG_PATTERN.test(tag)).toBe(false);
  });
});

describe('storefront routes', () => {
  it('puts the locale first, then the store and its host binding (D3202)', () => {
    // Act
    const path = tenantRoutePath({ locale: 'ar', storeId: '7300000000000000001', binding: 'abc' }, '/product/kaftan');
    // Assert
    expect(path).toBe('/_t/ar/7300000000000000001/abc/product/kaftan');
  });

  it('maps the home page to the tenant root without a trailing slash', () => {
    expect(tenantRoutePath({ locale: 'fr', storeId: '1', binding: 'b' }, '/')).toBe('/_t/fr/1/b');
  });

  it('encodes a slug so it can never add a path segment', () => {
    expect(storefrontApiPath('product', '../shop-api')).toBe('/store/product/..%2Fshop-api');
  });

  it('declares the search route apart from the product slug route', () => {
    expect(STOREFRONT_API_ROUTES.productSearch).toBe('/store/product/search');
    expect(STOREFRONT_API_ROUTES.product).toBe('/store/product');
  });
});
