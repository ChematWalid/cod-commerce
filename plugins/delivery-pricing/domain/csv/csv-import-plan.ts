import type { DeliveryFeeCsvChange, DeliveryFeeCsvIssue, WilayaCode } from '@cod/shared';
import { sameCommuneRow } from '../commune-rows';
import { InvalidPricingCsvFileError } from '../errors';
import type { CommuneRateRow, FeeGroupRecord, WilayaRateRow } from '../fee-group';
import { mergeCommuneRow, wilayaOverrideOf } from '../override-rules';
import type { CommuneRowsChange } from '../ports/fee-group-repository.port';
import { cellText, csvColumnsOf } from './csv-header';
import { type CsvCommuneRow, readCsvRow, type CsvRowContext, type CsvWilayaRow } from './csv-row';
import { communeValuesOf, wilayaValuesOf } from './csv-values';

/** What an import is planned against: the group as stored and the wilaya of each commune in geo's town directory. */
export interface CsvImportContext {
  readonly group: FeeGroupRecord;
  readonly provinceOfTown: ReadonlyMap<number, WilayaCode>;
}

/**
 * What an import of a pricing CSV would do (D3142): the data rows read, the rows it changes with their effective
 * values before and after, the refused rows, and the writes (changed wilaya rows; commune upserts and removals).
 */
export interface CsvImportPlan {
  readonly rows: number;
  readonly changes: readonly DeliveryFeeCsvChange[];
  readonly issues: readonly DeliveryFeeCsvIssue[];
  readonly wilayaRows: readonly WilayaRateRow[];
  readonly communeChange: CommuneRowsChange;
}

/** The plan as it grows, row by row. */
interface PlanDraft {
  readonly changes: DeliveryFeeCsvChange[];
  readonly issues: DeliveryFeeCsvIssue[];
  readonly wilayaRows: WilayaRateRow[];
  readonly upserts: CommuneRateRow[];
  readonly removals: number[];
  /** The wilayas and communes a row named already: a second row naming one is refused. */
  readonly seen: Set<string>;
}

const FIRST_DATA_ROW = 2;
/** What a wilaya row of the file writes; bases are carrier data and are never written by an import (D3107). */
const WILAYA_WRITTEN_FIELDS = [
  'overrideHome',
  'overrideDesk',
  'deliveryEnabled',
  'deskEnabled',
] as const satisfies readonly (keyof WilayaRateRow)[];

/** A record whose every cell is blank, as a spreadsheet leaves below its data: skipped, not counted. */
const isBlankRecord = (record: readonly string[]): boolean => record.every((cell) => cellText(cell) === '');

/** A wilaya row of the file over the stored one: typed prices are overrides of the kept base (D3107). */
function planWilaya(draft: PlanDraft, row: CsvWilayaRow, stored: WilayaRateRow): void {
  const next: WilayaRateRow = {
    ...stored,
    overrideHome: wilayaOverrideOf(stored.baseHome, row.values.homePrice),
    overrideDesk: wilayaOverrideOf(stored.baseDesk, row.values.deskPrice),
    deliveryEnabled: row.values.deliveryEnabled,
    deskEnabled: row.values.deskEnabled,
  };
  if (WILAYA_WRITTEN_FIELDS.every((field) => next[field] === stored[field])) return;
  draft.wilayaRows.push(next);
  const before = wilayaValuesOf(stored);
  draft.changes.push({
    level: 'wilaya',
    provinceCode: row.provinceCode,
    codeOns: null,
    before,
    after: wilayaValuesOf(next),
  });
}

/** A commune row of the file merged with the stored one, as `setDeliveryFeeCommuneRates` merges it (D3125). */
function planCommune(draft: PlanDraft, row: CsvCommuneRow, stored: CommuneRateRow | undefined): void {
  const merged = mergeCommuneRow(stored, row.provinceCode, { codeOns: row.codeOns, ...row.values });
  const key = { level: 'commune' as const, provinceCode: row.provinceCode, codeOns: row.codeOns };
  const before = stored === undefined ? null : communeValuesOf(stored);
  if (merged === null) {
    if (stored === undefined) return;
    draft.removals.push(row.codeOns);
    draft.changes.push({ ...key, before, after: null });
    return;
  }
  if (sameCommuneRow(merged, stored)) return;
  draft.upserts.push(merged);
  draft.changes.push({ ...key, before, after: communeValuesOf(merged) });
}

const keyOf = (row: CsvWilayaRow | CsvCommuneRow): string =>
  row.level === 'wilaya' ? `wilaya:${row.provinceCode}` : `commune:${String(row.codeOns)}`;

/** One read row into the draft: refused when its wilaya or commune was named already, planned otherwise. */
function planRow(draft: PlanDraft, rowNumber: number, row: CsvWilayaRow | CsvCommuneRow, group: FeeGroupRecord): void {
  const key = keyOf(row);
  if (draft.seen.has(key)) {
    const column = row.level === 'wilaya' ? 'provinceCode' : 'codeOns';
    draft.issues.push({ row: rowNumber, column, issue: 'duplicate-key' });
    return;
  }
  draft.seen.add(key);
  if (row.level === 'commune') {
    planCommune(
      draft,
      row,
      group.communeRates.find((stored) => stored.codeOns === row.codeOns),
    );
    return;
  }
  const stored = group.rates.find((rate) => rate.provinceCode === row.provinceCode);
  // The row was read against the group's own wilayas, so its stored row is there.
  if (stored !== undefined) planWilaya(draft, row, stored);
}

/**
 * Plans the import of a pricing CSV's records (the header first) into `context.group`, writing nothing (D3142). It
 * merges: a wilaya or commune the file does not name stays as it is.
 *
 * @throws {InvalidPricingCsvFileError} when there is no header, or a column is missing or named twice.
 */
export function planCsvImport(records: readonly (readonly string[])[], context: CsvImportContext): CsvImportPlan {
  const [header, ...data] = records;
  const columns = header === undefined ? undefined : csvColumnsOf(header);
  if (columns === undefined) throw new InvalidPricingCsvFileError();
  const rowContext: CsvRowContext = {
    heldProvinces: new Set(context.group.rates.map((rate) => rate.provinceCode)),
    provinceOfTown: context.provinceOfTown,
  };
  const draft: PlanDraft = { changes: [], issues: [], wilayaRows: [], upserts: [], removals: [], seen: new Set() };
  let rows = 0;
  data.forEach((record, index) => {
    if (isBlankRecord(record)) return;
    rows += 1;
    const rowNumber = index + FIRST_DATA_ROW;
    const reading = readCsvRow(record, columns, rowContext);
    if (reading.ok) planRow(draft, rowNumber, reading.row, context.group);
    else draft.issues.push({ row: rowNumber, column: reading.column, issue: reading.issue });
  });
  const { changes, issues, wilayaRows, upserts, removals } = draft;
  return { rows, changes, issues, wilayaRows, communeChange: { upserts, removals } };
}
