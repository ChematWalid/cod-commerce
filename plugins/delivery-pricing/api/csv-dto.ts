import {
  type DeliveryFeeCsvChange,
  type DeliveryFeeCsvIssue,
  type DeliveryFeeGroup,
  PRICING_CSV_MAX_REPORTED_ISSUES,
} from '@cod/shared';
import type { PricingCsvFile } from '../application/pricing-csv-export.service';
import type { PricingCsvImportReport } from '../application/pricing-csv-import.service';
import { toGroupDto } from './dto';

/** A pricing option's CSV as GraphQL answers it (`DeliveryFeeGroupCsv`): the file name and its text, BOM included. */
export interface DeliveryFeeGroupCsvDto {
  readonly fileName: string;
  readonly content: string;
}

/** What an import did or would do (`DeliveryFeeCsvImportResult`), its issues capped, their count whole (D3142). */
export interface DeliveryFeeCsvImportDto {
  readonly dryRun: boolean;
  readonly applied: boolean;
  readonly rows: number;
  readonly changes: readonly DeliveryFeeCsvChange[];
  readonly issues: readonly DeliveryFeeCsvIssue[];
  readonly totalIssues: number;
  readonly group: DeliveryFeeGroup | null;
}

/** Keeps the byte order mark in the text, so a client saving it writes the same bytes as the REST download. */
const csvText = new TextDecoder('utf-8', { ignoreBOM: true });

export const toCsvFileDto = (file: PricingCsvFile): DeliveryFeeGroupCsvDto => ({
  fileName: file.fileName,
  content: csvText.decode(file.bytes),
});

export const toCsvImportDto = (report: PricingCsvImportReport): DeliveryFeeCsvImportDto => ({
  dryRun: report.dryRun,
  applied: report.applied,
  rows: report.rows,
  changes: report.changes,
  issues: report.issues.slice(0, PRICING_CSV_MAX_REPORTED_ISSUES),
  totalIssues: report.issues.length,
  group: report.group === null ? null : toGroupDto(report.group),
});
