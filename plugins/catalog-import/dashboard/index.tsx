import { storePathFor } from '@cod/plugin-merchant-shell/shell-api';
import { CATALOG_PRODUCT_LIST_BLOCK_ID, CATALOG_PRODUCT_LIST_PAGE_ID } from '@cod/shared';
import { defineDashboardExtension } from '@vendure/dashboard';
import { BulkEditMenuItem, ExportMenuItem, ImportMenuItem, ListDialogsHost } from './components/list-actions';
import {
  BULK_EDIT_ACTION_ID,
  EXPORT_ACTION_ID,
  IMPORT_ACTION_ID,
  IMPORT_PATH,
  LIST_DIALOGS_BLOCK_ID,
} from './constants';
import { ImportPage } from './routes/import-page';

/** The router's name for the URL's store. */
const STORE_ID_PARAM = '$storeId';

// The wizard is a store-scoped page outside the sidebar (D2110). The list's menu items reach catalog only through the
// shared page and block ids and the page's entity (D2201); each item is gated by its own key in-component. Dropdown
// items stay reachable on phones; the dialogs they open are drawn by an untitled block of the list (D2277).
defineDashboardExtension({
  routes: [{ path: storePathFor(IMPORT_PATH, STORE_ID_PARAM), component: () => <ImportPage /> }],
  actionBarItems: [
    { id: IMPORT_ACTION_ID, pageId: CATALOG_PRODUCT_LIST_PAGE_ID, type: 'dropdown', component: ImportMenuItem },
    { id: EXPORT_ACTION_ID, pageId: CATALOG_PRODUCT_LIST_PAGE_ID, type: 'dropdown', component: ExportMenuItem },
    { id: BULK_EDIT_ACTION_ID, pageId: CATALOG_PRODUCT_LIST_PAGE_ID, type: 'dropdown', component: BulkEditMenuItem },
  ],
  pageBlocks: [
    {
      id: LIST_DIALOGS_BLOCK_ID,
      location: {
        pageId: CATALOG_PRODUCT_LIST_PAGE_ID,
        column: 'full',
        position: { blockId: CATALOG_PRODUCT_LIST_BLOCK_ID, order: 'after' },
      },
      component: ListDialogsHost,
    },
  ],
});
