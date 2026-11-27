import { MS_PER_SECOND } from './constants';

/** Whole seconds from `thenMs` to `nowMs`, never negative (a clock step backwards reads as 0). */
export const ageSeconds = (nowMs: number, thenMs: number): number =>
  Math.max(0, Math.floor((nowMs - thenMs) / MS_PER_SECOND));
