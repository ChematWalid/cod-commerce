import {
  type DeliveryFeeCommuneRatesInput,
  deliveryFeeCommuneRatesInputSchema,
  type Town,
  type WilayaCode,
} from '@cod/shared';
import type { CommuneRateDto } from '../dto';
import { priceOf } from './pricing-form';

/**
 * One commune of a wilaya in the editor (D3125): the override prices as typed (blank = inherit the commune base, then
 * the wilaya), its switches (`null` = the wilaya's), the commune base prices, and the reference stop-desk flag.
 */
export interface CommuneRow {
  readonly codeOns: number;
  readonly name: string;
  readonly arabicName: string;
  readonly isStopdesk: boolean;
  readonly homePrice: string;
  readonly deskPrice: string;
  readonly deliveryEnabled: boolean | null;
  readonly deskEnabled: boolean | null;
  readonly baseHomePrice: number | null;
  readonly baseDeskPrice: number | null;
}

/**
 * The override a stored row holds for one method: its effective price when that differs from the commune base (an
 * override equal to the base is never stored, D3125), else none.
 */
const overrideTextOf = (price: number | null, base: number | null): string =>
  price === null || price === base ? '' : String(price);

/** Every commune of the wilaya (`towns`, the public reference data) with what the group stores for it. */
export function communeRowsOf(towns: readonly Town[], stored: readonly CommuneRateDto[]): CommuneRow[] {
  const byCommune = new Map(stored.map((row) => [row.codeOns, row]));
  return towns.map((town) => ({
    codeOns: town.codeOns,
    name: town.name,
    arabicName: town.arabicName,
    isStopdesk: town.isStopdesk,
    ...storedPartOf(byCommune.get(town.codeOns) ?? NOTHING_STORED),
  }));
}

/** What a commune without a stored row holds: it inherits everything. */
const NOTHING_STORED: Omit<CommuneRateDto, 'codeOns' | 'provinceCode' | 'overridden'> = {
  homePrice: null,
  deskPrice: null,
  baseHomePrice: null,
  baseDeskPrice: null,
  deliveryEnabled: null,
  deskEnabled: null,
};

type StoredPart = Pick<
  CommuneRow,
  'homePrice' | 'deskPrice' | 'deliveryEnabled' | 'deskEnabled' | 'baseHomePrice' | 'baseDeskPrice'
>;

/** The editable part of a commune row from what the group stores for it. */
const storedPartOf = (row: typeof NOTHING_STORED): StoredPart => ({
  homePrice: overrideTextOf(row.homePrice, row.baseHomePrice),
  deskPrice: overrideTextOf(row.deskPrice, row.baseDeskPrice),
  deliveryEnabled: row.deliveryEnabled,
  deskEnabled: row.deskEnabled,
  baseHomePrice: row.baseHomePrice,
  baseDeskPrice: row.baseDeskPrice,
});

/** Whether the commune sets anything of its own: a price or a switch; reset clears them all. */
export const communeOverridden = (row: CommuneRow): boolean =>
  row.homePrice.trim() !== '' ||
  row.deskPrice.trim() !== '' ||
  row.deliveryEnabled !== null ||
  row.deskEnabled !== null;

/** The price a blank commune price falls back to: the commune base, then the wilaya's typed price. */
export const fallbackPriceOf = (base: number | null, wilayaPrice: string): string =>
  base === null ? wilayaPrice : String(base);

/** A commune switch as it acts: its own value, else the wilaya's (D3125). */
export const effectiveSwitchOf = (own: boolean | null, wilaya: boolean): boolean => own ?? wilaya;

/** What one commune's edit may change. */
export type CommuneChange = Partial<Pick<CommuneRow, 'homePrice' | 'deskPrice' | 'deliveryEnabled' | 'deskEnabled'>>;

/** `rows` with the commune `codeOns` changed. */
export function withCommune(rows: readonly CommuneRow[], codeOns: number, change: CommuneChange): CommuneRow[] {
  return rows.map((row) => (row.codeOns === codeOns ? { ...row, ...change } : row));
}

/** `rows` with the commune `codeOns` inheriting everything again. */
export function withCommuneReset(rows: readonly CommuneRow[], codeOns: number): CommuneRow[] {
  return withCommune(rows, codeOns, { homePrice: '', deskPrice: '', deliveryEnabled: null, deskEnabled: null });
}

/** The save's input, or the communes whose prices the shared contract refuses. */
export type CommuneSubmit =
  | { readonly ok: true; readonly input: DeliveryFeeCommuneRatesInput }
  | { readonly ok: false; readonly errors: ReadonlySet<number> };

const communePriceOf = (text: string): number | null => (text.trim() === '' ? null : priceOf(text));

/**
 * The `setDeliveryFeeCommuneRates` input of the wilaya: every commune, a blank price as `null` (cleared), checked by
 * the shared contract the API parses with; the server merges each row and never writes a base (D3125).
 */
export function communeInputOf(provinceCode: WilayaCode, rows: readonly CommuneRow[]): CommuneSubmit {
  const parsed = deliveryFeeCommuneRatesInputSchema.safeParse({
    provinceCode,
    rows: rows.map((row) => ({
      codeOns: row.codeOns,
      homePrice: communePriceOf(row.homePrice),
      deskPrice: communePriceOf(row.deskPrice),
      deliveryEnabled: row.deliveryEnabled,
      deskEnabled: row.deskEnabled,
    })),
  });
  if (parsed.success) return { ok: true, input: parsed.data };
  const refused = parsed.error.issues.flatMap(({ path }) => {
    const index = path[0] === 'rows' ? path[1] : undefined;
    const row = typeof index === 'number' ? rows[index] : undefined;
    return row === undefined ? [] : [row.codeOns];
  });
  return { ok: false, errors: new Set(refused) };
}

/** How many communes of the wilaya are explicitly switched on: they still deliver when the wilaya goes off. */
export const communesSwitchedOn = (stored: readonly CommuneRateDto[], provinceCode: WilayaCode): number =>
  stored.filter((row) => row.provinceCode === provinceCode && row.deliveryEnabled === true).length;

/** Whether a wilaya's communes can be edited: only once the pricing option is saved and has an id. */
export const communePanelOf = (groupId: string | null): 'save-first' | 'editable' =>
  groupId === null ? 'save-first' : 'editable';
