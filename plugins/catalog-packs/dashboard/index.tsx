import { CATALOG_EDITOR_BLOCK_IDS, CATALOG_PRODUCT_EDITOR_PAGE_ID } from '@cod/shared';
import { defineDashboardExtension } from '@vendure/dashboard';
import { PackBlock, PackBlockTitle } from './components/pack-block';
import { PACK_BLOCK_ID } from './constants';

// The pack block sits after catalog's pricing card on the product editor (D2105); it reaches catalog only through the
// shared page and block ids, never catalog's dashboard files.
defineDashboardExtension({
  pageBlocks: [
    {
      id: PACK_BLOCK_ID,
      title: <PackBlockTitle />,
      location: {
        pageId: CATALOG_PRODUCT_EDITOR_PAGE_ID,
        column: 'main',
        position: { blockId: CATALOG_EDITOR_BLOCK_IDS.pricing, order: 'after' },
      },
      component: PackBlock,
    },
  ],
});
