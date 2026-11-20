import type { OfferStatus } from '@cod/shared';
import { useLingui } from '@lingui/react';
import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useLocalFormat,
} from '@vendure/dashboard';
import type { ComponentProps, ReactNode } from 'react';
import { EMPTY_VALUE, OFFER_ROW_TEST_ID } from '../constants';
import type { OfferRowDto } from '../dto';
import { kindLabelIdOf } from '../model/app-type-cards';
import { methodCellOf, type OfferRowAction, performanceCellsOf, STATUS_LABEL_IDS } from '../model/list-view';
import { RowActions } from './row-actions';

/** Hidden on a phone, so the offer, its status and the actions fit without a sideways scroll. */
const WIDE_ONLY = 'hidden md:table-cell';
/** Hidden below a wide screen: the performance columns come last. */
const LARGE_ONLY = 'hidden lg:table-cell';

const BADGE_OF_STATUS: Readonly<Record<OfferStatus, ComponentProps<typeof Badge>['variant']>> = {
  active: 'success',
  paused: 'warning',
  draft: 'outline',
  archived: 'default',
};

interface OfferTableProps {
  readonly offers: readonly OfferRowDto[];
  readonly held: ReadonlySet<string>;
  readonly onAction: (action: OfferRowAction, offer: OfferRowDto) => void;
}

/** The two-letter language of the display locale, which decides how amounts are grouped. */
function useLanguage(): string {
  const { i18n } = useLingui();
  return i18n.locale.split(/[-_]/)[0] ?? i18n.locale;
}

function MethodCell({ offer }: { readonly offer: OfferRowDto }): ReactNode {
  const { i18n } = useLingui();
  const cell = methodCellOf(offer);
  return (
    <span className="flex flex-wrap items-center gap-1">
      {i18n._(cell.labelId)}
      {cell.codeCount === null ? null : (
        <span className="text-muted-foreground text-xs">{i18n._('offers.code-count', { count: cell.codeCount })}</span>
      )}
    </span>
  );
}

function DatesCell({ offer }: { readonly offer: OfferRowDto }): ReactNode {
  const { i18n } = useLingui();
  const { formatDate } = useLocalFormat();
  if (offer.startsAt === null && offer.endsAt === null) return i18n._('offers.dates-always');
  const start = offer.startsAt === null ? EMPTY_VALUE : formatDate(offer.startsAt, { dateStyle: 'medium' });
  const end = offer.endsAt === null ? i18n._('offers.dates-no-end') : formatDate(offer.endsAt, { dateStyle: 'medium' });
  return <span className="whitespace-nowrap">{`${start} – ${end}`}</span>;
}

function HeaderRow(): ReactNode {
  const { i18n } = useLingui();
  const head = (id: string, className: string): ReactNode => (
    <TableHead className={`${className} text-start`}>{i18n._(id)}</TableHead>
  );
  return (
    <TableRow>
      {head('offers.column-title', '')}
      {head('offers.column-kind', WIDE_ONLY)}
      {head('offers.column-method', WIDE_ONLY)}
      {head('offers.column-status', '')}
      {head('offers.column-dates', WIDE_ONLY)}
      {head('offers.column-orders', LARGE_ONLY)}
      {head('offers.column-delivered-revenue', LARGE_ONLY)}
      {head('offers.column-discount-given', LARGE_ONLY)}
      <TableHead className="text-end">
        <span className="sr-only">{i18n._('offers.row-actions')}</span>
      </TableHead>
    </TableRow>
  );
}

function OfferRow({ offer, held, onAction }: Omit<OfferTableProps, 'offers'> & { readonly offer: OfferRowDto }) {
  const { i18n } = useLingui();
  const cells = performanceCellsOf(offer.performance, useLanguage());
  const currency = i18n._('offers.currency');
  return (
    <TableRow data-testid={OFFER_ROW_TEST_ID} data-offer-id={offer.id}>
      <TableCell className="font-medium whitespace-normal [overflow-wrap:anywhere]">{offer.title}</TableCell>
      <TableCell className={WIDE_ONLY}>{i18n._(kindLabelIdOf(offer.kind))}</TableCell>
      <TableCell className={WIDE_ONLY}>
        <MethodCell offer={offer} />
      </TableCell>
      <TableCell>
        <Badge variant={BADGE_OF_STATUS[offer.status]}>{i18n._(STATUS_LABEL_IDS[offer.status])}</Badge>
      </TableCell>
      <TableCell className={WIDE_ONLY}>
        <DatesCell offer={offer} />
      </TableCell>
      <TableCell className={LARGE_ONLY}>
        <span dir="ltr">{cells.orders}</span>
      </TableCell>
      <TableCell className={LARGE_ONLY}>
        <span dir="ltr">{`${cells.deliveredRevenue} ${currency}`}</span>
      </TableCell>
      <TableCell className={LARGE_ONLY}>
        <span dir="ltr">{`${cells.discountGiven} ${currency}`}</span>
      </TableCell>
      <TableCell className="text-end">
        <RowActions offer={offer} held={held} onAction={onAction} />
      </TableCell>
    </TableRow>
  );
}

/** The offers of the page: title, kind, method, status, dates, performance and the row's actions. */
export function OfferTable({ offers, ...props }: OfferTableProps): ReactNode {
  return (
    <Table>
      <TableHeader>
        <HeaderRow />
      </TableHeader>
      <TableBody>
        {offers.map((offer) => (
          <OfferRow key={offer.id} offer={offer} {...props} />
        ))}
      </TableBody>
    </Table>
  );
}
