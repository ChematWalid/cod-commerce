import { InvalidQuoteKeysError, parseQuoteKeys, type QuoteKey } from '@cod/shared/quote-keys';
import { z } from 'zod';

const QUOTE_KEYS_NAME = 'QUOTE_HMAC_KEYS';

/** The settings the quote tokens read (ADR 0004, D2422), spread into the server's schema. Messages never repeat a key. */
export const quoteKeysEnvShape = {
  // The HMAC keys of the signed quotes, `kid:secret[,kid:secret]` like INTERNAL_HMAC_KEYS: every key verifies, the
  // active kid signs. Required for every role, so a deployment cannot start without them.
  QUOTE_HMAC_KEYS: z.string().superRefine((value, context) => {
    try {
      parseQuoteKeys(value);
    } catch (error) {
      if (!(error instanceof InvalidQuoteKeysError)) {
        throw error;
      }
      context.addIssue({ code: 'custom', message: error.message });
    }
  }),
  QUOTE_HMAC_ACTIVE_KID: z.string().min(1),
};

interface QuoteKeysEnv {
  readonly QUOTE_HMAC_KEYS: string;
  readonly QUOTE_HMAC_ACTIVE_KID: string;
}

/** The keys of `QUOTE_HMAC_KEYS`, or none when it is malformed (its own issue reports that). */
function quoteKeysOf(env: QuoteKeysEnv): readonly QuoteKey[] {
  try {
    return parseQuoteKeys(env.QUOTE_HMAC_KEYS);
  } catch (error) {
    if (error instanceof InvalidQuoteKeysError) {
      return [];
    }
    throw error;
  }
}

/** Each key's secret, for the placeholder and strength checks of a deployed server. */
export function quoteKeysSecretsOf(env: QuoteKeysEnv): [name: string, value: string][] {
  return quoteKeysOf(env).map((key): [string, string] => [QUOTE_KEYS_NAME, key.secret]);
}

/** Quotes are signed under the active kid, so it must name a key of the ring. */
export function requireKnownQuoteActiveKid(env: QuoteKeysEnv, context: z.RefinementCtx): void {
  const keys = quoteKeysOf(env);
  if (keys.length > 0 && !keys.some((key) => key.kid === env.QUOTE_HMAC_ACTIVE_KID)) {
    context.addIssue({
      code: 'custom',
      path: ['QUOTE_HMAC_ACTIVE_KID'],
      message: 'must be one of the kids in QUOTE_HMAC_KEYS',
    });
  }
}

/**
 * A quote key must not reuse another secret of the server: buyer-facing quote tokens and the other signatures and
 * cookies stay under separate keys, so a leak or a forgery in one cannot carry over. `secrets` are all the server's
 * secrets; the quote keys' own entries are skipped. Checked when deployed; the message names the variables only.
 */
export function rejectReusedQuoteSecrets(
  env: QuoteKeysEnv,
  secrets: readonly (readonly [name: string, value: string | undefined])[],
  context: z.RefinementCtx,
): void {
  const quoteSecrets = new Set(quoteKeysOf(env).map((key) => key.secret));
  const reusedBy = secrets
    .filter(([name, value]) => name !== QUOTE_KEYS_NAME && value !== undefined && quoteSecrets.has(value))
    .map(([name]) => name);
  for (const name of new Set(reusedBy)) {
    context.addIssue({ code: 'custom', path: [QUOTE_KEYS_NAME], message: `must not reuse a secret of ${name}` });
  }
}
