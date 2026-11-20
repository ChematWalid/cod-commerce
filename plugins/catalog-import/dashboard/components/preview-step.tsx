import type { StoreScope } from '@cod/plugin-merchant-shell/shell-api';
import type { ImportRowAction } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@vendure/dashboard';
import { type ReactNode, useState } from 'react';
import { IMPORT_PREVIEW_NEXT_TEST_ID, PREVIEW_PAGE_SIZE } from '../constants';
import { rowReasonMessageId, UNKNOWN_REASON_MESSAGE_ID } from '../model/import-errors';
import { type ImportPreviewDto, type ImportPreviewRowDto, useImportPreview } from '../queries';
import { ImportSummaryView } from './import-steps';

const ACTION_LABEL_IDS = {
  create: 'catalog-import.action-create',
  update: 'catalog-import.action-update',
  error: 'catalog-import.action-error',
} as const satisfies Record<ImportRowAction, string>;

const actionLabelId = (action: string): string =>
  action in ACTION_LABEL_IDS ? ACTION_LABEL_IDS[action as ImportRowAction] : UNKNOWN_REASON_MESSAGE_ID;

interface PreviewStepProps {
  readonly scope: StoreScope | null;
  readonly importId: string;
  /** The preview the mapping step answered: its first page and counts. */
  readonly first: ImportPreviewDto;
  readonly onBack: () => void;
  readonly onNext: () => void;
}

/** One planned row: what it does, its key and name as written in the file (plain text), and its reasons. */
function PreviewRow({ row }: { readonly row: ImportPreviewRowDto }): ReactNode {
  const { i18n } = useLingui();
  return (
    <TableRow>
      <TableCell>{row.rowNumber}</TableCell>
      <TableCell>
        <Badge variant={row.action === 'error' ? 'destructive' : 'outline'}>{i18n._(actionLabelId(row.action))}</Badge>
      </TableCell>
      <TableCell>{row.productKey ?? ''}</TableCell>
      <TableCell>{row.name ?? ''}</TableCell>
      <TableCell>
        <ul className="grid gap-0.5 text-xs">
          {row.messages.map((reason) => (
            <li key={reason}>{i18n._(rowReasonMessageId(reason))}</li>
          ))}
        </ul>
      </TableCell>
    </TableRow>
  );
}

/** Previous and next page of the preview. */
function PreviewPager(props: {
  readonly skip: number;
  readonly total: number;
  readonly onSkip: (skip: number) => void;
}): ReactNode {
  const { i18n } = useLingui();
  const last = Math.min(props.skip + PREVIEW_PAGE_SIZE, props.total);
  return (
    <div className="flex items-center gap-2 text-sm">
      <Button
        variant="outline"
        size="sm"
        disabled={props.skip === 0}
        onClick={() => {
          props.onSkip(Math.max(0, props.skip - PREVIEW_PAGE_SIZE));
        }}
      >
        {i18n._('catalog-import.page-previous')}
      </Button>
      <span>{i18n._('catalog-import.page-range', { first: props.skip + 1, last, total: props.total })}</span>
      <Button
        variant="outline"
        size="sm"
        disabled={last >= props.total}
        onClick={() => {
          props.onSkip(props.skip + PREVIEW_PAGE_SIZE);
        }}
      >
        {i18n._('catalog-import.page-next')}
      </Button>
    </div>
  );
}

/** Step 3: the counts and, page by page, what each row of the file would do. Nothing is written yet. */
export function PreviewStep(props: PreviewStepProps): ReactNode {
  const { i18n } = useLingui();
  const [skip, setSkip] = useState(0);
  const page = useImportPreview(props.scope, props.importId, skip);
  const shown = page.data ?? props.first;
  return (
    <div className="grid gap-4">
      <ImportSummaryView summary={shown.summary ?? props.first.summary} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{i18n._('catalog-import.preview-row')}</TableHead>
            <TableHead>{i18n._('catalog-import.preview-action')}</TableHead>
            <TableHead>{i18n._('catalog-import.field-product-key')}</TableHead>
            <TableHead>{i18n._('catalog-import.field-name')}</TableHead>
            <TableHead>{i18n._('catalog-import.preview-messages')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.items.map((row) => (
            <PreviewRow key={row.rowNumber} row={row} />
          ))}
        </TableBody>
      </Table>
      {shown.totalItems > PREVIEW_PAGE_SIZE && <PreviewPager skip={skip} total={shown.totalItems} onSkip={setSkip} />}
      <div className="flex gap-2">
        <Button variant="outline" onClick={props.onBack}>
          {i18n._('catalog-import.back')}
        </Button>
        <Button data-testid={IMPORT_PREVIEW_NEXT_TEST_ID} onClick={props.onNext}>
          {i18n._('catalog-import.preview-next')}
        </Button>
      </div>
    </div>
  );
}
