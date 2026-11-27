import { createHash } from 'node:crypto';
import { quoteKeyRing, type QuoteKeyRing } from '@cod/shared/quote-keys';

/**
 * Synthetic quote keys for the test servers that boot the offers (D2341), copied from the offers' own test support
 * (rule `no-cross-plugin-internals` forbids importing it): built at runtime from a fixed seed, never written out, so
 * no secret-shaped literal reaches the repository and every run gets the same keys.
 */
const FIXTURE_SEED = 'cod-storefront-api-quote-key-fixture';
const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SECRET_LENGTH = 32;
const KID = 'k1';

const rankOf = (symbol: string): string => createHash('sha256').update(`${FIXTURE_SEED}:${symbol}`).digest('hex');

/** A mixed-case alphanumeric secret of 32 distinct characters, the same on every run. */
function syntheticSecret(): string {
  return Array.from(ALPHANUMERIC)
    .map((symbol) => ({ symbol, rank: rankOf(symbol) }))
    .sort((left, right) => (left.rank < right.rank ? -1 : 1))
    .map(({ symbol }) => symbol)
    .join('')
    .slice(0, SECRET_LENGTH);
}

/** A one-key ring for `OffersPlugin.init` in a collections test server. */
export const aTestQuoteKeyRing = (): QuoteKeyRing => quoteKeyRing([{ kid: KID, secret: syntheticSecret() }], KID);
