import { ROLLOUT_MAX_PERCENT, ROLLOUT_MIN_PERCENT } from '../constants';

const DIGITS = /^[0-9]+$/;

/** The whole percent the text holds, or null when it is empty, not a whole number, or outside 0 to 100. */
export function parseRolloutInput(text: string): number | null {
  const trimmed = text.trim();
  if (!DIGITS.test(trimmed)) return null;
  const percent = Number(trimmed);
  return percent >= ROLLOUT_MIN_PERCENT && percent <= ROLLOUT_MAX_PERCENT ? percent : null;
}
