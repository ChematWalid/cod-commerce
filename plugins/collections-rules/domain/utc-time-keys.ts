/** One hour in milliseconds. */
const HOUR_MS = 3_600_000;
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

/**
 * Milliseconds from `epochMs` to the start of the next UTC hour; a time on the boundary waits a whole hour, since it
 * already belongs to the hour that starts there.
 */
export function msUntilNextUtcHour(epochMs: number): number {
  return HOUR_MS - (((epochMs % HOUR_MS) + HOUR_MS) % HOUR_MS);
}
