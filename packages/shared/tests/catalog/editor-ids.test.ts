import { describe, expect, it } from 'vitest';
import {
  CATALOG_EDITOR_BLOCK_IDS,
  CATALOG_PRODUCT_EDITOR_PAGE_ID,
  CATALOG_PRODUCT_LIST_PAGE_ID,
  DOMAIN_EVENT_NAMES,
  isOutboxTopic,
  PRODUCT_CHANGE_KINDS,
} from '../../src/index';

describe('catalog editor ids', () => {
  it('keeps the editor page and block ids stable', () => {
    // Later sessions plug blocks into the editor by these strings (D2105): renaming one breaks them silently.
    expect({
      list: CATALOG_PRODUCT_LIST_PAGE_ID,
      editor: CATALOG_PRODUCT_EDITOR_PAGE_ID,
      blocks: CATALOG_EDITOR_BLOCK_IDS,
    }).toEqual({
      list: 'catalog-product-list',
      editor: 'catalog-product-editor',
      blocks: {
        details: 'catalog-editor-details',
        media: 'catalog-editor-media',
        pricing: 'catalog-editor-pricing',
        options: 'catalog-editor-options',
        variants: 'catalog-editor-variants',
        organisation: 'catalog-editor-organisation',
        highlights: 'catalog-editor-highlights',
        settings: 'catalog-editor-settings',
        seo: 'catalog-editor-seo',
      },
    });
  });
});

describe('product.changed event', () => {
  it('lists product.changed in DOMAIN_EVENT_NAMES', () => {
    expect(DOMAIN_EVENT_NAMES.ProductChanged).toBe('product.changed');
  });

  it('is a known outbox topic', () => {
    expect(isOutboxTopic(DOMAIN_EVENT_NAMES.ProductChanged)).toBe(true);
  });

  it('names the four kinds of change', () => {
    expect(PRODUCT_CHANGE_KINDS).toEqual(['created', 'updated', 'status', 'deleted']);
  });
});
