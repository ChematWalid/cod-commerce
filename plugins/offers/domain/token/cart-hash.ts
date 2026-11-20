import { createHash, createHmac } from 'node:crypto';
import { QUOTE_PHONE_KEY_LABEL, type PricingChannel } from '@cod/shared';
import type { PricingDestination } from '../cart';
import { canonicalJson } from './canonical';

/** One cart line as the token commits to it: the variant and how many. */
export interface CartHashLine {
  readonly variantId: string;
  readonly quantity: number;
}

/** One add-on as the token commits to it: the offer, the variant and how many the buyer asked for (D2506). */
export interface CartHashAddon {
  readonly offerId: string;
  readonly variantId: string;
  readonly quantity: number;
}

/**
 * What `h` covers (D2421): the channel, lines, destination, codes as typed, the keyed phone, if any, and the add-ons
 * the buyer accepted (D2506; none when absent).
 */
export interface CartHashInput {
  readonly channel: PricingChannel;
  readonly lines: readonly CartHashLine[];
  readonly destination: PricingDestination;
  readonly codes: readonly string[];
  readonly phoneKey: string | null;
  readonly addons?: readonly CartHashAddon[];
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

/** Add-ons as `[offerId, variantId, quantity]` triples sorted by offer id, then variant id (D2506). */
const sortedAddons = (addons: readonly CartHashAddon[]): [string, string, number][] =>
  addons
    .map(({ offerId, variantId, quantity }): [string, string, number] => [offerId, variantId, quantity])
    .sort(
      ([leftOffer, leftVariant], [rightOffer, rightVariant]) =>
        byDecimalId(leftOffer, rightOffer) || byDecimalId(leftVariant, rightVariant),
    );

/** The `addons` key of the hashed cart: present only with add-ons, so every hash without them stays as in P2.S4. */
function addonsKeyOf(addons: readonly CartHashAddon[] = []): { addons?: [string, string, number][] } {
  return addons.length === 0 ? {} : { addons: sortedAddons(addons) };
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
 * so a free-text commune cannot pass for another field. Line order, repeated lines, code spelling and add-on order do
 * not matter; add-ons enter only when there are some (D2506), so a cart without them keeps its P2.S4 hash.
 */
export function cartHash(cart: CartHashInput): string {
  const canonical = canonicalJson({
    channel: cart.channel,
    lines: mergedLines(cart.lines),
    destination: canonicalDestination(cart.destination),
    codes: normalisedCodes(cart.codes),
    phoneKey: cart.phoneKey,
    ...addonsKeyOf(cart.addons),
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
