import { describe, expect, it } from 'vitest';
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITY_TYPES, isAllStoresOnlyActivityAction } from '../src/index';

describe('catalog activity (D2213)', () => {
  it('names the bulk edit, import, link import and export actions', () => {
    expect(Object.values(ACTIVITY_ACTIONS).filter((action) => action.startsWith('catalog.'))).toEqual([
      'catalog.products.bulk-edit',
      'catalog.products.import',
      'catalog.products.link-import',
      'catalog.products.export',
    ]);
  });

  it('writes catalog rows about a product or a catalog job', () => {
    expect(ACTIVITY_ENTITY_TYPES.PRODUCT).toBe('product');
    expect(ACTIVITY_ENTITY_TYPES.CATALOG_JOB).toBe('catalog-job');
  });

  it('shows catalog rows to store-limited viewers too', () => {
    expect(isAllStoresOnlyActivityAction(ACTIVITY_ACTIONS.CATALOG_PRODUCTS_BULK_EDITED)).toBe(false);
  });
});
