import { pricingCsvFileNameOf, pricingCsvRecordsOf } from '../domain/csv/csv-export';
import { groupIdOf } from '../domain/group-id';
import type { OperationContext } from '../domain/ports/operation-context';
import type { PricingCsvPort } from '../domain/ports/pricing-csv.port';
import type { StoreScope } from '../domain/store-scope';
import type { FeeGroupPorts } from './fee-group-ports';

/** A pricing option's CSV export: the file's name and its bytes. */
export interface PricingCsvFile {
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

/** Exports a pricing option of the active store as CSV (D3142): one row per wilaya and per stored commune row. */
export class PricingCsvExportService {
  constructor(
    private readonly ports: FeeGroupPorts,
    private readonly csv: PricingCsvPort,
  ) {}

  /** The CSV of the store's group `rawId`, or `undefined` for an unknown, foreign, other-store or malformed id. */
  async export(ctx: OperationContext, scope: StoreScope, rawId: string): Promise<PricingCsvFile | undefined> {
    const id = groupIdOf(rawId);
    const group = id === undefined ? undefined : await this.ports.groups.find(ctx, scope, id);
    if (group === undefined) return undefined;
    return { fileName: pricingCsvFileNameOf(group), bytes: this.csv.write(pricingCsvRecordsOf(group)) };
  }
}
