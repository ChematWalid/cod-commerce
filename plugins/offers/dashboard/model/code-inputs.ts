import type { GenerateCodesInput } from '@cod/shared';
import { wholeNumberOf } from './kind-editors';

/** One code as `addOfferCodes` takes it; the server trims, upper-cases and checks it (D2406). */
export interface CodeInput {
  readonly code: string;
  readonly usageLimit: number | null;
}

/** The typed code and its limit, or `null` when the code is blank or the limit is not a whole number. */
export function codeInputOf(code: string, limitText: string): CodeInput | null {
  const usageLimit = wholeNumberOf(limitText);
  if (code.trim() === '' || usageLimit === undefined) return null;
  return { code: code.trim(), usageLimit };
}

/** The typed "Generate codes" fields (D2512), or `null` when the count or the limit is not a whole number. */
export function generateInputOf(countText: string, prefix: string, limitText: string): GenerateCodesInput | null {
  const count = wholeNumberOf(countText);
  const usageLimit = wholeNumberOf(limitText);
  if (count === null || count === undefined || usageLimit === undefined) return null;
  return { count, prefix: prefix.trim().toUpperCase(), usageLimit };
}
