/** Width of a zero-padded month, day or hour in a time key. */
const TWO_DIGITS = 2;
/** Width of the year in a time key. */
const FOUR_DIGITS = 4;

const padded = (value: number, width: number): string => String(value).padStart(width, '0');

/** `YYYYMMDD` of the UTC day holding `epochMs`. */
export function utcDayKey(epochMs: number): string {
  const at = new Date(epochMs);
  const month = at.getUTCMonth() + 1;
  return `${padded(at.getUTCFullYear(), FOUR_DIGITS)}${padded(month, TWO_DIGITS)}${padded(at.getUTCDate(), TWO_DIGITS)}`;
}

/** `YYYYMMDDHH` of the UTC hour holding `epochMs`. */
export function utcHourKey(epochMs: number): string {
  return `${utcDayKey(epochMs)}${padded(new Date(epochMs).getUTCHours(), TWO_DIGITS)}`;
}
