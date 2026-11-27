import { isWilayaCode, type Snowflake, toSnowflake, type WilayaCode } from '@cod/shared';
import type { CommuneRateRow, FeeGroupHeader, WilayaRateRow } from '../domain/fee-group';
import type { FeeCommuneRateEntity } from './fee-commune-rate.entity';
import type { FeeGroupEntity } from './fee-group.entity';
import type { FeeRateEntity } from './fee-rate.entity';

/** A stored wilaya code; only the API writes the column, so another value is a corrupt row. */
function wilayaOf(code: string): WilayaCode {
  if (!isWilayaCode(code)) throw new Error('A delivery fee row holds an unknown wilaya code');
  return code;
}

/** The domain header of a `delivery_fee_group` row. */
export const headerOf = (row: FeeGroupEntity): FeeGroupHeader => ({
  id: toSnowflake(row.id),
  name: row.name,
  carrierId: row.carrierId === null ? null : toSnowflake(row.carrierId),
  chargeOverweight: row.chargeOverweight,
  overweightAllowanceKg: row.overweightAllowanceKg,
  overweightRate: row.overweightRate,
  isPlatformDefault: row.isPlatformDefault,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/** The domain row of a `delivery_fee_rate` row. */
export const wilayaRowOf = (row: FeeRateEntity): WilayaRateRow => ({
  provinceCode: wilayaOf(row.provinceCode),
  baseHome: row.baseHome,
  baseDesk: row.baseDesk,
  overrideHome: row.overrideHome,
  overrideDesk: row.overrideDesk,
  deliveryEnabled: row.deliveryEnabled,
  deskEnabled: row.deskEnabled,
});

/** The domain row of a `delivery_fee_commune_rate` row. */
export const communeRowOf = (row: FeeCommuneRateEntity): CommuneRateRow => ({
  codeOns: row.codeOns,
  provinceCode: wilayaOf(row.provinceCode),
  baseHome: row.baseHome,
  baseDesk: row.baseDesk,
  overrideHome: row.overrideHome,
  overrideDesk: row.overrideDesk,
  deliveryEnabled: row.deliveryEnabled,
  deskEnabled: row.deskEnabled,
});

/** The columns of a wilaya row of group `groupId`, without the tenant columns. */
export const wilayaColumnsOf = (groupId: Snowflake, row: WilayaRateRow) => ({ groupId, ...row });

/** The columns of a commune row of group `groupId`, without the tenant columns. */
export const communeColumnsOf = (groupId: Snowflake, row: CommuneRateRow) => ({ groupId, ...row });
