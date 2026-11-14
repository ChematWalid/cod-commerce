/**
 * Page and block ids of the catalog dashboard pages. Later sessions add blocks and action-bar items to the editor by
 * these strings through stock `pageBlocks` / `actionBarItems` (D2105), never by importing the catalog dashboard.
 * The values are pinned by a test: renaming one breaks those blocks silently.
 */
export const CATALOG_PRODUCT_LIST_PAGE_ID = 'catalog-product-list';
export const CATALOG_PRODUCT_EDITOR_PAGE_ID = 'catalog-product-editor';

/** Block ids of the product editor, one per card. */
export const CATALOG_EDITOR_BLOCK_IDS = {
  details: 'catalog-editor-details',
  media: 'catalog-editor-media',
  pricing: 'catalog-editor-pricing',
  options: 'catalog-editor-options',
  variants: 'catalog-editor-variants',
  organisation: 'catalog-editor-organisation',
  highlights: 'catalog-editor-highlights',
  settings: 'catalog-editor-settings',
  seo: 'catalog-editor-seo',
} as const;

/** One of the {@link CATALOG_EDITOR_BLOCK_IDS} values. */
export type CatalogEditorBlockId = (typeof CATALOG_EDITOR_BLOCK_IDS)[keyof typeof CATALOG_EDITOR_BLOCK_IDS];
