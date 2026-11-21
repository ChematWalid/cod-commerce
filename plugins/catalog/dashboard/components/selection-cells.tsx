import { useLingui } from '@lingui/react';
import { Checkbox, TableCell, TableHead } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { PRODUCT_SELECT_PAGE_TEST_ID, PRODUCT_SELECT_TEST_ID } from '../constants';
import type { PageSelectionState } from '../model/list-selection';

/** What the table needs to tick products (D2201): the ticked ids and how to change them. */
export interface TableSelection {
  readonly selectedIds: ReadonlySet<string>;
  readonly pageState: PageSelectionState;
  readonly onToggle: (productId: string, on: boolean) => void;
  readonly onTogglePage: (on: boolean) => void;
}

/** The header checkbox: ticks or unticks every product of the page shown. */
export function SelectPageHead({ selection }: { readonly selection: TableSelection }): ReactNode {
  const { i18n } = useLingui();
  return (
    <TableHead className="w-8">
      <Checkbox
        data-testid={PRODUCT_SELECT_PAGE_TEST_ID}
        aria-label={i18n._('catalog.select-page')}
        checked={selection.pageState === 'all'}
        indeterminate={selection.pageState === 'some'}
        onCheckedChange={(on) => {
          selection.onTogglePage(on);
        }}
      />
    </TableHead>
  );
}

/** The checkbox of one row. */
export function SelectRowCell(props: {
  readonly productId: string;
  readonly title: string;
  readonly selection: TableSelection;
}): ReactNode {
  const { i18n } = useLingui();
  const { selection, productId } = props;
  return (
    <TableCell className="w-8">
      <Checkbox
        data-testid={PRODUCT_SELECT_TEST_ID}
        aria-label={`${i18n._('catalog.select-product')}: ${props.title}`}
        checked={selection.selectedIds.has(productId)}
        onCheckedChange={(on) => {
          selection.onToggle(productId, on);
        }}
      />
    </TableCell>
  );
}
