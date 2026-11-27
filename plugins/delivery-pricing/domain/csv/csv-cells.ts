import {
  MAX_DELIVERY_PRICE,
  PRICING_CSV_LEVELS,
  PRICING_CSV_SWITCH_OFF,
  PRICING_CSV_SWITCH_ON,
  type PricingCsvLevel,
  type PricingCsvRowIssue,
  type WilayaCode,
} from '@cod/shared';
import { TOWN_ONS_PATTERN } from '../constants';

/** A cell as read: its value, or why the row is refused. */
export type CellReading<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issue: PricingCsvRowIssue };

const valueOf = <T>(value: T): CellReading<T> => ({ ok: true, value });
const refusal = (issue: PricingCsvRowIssue): CellReading<never> => ({ ok: false, issue });

const WHOLE_NUMBER = /^\d+$/;
/** A wilaya code as a spreadsheet may show it: `16`, `01`, or `1` once its leading zero is dropped. */
const PROVINCE_DIGITS = /^\d{1,2}$/;
const PROVINCE_CODE_LENGTH = 2;

/** The row's level, in any letter case. */
export function readLevel(text: string): CellReading<PricingCsvLevel> {
  const level = PRICING_CSV_LEVELS.find((candidate) => candidate === text.toLowerCase());
  return level === undefined ? refusal('invalid-level') : valueOf(level);
}

/** The two-digit code of a wilaya the group holds a row of: its stored rows decide, never a fixed list (#304). */
export function readProvince(text: string, held: ReadonlySet<WilayaCode>): CellReading<WilayaCode> {
  if (!PROVINCE_DIGITS.test(text)) return refusal('unknown-wilaya');
  const code = [...held].find((candidate) => candidate === text.padStart(PROVINCE_CODE_LENGTH, '0'));
  return code === undefined ? refusal('unknown-wilaya') : valueOf(code);
}

/** A whole DZD price from 0 to `MAX_DELIVERY_PRICE`; an empty cell is `null`, refused where a value is `required`. */
export function readPrice(text: string, required: boolean): CellReading<number | null> {
  if (text === '') return required ? refusal('missing-value') : valueOf(null);
  if (!WHOLE_NUMBER.test(text)) return refusal('invalid-price');
  const price = Number(text);
  return price <= MAX_DELIVERY_PRICE ? valueOf(price) : refusal('invalid-price');
}

/** A switch, `true` or `false` in any letter case; an empty cell is `null`, refused where a value is `required`. */
export function readSwitch(text: string, required: boolean): CellReading<boolean | null> {
  if (text === '') return required ? refusal('missing-value') : valueOf(null);
  const word = text.toLowerCase();
  if (word === PRICING_CSV_SWITCH_ON) return valueOf(true);
  return word === PRICING_CSV_SWITCH_OFF ? valueOf(false) : refusal('invalid-switch');
}

/** A commune of `provinceCode` in geo's town directory (`provinceOfTown`): unknown, or of another wilaya, is refused. */
export function readCommune(
  text: string,
  provinceCode: WilayaCode,
  provinceOfTown: ReadonlyMap<number, WilayaCode>,
): CellReading<number> {
  if (!TOWN_ONS_PATTERN.test(text)) return refusal('unknown-commune');
  const codeOns = Number(text);
  const province = provinceOfTown.get(codeOns);
  if (province === undefined) return refusal('unknown-commune');
  return province === provinceCode ? valueOf(codeOns) : refusal('commune-not-in-wilaya');
}
