import { MAX_DELIVERY_PRICE, PERCENT_BASE, type PriceAdjustmentKind, roundHalfUp, type WilayaCode } from '@cod/shared';
import type { CommuneRateRow, WilayaRateRow } from './fee-group';
import { communeOverrideOf, wilayaOverrideOf } from './override-rules';
import type { CommuneRowsChange } from './ports/fee-group-repository.port';

/** One "Raise/lower by…" (D3140): by whole DZD or a whole percent, on the home and/or the desk price. */
export interface PriceChange {
  readonly kind: PriceAdjustmentKind;
  readonly value: number;
  readonly home: boolean;
  readonly desk: boolean;
}

/** The prices "Set price for all communes" gives (D3140): absent = as stored, `null` = clear the override. */
export interface CommunePrices {
  readonly homePrice?: number | null;
  readonly deskPrice?: number | null;
}

/** The stored fields of a commune row besides its keys. */
const COMMUNE_FIELDS = [
  'baseHome',
  'baseDesk',
  'overrideHome',
  'overrideDesk',
  'deliveryEnabled',
  'deskEnabled',
] as const satisfies readonly (keyof CommuneRateRow)[];

const sameCommuneRow = (left: CommuneRateRow, right: CommuneRateRow | undefined): boolean =>
  right !== undefined && COMMUNE_FIELDS.every((field) => left[field] === right[field]);

const isEmptyCommuneRow = (row: CommuneRateRow): boolean => COMMUNE_FIELDS.every((field) => row[field] === null);

const clampPrice = (price: number): number => Math.min(Math.max(price, 0), MAX_DELIVERY_PRICE);

/**
 * `price` moved by the change, in whole DZD: a percent is rounded half up (ADR 0004, `roundHalfUp`), and the result
 * is clamped to 0–`MAX_DELIVERY_PRICE`, so a cut never goes negative and a raise never passes the column bound.
 */
export function adjustedPrice(price: number, change: Pick<PriceChange, 'kind' | 'value'>): number {
  const moved =
    change.kind === 'amount'
      ? price + change.value
      : roundHalfUp((price * (PERCENT_BASE + change.value)) / PERCENT_BASE);
  return clampPrice(moved);
}

/**
 * The selected wilaya rows with their effective prices (override ?? base) moved, stored as overrides of the kept base
 * (D3107: a price equal to the base stores none). Bases and switches are never written; rows outside the selection
 * are not answered, so the caller writes only what changed.
 */
export function adjustPrices(
  rows: readonly WilayaRateRow[],
  selection: ReadonlySet<WilayaCode>,
  change: PriceChange,
): WilayaRateRow[] {
  return rows
    .filter((row) => selection.has(row.provinceCode))
    .map((row) => ({
      ...row,
      overrideHome: change.home
        ? wilayaOverrideOf(row.baseHome, adjustedPrice(row.overrideHome ?? row.baseHome, change))
        : row.overrideHome,
      overrideDesk: change.desk
        ? wilayaOverrideOf(row.baseDesk, adjustedPrice(row.overrideDesk ?? row.baseDesk, change))
        : row.overrideDesk,
    }));
}

/** A commune's override after the change: one with no price of its own inherits the moved wilaya price, untouched. */
function movedCommuneOverride(base: number | null, override: number | null, change: PriceChange): number | null {
  const effective = override ?? base;
  return effective === null ? override : communeOverrideOf(base, adjustedPrice(effective, change));
}

/**
 * With "include communes", the commune rows of the selected wilayas that hold a price of their own, moved like their
 * wilaya (D3125: a typed price equal to the commune base stores no override). Only changed rows are answered.
 */
export function adjustCommunePrices(
  rows: readonly CommuneRateRow[],
  selection: ReadonlySet<WilayaCode>,
  change: PriceChange,
): CommuneRateRow[] {
  return rows
    .filter((row) => selection.has(row.provinceCode))
    .flatMap((row) => {
      const moved: CommuneRateRow = {
        ...row,
        overrideHome: change.home ? movedCommuneOverride(row.baseHome, row.overrideHome, change) : row.overrideHome,
        overrideDesk: change.desk ? movedCommuneOverride(row.baseDesk, row.overrideDesk, change) : row.overrideDesk,
      };
      return sameCommuneRow(moved, row) ? [] : [moved];
    });
}

/** One commune with the asked prices: bases and switches as stored, an absent price keeping its stored override. */
function communeWithPrices(
  codeOns: number,
  provinceCode: WilayaCode,
  stored: CommuneRateRow | undefined,
  prices: CommunePrices,
): CommuneRateRow {
  const baseHome = stored?.baseHome ?? null;
  const baseDesk = stored?.baseDesk ?? null;
  return {
    codeOns,
    provinceCode,
    baseHome,
    baseDesk,
    overrideHome:
      prices.homePrice === undefined ? (stored?.overrideHome ?? null) : communeOverrideOf(baseHome, prices.homePrice),
    overrideDesk:
      prices.deskPrice === undefined ? (stored?.overrideDesk ?? null) : communeOverrideOf(baseDesk, prices.deskPrice),
    deliveryEnabled: stored?.deliveryEnabled ?? null,
    deskEnabled: stored?.deskEnabled ?? null,
  };
}

/**
 * "Set price for all communes" of a wilaya (D3140): every commune of `towns` (geo's `TownDirectory`) takes the asked
 * prices. A row left empty goes, an unchanged one is not rewritten; bases and switches are never written.
 */
export function setCommunePrices(
  towns: readonly number[],
  provinceCode: WilayaCode,
  stored: readonly CommuneRateRow[],
  prices: CommunePrices,
): CommuneRowsChange {
  const byCommune = new Map(stored.map((row) => [row.codeOns, row]));
  const upserts: CommuneRateRow[] = [];
  const removals: number[] = [];
  for (const codeOns of towns) {
    const current = byCommune.get(codeOns);
    const next = communeWithPrices(codeOns, provinceCode, current, prices);
    if (isEmptyCommuneRow(next)) {
      if (current !== undefined) removals.push(codeOns);
    } else if (!sameCommuneRow(next, current)) upserts.push(next);
  }
  return { upserts, removals };
}
