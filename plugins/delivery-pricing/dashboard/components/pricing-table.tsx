import { useLingui } from '@lingui/react';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useLocalFormat,
} from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { PRICING_ROW_TEST_ID } from '../constants';
import type { FeeGroupSummaryDto } from '../dto';
import { carrierLabelIdOf, type PricingRowAction, ROW_ACTION_LABEL_IDS, rowActionsOf } from '../model/list-view';

/** Hidden on a phone, so the name and the actions fit without a sideways scroll. */
const WIDE_ONLY = 'hidden md:table-cell';

type OnAction = (action: PricingRowAction, group: FeeGroupSummaryDto) => void;

interface PricingTableProps {
  readonly groups: readonly FeeGroupSummaryDto[];
  readonly held: ReadonlySet<string>;
  readonly onAction: OnAction;
}

function RowActions({ group, held, onAction }: Omit<PricingTableProps, 'groups'> & { group: FeeGroupSummaryDto }) {
  const { i18n } = useLingui();
  const actions = rowActionsOf(held);
  if (actions.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button size="icon" variant="ghost" aria-label={i18n._('delivery-pricing.row-actions')} />}
      >
        ⋮
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action}
            variant={action === 'delete' ? 'destructive' : 'default'}
            onClick={() => {
              onAction(action, group);
            }}
          >
            {i18n._(ROW_ACTION_LABEL_IDS[action])}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HeaderRow(): ReactNode {
  const { i18n } = useLingui();
  return (
    <TableRow>
      <TableHead className="text-start">{i18n._('delivery-pricing.column-name')}</TableHead>
      <TableHead className={`${WIDE_ONLY} text-start`}>{i18n._('delivery-pricing.column-carrier')}</TableHead>
      <TableHead className={`${WIDE_ONLY} text-start`}>{i18n._('delivery-pricing.column-created')}</TableHead>
      <TableHead className="text-end">
        <span className="sr-only">{i18n._('delivery-pricing.row-actions')}</span>
      </TableHead>
    </TableRow>
  );
}

function GroupRow({ group, ...props }: Omit<PricingTableProps, 'groups'> & { group: FeeGroupSummaryDto }) {
  const { i18n } = useLingui();
  const { formatDate } = useLocalFormat();
  return (
    <TableRow data-testid={PRICING_ROW_TEST_ID} data-group-id={group.id}>
      <TableCell className="font-medium whitespace-normal [overflow-wrap:anywhere]">
        <span className="flex flex-wrap items-center gap-2">
          {group.name}
          {group.isPlatformDefault && <Badge variant="outline">{i18n._('delivery-pricing.platform-badge')}</Badge>}
        </span>
      </TableCell>
      <TableCell className={WIDE_ONLY}>{i18n._(carrierLabelIdOf(group.carrierId))}</TableCell>
      <TableCell className={WIDE_ONLY}>{formatDate(group.createdAt, { dateStyle: 'medium' })}</TableCell>
      <TableCell className="text-end">
        <RowActions group={group} {...props} />
      </TableCell>
    </TableRow>
  );
}

/** The pricing options of the page: name, delivery agent, created and the row's actions (as captured). */
export function PricingTable({ groups, ...props }: PricingTableProps): ReactNode {
  return (
    <Table>
      <TableHeader>
        <HeaderRow />
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <GroupRow key={group.id} group={group} {...props} />
        ))}
      </TableBody>
    </Table>
  );
}
