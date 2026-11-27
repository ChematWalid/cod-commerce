import type {
  DeliveryFeeCommuneRate,
  DeliveryFeeCsvChange,
  DeliveryFeeCsvIssue,
  DeliveryFeeGroupSummary,
  DeliveryFeeRate,
} from '@cod/shared';

/** One wilaya of a fee group as the Admin API answers it (`DeliveryFeeRate`). */
export type FeeRateDto = DeliveryFeeRate;

/** One stored commune row of a fee group (`DeliveryFeeCommuneRate`, D3125). */
export type CommuneRateDto = DeliveryFeeCommuneRate;

/** A row of the pricing list (`DeliveryFeeGroupSummary`). */
export type FeeGroupSummaryDto = DeliveryFeeGroupSummary;

/** One page of the pricing list (`DeliveryFeeGroupPage`). */
export interface FeeGroupPageDto {
  readonly items: readonly FeeGroupSummaryDto[];
  readonly totalItems: number;
}

/** A whole fee group as the editor reads it (`DeliveryFeeGroup`). */
export interface FeeGroupDto {
  readonly id: string;
  readonly name: string;
  readonly carrierId: string | null;
  readonly chargeOverweight: boolean;
  readonly overweightAllowanceKg: number;
  readonly overweightRate: number;
  readonly isPlatformDefault: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly rates: readonly FeeRateDto[];
  readonly communeRates: readonly CommuneRateDto[];
}

/** A pricing option as CSV (`DeliveryFeeGroupCsv`, D3142): its file name and its text, byte order mark included. */
export interface CsvFileDto {
  readonly fileName: string;
  readonly content: string;
}

/** What a CSV import did or would do (`DeliveryFeeCsvImportResult`, D3142). */
export interface CsvImportDto {
  readonly dryRun: boolean;
  readonly applied: boolean;
  readonly rows: number;
  readonly totalIssues: number;
  readonly issues: readonly DeliveryFeeCsvIssue[];
  readonly changes: readonly DeliveryFeeCsvChange[];
  /** The option as written by an apply; null for a preview. */
  readonly group: FeeGroupDto | null;
}
