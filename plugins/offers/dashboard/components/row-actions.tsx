import { useLingui } from '@lingui/react';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import type { OfferRowDto } from '../dto';
import { type OfferRowAction, ROW_ACTION_LABEL_IDS, rowActionsOf } from '../model/list-view';

interface RowActionsProps {
  readonly offer: OfferRowDto;
  readonly held: ReadonlySet<string>;
  readonly onAction: (action: OfferRowAction, offer: OfferRowDto) => void;
}

const DESTRUCTIVE_ACTIONS: ReadonlySet<OfferRowAction> = new Set(['archive', 'delete']);

/** The row's menu: Edit, Duplicate, Pause or Resume, Archive and Delete (drafts only), as the caller may. */
export function RowActions({ offer, held, onAction }: RowActionsProps): ReactNode {
  const { i18n } = useLingui();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="icon" variant="ghost" aria-label={i18n._('offers.row-actions')} />}>
        ⋮
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {rowActionsOf(offer, held).map((action) => (
          <DropdownMenuItem
            key={action}
            variant={DESTRUCTIVE_ACTIONS.has(action) ? 'destructive' : 'default'}
            onClick={() => {
              onAction(action, offer);
            }}
          >
            {i18n._(ROW_ACTION_LABEL_IDS[action])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
