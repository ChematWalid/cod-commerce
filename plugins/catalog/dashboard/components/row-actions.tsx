import { useLingui } from '@lingui/react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import type { CatalogProductRowDto } from '../dto';
import { ROW_ACTION_LABEL_IDS, type ProductRowAction, rowActionsOf } from '../model/list-view';

/** What a row asks the page for; Preview has no handler until the storefront exists (P3.S2). */
export type RowCommand = Exclude<ProductRowAction, 'preview'>;

interface RowActionsProps {
  readonly product: CatalogProductRowDto;
  readonly held: ReadonlySet<string>;
  readonly onCommand: (command: RowCommand, product: CatalogProductRowDto) => void;
}

/** The row's menu: Edit, Set draft, Preview (disabled, with its reason) and Delete, as the caller may. */
export function RowActions({ product, held, onCommand }: RowActionsProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon" variant="ghost" aria-label={i18n._('catalog.row-actions')} />}>
        ⋮
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {rowActionsOf(product, held).map((action) =>
          action === 'preview' ? (
            <DropdownMenuItem key={action} disabled title={i18n._('catalog.preview-hint')}>
              {i18n._(ROW_ACTION_LABEL_IDS[action])}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key={action}
              variant={action === 'delete' ? 'destructive' : 'default'}
              onClick={() => {
                onCommand(action, product);
              }}
            >
              {i18n._(ROW_ACTION_LABEL_IDS[action])}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
