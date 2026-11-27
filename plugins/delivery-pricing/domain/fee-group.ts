import type { Snowflake, WilayaCode } from '@cod/shared';

/**
 * One wilaya of a fee group as stored (D3107, D3120): the base prices (platform default or carrier sync), the
 * merchant's overrides (`null` = none) and the delivery and stop-desk switches.
 */
export interface WilayaRateRow {
  readonly provinceCode: WilayaCode;
  readonly baseHome: number;
  readonly baseDesk: number;
  readonly overrideHome: number | null;
  readonly overrideDesk: number | null;
  readonly deliveryEnabled: boolean;
  readonly deskEnabled: boolean;
}

/** One commune of a fee group as stored (D3125): every price and switch may be `null`, which inherits. */
export interface CommuneRateRow {
  readonly codeOns: number;
  readonly provinceCode: WilayaCode;
  readonly baseHome: number | null;
  readonly baseDesk: number | null;
  readonly overrideHome: number | null;
  readonly overrideDesk: number | null;
  readonly deliveryEnabled: boolean | null;
  readonly deskEnabled: boolean | null;
}

/** The settings of a fee group the merchant edits beside its rates. */
export interface FeeGroupSettings {
  readonly name: string;
  readonly carrierId: Snowflake | null;
  readonly chargeOverweight: boolean;
  readonly overweightAllowanceKg: number;
  readonly overweightRate: number;
}

/** A fee group's own row: its settings, whether it is the seeded table, and its dates. */
export interface FeeGroupHeader extends FeeGroupSettings {
  readonly id: Snowflake;
  readonly isPlatformDefault: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A fee group with its one row per wilaya and its sparse commune rows. */
export interface FeeGroupRecord extends FeeGroupHeader {
  readonly rates: readonly WilayaRateRow[];
  readonly communeRates: readonly CommuneRateRow[];
}

/** A fee group to insert: its settings and rows; the repository gives it an id and dates. */
export interface NewFeeGroup extends FeeGroupSettings {
  readonly isPlatformDefault: boolean;
  readonly rates: readonly WilayaRateRow[];
}

/** One page of the store's fee groups, newest first, and how many match in all. */
export interface FeeGroupPage {
  readonly items: readonly FeeGroupHeader[];
  readonly totalItems: number;
}

/** A page query of the fee-group list. */
export interface FeeGroupListQuery {
  readonly skip: number;
  readonly take: number;
  readonly search?: string;
}

/** The settings of a stored group, as an update or a copy writes them back. */
export const settingsOfGroup = (group: FeeGroupSettings): FeeGroupSettings => ({
  name: group.name,
  carrierId: group.carrierId,
  chargeOverweight: group.chargeOverweight,
  overweightAllowanceKg: group.overweightAllowanceKg,
  overweightRate: group.overweightRate,
});
