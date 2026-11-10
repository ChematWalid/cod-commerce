import { describe, expect, it } from 'vitest';
import {
  ACTIVE_STORE_ALIAS,
  resolveStoreParam,
  rewriteToActiveStore,
  storePathFor,
} from '../dashboard/model/store-path';
import type { SwitchableStoreView } from '../dashboard/model/types';

const store = (id: string): SwitchableStoreView => ({
  id,
  businessId: '1',
  channelId: `c${id}`,
  name: `Store ${id}`,
  subdomain: `s${id}`,
  language: 'ar',
});

const OWN_STORES = [store('10'), store('20')];

describe('storePathFor', () => {
  it('puts a store-scoped path below the store alias', () => {
    expect(storePathFor('products', ACTIVE_STORE_ALIAS)).toBe('/stores/active/products');
    expect(storePathFor('settings/pixels', '123')).toBe('/stores/123/settings/pixels');
  });
});

describe('rewriteToActiveStore', () => {
  it('replaces the store id of a store URL by the alias', () => {
    expect(rewriteToActiveStore('/stores/123/products')).toBe('/stores/active/products');
    expect(rewriteToActiveStore('/stores/123/settings/pixels')).toBe('/stores/active/settings/pixels');
    expect(rewriteToActiveStore('/stores/123')).toBe('/stores/active');
  });

  it('returns null for a path outside /stores', () => {
    expect(rewriteToActiveStore('/home')).toBeNull();
    expect(rewriteToActiveStore('/cod-orders')).toBeNull();
    expect(rewriteToActiveStore('/storesx/1/products')).toBeNull();
    expect(rewriteToActiveStore('/stores')).toBeNull();
  });
});

describe('resolveStoreParam', () => {
  it('treats the alias as the current store', () => {
    expect(resolveStoreParam('active', '10', OWN_STORES)).toEqual({ kind: 'current', id: '10' });
  });

  it('treats the active store id as the current store', () => {
    expect(resolveStoreParam('10', '10', OWN_STORES)).toEqual({ kind: 'current', id: '10' });
  });

  it('switches to another store the caller can reach', () => {
    expect(resolveStoreParam('20', '10', OWN_STORES)).toEqual({ kind: 'switch', id: '20' });
  });

  it('shows not found for an id outside the list: another business, or an archived store', () => {
    expect(resolveStoreParam('999', '10', OWN_STORES)).toEqual({ kind: 'not-found' });
    expect(resolveStoreParam('999', '10', [])).toEqual({ kind: 'not-found' });
  });

  it('does not treat the alias as a store when the list is empty', () => {
    expect(resolveStoreParam('active', undefined, [])).toEqual({ kind: 'current' });
  });
});
