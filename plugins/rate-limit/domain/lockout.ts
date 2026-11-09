import { LOCKOUT_GROWTH_FACTOR, LOCKOUT_INITIAL_SECONDS, LOCKOUT_MAX_SECONDS } from './constants';

/** How long the next lockout lasts, given the length of the previous one (0 for a key never locked out). */
export function nextLockoutSeconds(previousSeconds: number): number {
  if (previousSeconds <= 0) {
    return LOCKOUT_INITIAL_SECONDS;
  }
  return Math.min(previousSeconds * LOCKOUT_GROWTH_FACTOR, LOCKOUT_MAX_SECONDS);
}
