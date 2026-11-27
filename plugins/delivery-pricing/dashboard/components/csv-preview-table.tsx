import type { DeliveryFeeCsvChange } from '@cod/shared';
import { useLingui } from '@lingui/react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@vendure/dashboard';
import type { ReactNode } from 'react';
import { CSV_ISSUES_TEST_ID, CSV_PREVIEW_TEST_ID, EMPTY_VALUE } from '../constants';
import type { CsvImportDto } from '../dto';
import { csvCellsOf, csvIssueMessageIdOf, shownChangesOf } from '../model/csv-preview';
import { wilayaNameOf } from '../model/place-names';
import { LtrRun } from './ltr-run';

const HEAD_IDS = [
  'delivery-pricing.column-wilaya',
  'delivery-pricing.csv-column-commune',
  'delivery-pricing.column-home',
  'delivery-pricing.column-desk',
  'delivery-pricing.column-delivery',
  'delivery-pricing.column-desk-switch',
] as const;

function ChangeRow({ change }: { readonly change: DeliveryFeeCsvChange }): ReactNode {
  const { i18n } = useLingui();
  const cells = csvCellsOf(change, (id) => i18n._(id));
  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <LtrRun>{change.provinceCode}</LtrRun> {wilayaNameOf(change.provinceCode, i18n.locale)}
      </TableCell>
      <TableCell>
        <LtrRun>{change.codeOns === null ? EMPTY_VALUE : String(change.codeOns)}</LtrRun>
      </TableCell>
      {[cells.home, cells.desk, cells.delivery, cells.deskSwitch].map((text, index) => (
        <TableCell key={HEAD_IDS[index + 2]}>
          <LtrRun>{text}</LtrRun>
        </TableCell>
      ))}
    </TableRow>
  );
}

/** The rows the file changes, `before → after`; scrolls inside its box, never the page. */
function ChangesTable({ changes }: { readonly changes: readonly DeliveryFeeCsvChange[] }): ReactNode {
  const { i18n } = useLingui();
  const { rows, hidden } = shownChangesOf(changes);
  return (
    <div data-testid={CSV_PREVIEW_TEST_ID} className="grid gap-2">
      <div className="max-h-80 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {HEAD_IDS.map((id) => (
                <TableHead key={id} className="text-start">
                  {i18n._(id)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((change) => (
              <ChangeRow key={`${change.provinceCode}-${String(change.codeOns)}`} change={change} />
            ))}
          </TableBody>
        </Table>
      </div>
      {hidden > 0 && (
        <p className="text-muted-foreground text-xs">{i18n._('delivery-pricing.csv-more', { count: hidden })}</p>
      )}
    </div>
  );
}

/** The refused rows: row number, column and reason, never the cell's value. */
function IssuesList({ result }: { readonly result: CsvImportDto }): ReactNode {
  const { i18n } = useLingui();
  return (
    <div data-testid={CSV_ISSUES_TEST_ID} role="alert" className="grid gap-1 text-sm">
      <p className="text-destructive font-medium">
        {i18n._('delivery-pricing.csv-issues', { count: result.totalIssues })}
      </p>
      <ul className="max-h-40 list-disc overflow-auto ps-5">
        {result.issues.map((issue) => (
          <li key={`${String(issue.row)}-${issue.column ?? ''}`}>
            {i18n._('delivery-pricing.csv-issue-row', { row: issue.row, column: issue.column ?? EMPTY_VALUE })}{' '}
            {i18n._(csvIssueMessageIdOf(issue.issue))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A preview of the import (D3142): the refused rows first, then what would change, or that nothing would. */
export function CsvPreview({ result }: { readonly result: CsvImportDto }): ReactNode {
  const { i18n } = useLingui();
  return (
    <div className="grid gap-3">
      <p className="text-sm">
        {i18n._('delivery-pricing.csv-summary', { rows: result.rows, changes: result.changes.length })}
      </p>
      {result.totalIssues > 0 && <IssuesList result={result} />}
      {result.changes.length > 0 ? (
        <ChangesTable changes={result.changes} />
      ) : (
        <p className="text-muted-foreground text-sm">{i18n._('delivery-pricing.csv-no-change')}</p>
      )}
    </div>
  );
}
