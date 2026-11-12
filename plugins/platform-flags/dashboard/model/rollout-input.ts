import { ROLLOUT_MAX_PERCENT, ROLLOUT_MIN_PERCENT } from '../constants';

const DIGITS = /^[0-9]+$/;
const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/** Arabic-Indic (U+0660-0669) and Persian (U+06F0-06F9) digits become ASCII digits; everything else is left alone. */
function toAsciiDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (char) => {
    const code = char.charCodeAt(0);
    return String(code >= EXTENDED_ARABIC_INDIC_ZERO ? code - EXTENDED_ARABIC_INDIC_ZERO : code - ARABIC_INDIC_ZERO);
  });
}

/** The whole percent the text holds, or null when it is empty, not a whole number, or outside 0 to 100. */
export function parseRolloutInput(text: string): number | null {
  const trimmed = toAsciiDigits(text.trim());
  if (!DIGITS.test(trimmed)) return null;
  const percent = Number(trimmed);
  return percent >= ROLLOUT_MIN_PERCENT && percent <= ROLLOUT_MAX_PERCENT ? percent : null;
}
