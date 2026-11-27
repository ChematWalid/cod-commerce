import {
  type DeliveryFeeCsvChange,
  type DeliveryFeeCsvIssue,
  PRICING_CSV_MAX_BYTES,
  type WilayaCode,
} from '@cod/shared';
import { type CsvImportPlan, planCsvImport } from '../domain/csv/csv-import-plan';
import { DeliveryFeeGroupNotFoundError, InvalidPricingCsvRowsError, PricingCsvTooLargeError } from '../domain/errors';
import { type FeeGroupRecord, settingsOfGroup } from '../domain/fee-group';
import { groupIdOf } from '../domain/group-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { PricingCsvPort } from '../domain/ports/pricing-csv.port';
import type { StoreScope } from '../domain/store-scope';
import type { FeeGroupPorts } from './fee-group-ports';
import { withLockedGroup } from './locked-group';

/** The header record, counted by the row cap besides one row per wilaya and per commune. */
const HEADER_RECORDS = 1;

/** A CSV to import into a pricing option: its bytes, and whether only the diff is wanted. */
export interface PricingCsvImportRequest {
  readonly bytes: Uint8Array;
  readonly dryRun: boolean;
}

/** What an import did or would do: the rows read, the changes, the refused rows, and the group once written. */
export interface PricingCsvImportReport {
  readonly dryRun: boolean;
  readonly applied: boolean;
  readonly rows: number;
  readonly changes: readonly DeliveryFeeCsvChange[];
  readonly issues: readonly DeliveryFeeCsvIssue[];
  /** The group as written by an apply; `null` for a dry run. */
  readonly group: FeeGroupRecord | null;
}

const reportOf = (plan: CsvImportPlan, group: FeeGroupRecord | null): PricingCsvImportReport => ({
  dryRun: group === null,
  applied: group !== null,
  rows: plan.rows,
  changes: plan.changes,
  issues: plan.issues,
  group,
});

/**
 * Imports a CSV into a pricing option of the active store (D3142), synchronously: a dry run answers the diff and writes
 * nothing; an apply plans again under the group lock and writes every change in one transaction, or nothing when a row
 * is refused. It merges: rows the file does not name, commune rows included, stay as they are.
 */
export class PricingCsvImportService {
  constructor(
    private readonly ports: FeeGroupPorts,
    private readonly csv: PricingCsvPort,
  ) {}

  /**
   * @throws {DeliveryFeeGroupNotFoundError} for an unknown, foreign, other-store or malformed group id, checked first.
   * @throws {PricingCsvTooLargeError} above `PRICING_CSV_MAX_BYTES`.
   * @throws {InvalidPricingCsvFileError} for bytes that are not UTF-8 CSV with each column once.
   * @throws {PricingCsvTooManyRowsError} past the group's wilayas, their communes and the header.
   * @throws {InvalidPricingCsvRowsError} for an apply of a file with refused rows; nothing is written.
   */
  async import(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    request: PricingCsvImportRequest,
  ): Promise<PricingCsvImportReport> {
    const id = groupIdOf(rawId);
    if (id === undefined) throw new DeliveryFeeGroupNotFoundError();
    if (request.dryRun) {
      return this.ports.transaction.run(ctx, scope, async (tx) => {
        const group = await this.ports.groups.find(tx, scope, id);
        if (group === undefined) throw new DeliveryFeeGroupNotFoundError();
        return reportOf(await this.planOf(group, request.bytes), null);
      });
    }
    return this.apply(ctx, scope, rawId, request.bytes);
  }

  private async apply(
    ctx: OperationContext,
    scope: StoreScope,
    rawId: string,
    bytes: Uint8Array,
  ): Promise<PricingCsvImportReport> {
    let planned: CsvImportPlan | undefined;
    const written = await withLockedGroup({ ports: this.ports, ctx, scope, rawId }, async (tx, group) => {
      const plan = await this.planOf(group, bytes);
      if (plan.issues.length > 0) throw new InvalidPricingCsvRowsError();
      planned = plan;
      if (plan.wilayaRows.length > 0) {
        await this.ports.groups.update(tx, scope, group.id, {
          settings: settingsOfGroup(group),
          rates: plan.wilayaRows,
        });
      }
      const { upserts, removals } = plan.communeChange;
      if (upserts.length + removals.length > 0)
        await this.ports.groups.writeCommuneRows(tx, scope, group.id, plan.communeChange);
    });
    if (planned === undefined) throw new DeliveryFeeGroupNotFoundError();
    return reportOf(planned, written);
  }

  /** The import planned against the group as stored; the row cap comes from its wilayas and geo's communes (#304). */
  private async planOf(group: FeeGroupRecord, bytes: Uint8Array): Promise<CsvImportPlan> {
    if (bytes.byteLength > PRICING_CSV_MAX_BYTES) throw new PricingCsvTooLargeError();
    const provinceOfTown = new Map<number, WilayaCode>();
    for (const { provinceCode } of group.rates) {
      for (const codeOns of await this.ports.towns.townsOf(provinceCode)) provinceOfTown.set(codeOns, provinceCode);
    }
    const maxRecords = group.rates.length + provinceOfTown.size + HEADER_RECORDS;
    return planCsvImport(this.csv.read(bytes, maxRecords), { group, provinceOfTown });
  }
}
