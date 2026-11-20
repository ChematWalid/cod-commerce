import { createHash } from 'node:crypto';
import { quoteKeyRing, type QuoteKey, type QuoteKeyRing } from '@cod/shared/quote-keys';

/**
 * Synthetic quote keys for the token tests, copied from the generator of
 * `apps/server/tests/support/deployed-env.fixture.ts`: built at runtime from a fixed seed, never written out, so no
 * secret-shaped literal reaches the repository and every run gets the same keys.
 */
const FIXTURE_SEED = 'cod-offers-quote-key-fixture';
const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SECRET_LENGTH = 32;

const rankOf = (label: string, symbol: string): string =>
  createHash('sha256').update(`${FIXTURE_SEED}:${label}:${symbol}`).digest('hex');

/** A mixed-case alphanumeric secret of 32 distinct characters, fixed by `label`. */
export function syntheticSecret(label: string): string {
  return Array.from(ALPHANUMERIC)
    .map((symbol) => ({ symbol, rank: rankOf(label, symbol) }))
    .sort((left, right) => (left.rank < right.rank ? -1 : 1))
    .map(({ symbol }) => symbol)
    .join('')
    .slice(0, SECRET_LENGTH);
}

/** A key of the ring whose secret is derived from its kid. */
export const aQuoteKey = (kid: string): QuoteKey => ({ kid, secret: syntheticSecret(`quote-${kid}`) });

/** A ring of `kids` (first listed first) that signs with `activeKid`. */
export const aQuoteKeyRing = (kids: readonly string[], activeKid: string): QuoteKeyRing =>
  quoteKeyRing(kids.map(aQuoteKey), activeKid);
