import { createHash, createHmac } from 'node:crypto';
import { QUOTE_PHONE_KEY_LABEL, type PricingChannel } from '@cod/shared';
import type { PricingDestination } from '../cart';
import { canonicalJson } from './canonical';

/** One cart line as the token commits to it: the variant and how many. */
export interface CartHashLine {
  readonly variantId: string;
  readonly quantity: number;
}

/** What `h` covers (D2421): the channel, lines, destination, codes as typed and the keyed phone, if any. */
export interface CartHashInput {
  readonly channel: PricingChannel;
  readonly lines: readonly CartHashLine[];
  readonly destination: PricingDestination;
  readonly codes: readonly string[];
  readonly phoneKey: string | null;
}

/**
 * The phone as it enters `h`: base64url HMAC-SHA256 under the token kid's key (D2421). A bare hash would let anyone
 * holding a token try the ~1e9 Algerian numbers; the key makes that impossible without the server secret.
 */
export function phoneKey(key: string, phoneE164: string): string {
  return createHmac('sha256', key).update(`${QUOTE_PHONE_KEY_LABEL}${phoneE164}`, 'utf8').digest('base64url');
}

/** Decimal ids sorted as numbers: a shorter id is smaller, then digit by digit. */
const byDecimalId = (left: string, right: string): number =>
  left.length - right.length || (left < right ? -1 : Number(left > right));

/** Lines of one variant summed into one `[variantId, quantity]` pair (D2428), sorted by variant id. */
function mergedLines(lines: readonly CartHashLine[]): [string, number][] {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    quantities.set(line.variantId, (quantities.get(line.variantId) ?? 0) + line.quantity);
  }
  return [...quantities.entries()].sort(([left], [right]) => byDecimalId(left, right));
}

/** Codes as the engine reads them: trimmed, upper-cased, each once, sorted (D2406). */
const normalisedCodes = (codes: readonly string[]): string[] =>
  [...new Set(codes.map((code) => code.trim().toUpperCase()))].sort();

/** The destination with a trimmed commune, or `null` when none is chosen. */
function canonicalDestination(destination: PricingDestination): object | null {
  if (destination === null) return null;
  const townOns = destination.townOns?.trim() ?? '';
  return { provinceCode: destination.provinceCode, stopdesk: destination.stopdesk, townOns: townOns || null };
}

/**
 * `h` of the quote token (D2421): SHA-256 hex of the canonical JSON of the structured cart, never of a joined string,
 * so a free-text commune cannot pass for another field. Line order, repeated lines and code spelling do not matter.
 */
export function cartHash(cart: CartHashInput): string {
  const canonical = canonicalJson({
    channel: cart.channel,
    lines: mergedLines(cart.lines),
    destination: canonicalDestination(cart.destination),
    codes: normalisedCodes(cart.codes),
    phoneKey: cart.phoneKey,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
