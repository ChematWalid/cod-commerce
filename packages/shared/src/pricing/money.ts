import { MONEY_MAX_DZD } from '../catalog/money';
import { PERCENT_BASE } from './constants';

/** Half a DZD: the point from which a fraction rounds up. */
const HALF = 0.5;

/**
 * Rounds to the nearest whole DZD, a half going up (ADR 0004, D2409): 742.5 → 743, 742.4 → 742. Amounts are never
 * negative here, so "half up" and "half away from zero" agree.
 */
export function roundHalfUp(value: number): number {
  return Math.floor(value + HALF);
}

/** `percent` % of `amount`, rounded half up to whole DZD: 15 % of 4,950 is 743. */
export function percentOf(amount: number, percent: number): number {
  return roundHalfUp((amount * percent) / PERCENT_BASE);
}

/**
 * Bounds an amount to the money range, 0 to {@link MONEY_MAX_DZD}, as whole DZD (a fraction rounds half up).
 *
 * @throws RangeError for NaN, which would otherwise flow silently into totals and the token.
 */
export function clampMoney(value: number): number {
  if (Number.isNaN(value)) throw new RangeError('clampMoney: amount is NaN');
  return roundHalfUp(Math.min(Math.max(value, 0), MONEY_MAX_DZD));
}
