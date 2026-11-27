import type { DeliveryFeeCommuneRate, DeliveryFeeGroupSummary, DeliveryFeeRate } from '@cod/shared';

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
