import {
  ACTIVE_STORE_ALIAS,
  storePathFor,
  useActiveStore,
  useHeldPermissions,
} from '@cod/plugin-merchant-shell/shell-api';
import { useLingui } from '@lingui/react';
import { Link } from '@tanstack/react-router';
import { DropdownMenuItem, type PageContextValue } from '@vendure/dashboard';
import { type ReactNode, useEffect } from 'react';
import {
  BULK_EDIT_ACTION_TEST_ID,
  CREATE_PRODUCTS_KEY,
  EDIT_PRODUCTS_KEY,
  EXPORT_ACTION_TEST_ID,
  IMPORT_ACTION_TEST_ID,
  IMPORT_PATH,
  VIEW_PRODUCTS_KEY,
} from '../constants';
import { useActiveScope, useListDialog } from '../hooks/use-catalog-import';
import { listDialogs, listEntityOf } from '../model/list-dialogs';
import { BulkEditDialog } from './bulk-edit-dialog';
import { ExportDialog } from './export-dialog';

/** What a stock action-bar item or page block gets. */
interface ContextProps {
  readonly context: PageContextValue;
}

/** Whether the caller holds `key` on the active store (gated in-component: stock gating reads Vendure permissions). */
function useHolds(key: string): boolean {
  return useHeldPermissions(useActiveScope()).has(key);
}

/** "Import products": opens the import wizard of the active store, for holders of the create key. */
export function ImportMenuItem(): ReactNode {
  const { i18n } = useLingui();
  const store = useActiveStore();
  if (!useHolds(CREATE_PRODUCTS_KEY)) return null;
  return (
    <DropdownMenuItem
      data-testid={IMPORT_ACTION_TEST_ID}
      render={<Link to={storePathFor(IMPORT_PATH, store?.id ?? ACTIVE_STORE_ALIAS)} />}
    >
      {i18n._('catalog-import.action-import')}
    </DropdownMenuItem>
  );
}

/** "Export": opens the export dialog, for holders of the view key. */
export function ExportMenuItem(): ReactNode {
  const { i18n } = useLingui();
  if (!useHolds(VIEW_PRODUCTS_KEY)) return null;
  return (
    <DropdownMenuItem
      data-testid={EXPORT_ACTION_TEST_ID}
      onClick={() => {
        listDialogs.open('export');
      }}
    >
      {i18n._('catalog-import.action-export')}
    </DropdownMenuItem>
  );
}

/** "Bulk edit": opens the bulk edit dialog on the ticked products; disabled while none is ticked. */
export function BulkEditMenuItem({ context }: ContextProps): ReactNode {
  const { i18n } = useLingui();
  const selected = listEntityOf(context.entity)?.selectedIds.length ?? 0;
  if (!useHolds(EDIT_PRODUCTS_KEY)) return null;
  return (
    <DropdownMenuItem
      data-testid={BULK_EDIT_ACTION_TEST_ID}
      disabled={selected === 0}
      onClick={() => {
        listDialogs.open('bulk-edit');
      }}
    >
      {i18n._('catalog-import.action-bulk-edit', { count: selected })}
    </DropdownMenuItem>
  );
}

/**
 * Draws the list dialog the menu opened (D2277), on the list's current query and ticked products. An untitled
 * full-width block of the list page renders nothing else.
 */
export function ListDialogsHost({ context }: ContextProps): ReactNode {
  const open = useListDialog();
  const scope = useActiveScope();
  const entity = listEntityOf(context.entity);
  // Leaving the list closes its dialog, so coming back does not reopen it.
  useEffect(() => listDialogs.close, []);
  if (open === null || entity === undefined) return null;
  const close = (): void => {
    listDialogs.close();
  };
  if (open === 'export') return <ExportDialog scope={scope} entity={entity} onClose={close} />;
  return <BulkEditDialog scope={scope} productIds={entity.selectedIds} onClose={close} />;
}
