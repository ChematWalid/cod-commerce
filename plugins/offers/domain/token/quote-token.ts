import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  MAX_QUOTE_TOKEN_LENGTH,
  PRICING_ID_PATTERN,
  QUOTE_TOKEN_PREFIX,
  QUOTE_TOKEN_VERSION,
  QUOTE_TTL_SECONDS,
} from '@cod/shared';
import { InvalidQuoteKeysError, type QuoteKeyRing } from '@cod/shared/quote-keys';
import { z } from 'zod';
import { BASE64URL_PATTERN, EPOCH_SECONDS_LIMIT, QUOTE_TOKEN_PART_COUNT } from '../constants';
import { UnsignableQuoteError } from '../errors';
import { canonicalJson } from './canonical';
import { phoneKey } from './cart-hash';

const wholeDzd = z.number().int().nonnegative();
const decimalId = z.string().regex(PRICING_ID_PATTERN);

const quotePayloadSchema = z.object({
  v: z.literal(QUOTE_TOKEN_VERSION),
  kid: z.string(),
  b: decimalId,
  s: decimalId,
  h: z.string(),
  p: z.union([z.literal(0), z.literal(1)]),
  exp: z.number().int(),
  t: wholeDzd,
  sh: wholeDzd,
  l: z.array(
    z.object({
      variantId: decimalId,
      qty: z.number().int().positive(),
      unitPrice: wholeDzd,
      originalPrice: wholeDzd,
      offerIds: z.array(decimalId),
    }),
  ),
  d: z.array(z.object({ amount: wholeDzd, offerId: decimalId, code: z.string().optional() })),
  a: z.array(
    z.object({
      variantId: decimalId,
      qty: z.number().int().positive(),
      unitPrice: wholeDzd,
      parentVariantId: decimalId,
    }),
  ),
  n: z.string(),
});

/**
 * The signed payload of a quote token (ADR 0004, D2421): business `b`, store `s`, cart hash `h`, phone flag `p`,
 * total `t`, delivery price `sh`, lines `l`, order discounts `d`, add-ons `a` (empty until P2.S5), expiry `exp`
 * (epoch seconds) and nonce `n`. Ids are decimal strings, since snowflakes exceed 2^53; money is whole DZD.
 */
export type QuotePayload = z.infer<typeof quotePayloadSchema>;

/** What the pricing service commits to; {@link signQuote} adds the version, kid, expiry and nonce. */
export type QuotePayloadBody = Omit<QuotePayload, 'v' | 'kid' | 'exp' | 'n'>;

/** Sign input: `issuedAt` (epoch seconds) and `nonce` are injected, so signing stays pure. */
export interface SignQuoteInput {
  readonly ring: QuoteKeyRing;
  readonly payload: QuotePayloadBody;
  readonly issuedAt: number;
  readonly nonce: string;
}

/** A signed token and its expiry in epoch seconds. */
export interface SignedQuote {
  readonly token: string;
  readonly expiresAt: number;
}

/** Why a token is refused (D2421); an unknown kid reads as `bad_signature`. */
export type QuoteRejectReason =
  'malformed' | 'bad_signature' | 'expired' | 'business_mismatch' | 'store_mismatch' | 'cart_mismatch';

/** The verdict on a token: its payload once every check passed, else the first failed check. */
export type QuoteVerification =
  { readonly ok: true; readonly payload: QuotePayload } | { readonly ok: false; readonly reason: QuoteRejectReason };

/**
 * What the token must match: the host-resolved business and store, the buyer's E.164 phone (or null) and the hash of
 * the submitted cart for a phone key or null; the verifier passes the phone key only when the token's `p` is 1.
 */
export interface QuoteTokenExpectation {
  readonly businessId: string;
  readonly storeId: string;
  readonly phone: string | null;
  readonly cartHashFor: (phoneKey: string | null) => string;
}

/** Verify input: `now` in epoch seconds, injected. */
export interface VerifyQuoteTokenInput {
  readonly ring: QuoteKeyRing;
  readonly token: string;
  readonly now: number;
  readonly expect: QuoteTokenExpectation;
}

const hmacOf = (key: string, signed: string): string =>
  createHmac('sha256', key).update(signed, 'ascii').digest('base64url');

const refused = (reason: QuoteRejectReason): QuoteVerification => ({ ok: false, reason });

const isEpochSeconds = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0 && value < EPOCH_SECONDS_LIMIT;

/** The full payload to sign, checked against the schema verify applies, so the server never issues a dead token. */
function payloadToSign(input: SignQuoteInput, kid: string): QuotePayload {
  if (!isEpochSeconds(input.issuedAt)) throw new UnsignableQuoteError('issuedAt is not integer epoch seconds');
  const exp = input.issuedAt + QUOTE_TTL_SECONDS;
  const parsed = quotePayloadSchema.safeParse({ ...input.payload, v: QUOTE_TOKEN_VERSION, kid, exp, n: input.nonce });
  if (!parsed.success) throw new UnsignableQuoteError('the payload breaks the token schema');
  return parsed.data;
}

/**
 * Signs a quote with the ring's active key: `qt1.<base64url canonical JSON>.<base64url HMAC-SHA256>` over the ASCII
 * bytes `qt1.<payload>`, valid for {@link QUOTE_TTL_SECONDS}. Every token it returns passes verify's shape checks.
 *
 * @throws {InvalidQuoteKeysError} when the ring has no key for its active kid.
 * @throws {UnsignableQuoteError} when `issuedAt` is not integer epoch seconds, the payload breaks the token schema, or
 * the token would be longer than {@link MAX_QUOTE_TOKEN_LENGTH}.
 */
export function signQuote(input: SignQuoteInput): SignedQuote {
  const kid = input.ring.activeKid;
  const key = input.ring.keyOf(kid);
  if (key === undefined) throw new InvalidQuoteKeysError(`the active kid ${kid} has no key`);
  const payload = payloadToSign(input, kid);
  const signed = `${QUOTE_TOKEN_PREFIX}.${Buffer.from(canonicalJson(payload), 'utf8').toString('base64url')}`;
  const token = `${signed}.${hmacOf(key, signed)}`;
  if (token.length > MAX_QUOTE_TOKEN_LENGTH) {
    throw new UnsignableQuoteError(`the token is longer than ${String(MAX_QUOTE_TOKEN_LENGTH)} characters`);
  }
  return { token, expiresAt: payload.exp };
}

interface TokenParts {
  readonly signed: string;
  readonly payload: string;
  readonly signature: string;
}

/** The three parts of a token, or null when its length, prefix or alphabet is wrong; nothing is decoded yet. */
function splitToken(token: unknown): TokenParts | null {
  if (typeof token !== 'string' || token.length > MAX_QUOTE_TOKEN_LENGTH) return null;
  const parts = token.split('.');
  if (parts.length !== QUOTE_TOKEN_PART_COUNT) return null;
  const [prefix = '', payload = '', signature = ''] = parts;
  if (prefix !== QUOTE_TOKEN_PREFIX || !BASE64URL_PATTERN.test(payload) || !BASE64URL_PATTERN.test(signature))
    return null;
  return { signed: `${prefix}.${payload}`, payload, signature };
}

/** The decoded payload JSON, or undefined when it is not JSON: a malformed token is an answer, not an error. */
function decodedPayload(payload: string): unknown {
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return undefined;
  }
}

/** The kid of a decoded payload, read before the signature only to pick the key. */
function kidOf(decoded: unknown): string | null {
  if (typeof decoded !== 'object' || decoded === null) return null;
  const kid: unknown = (decoded as { kid?: unknown }).kid;
  return typeof kid === 'string' ? kid : null;
}

/** Constant-time comparison of the transmitted signature with the expected one. */
function signatureMatches(key: string, parts: TokenParts): boolean {
  const expected = Buffer.from(hmacOf(key, parts.signed), 'ascii');
  const given = Buffer.from(parts.signature, 'ascii');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The phone key `h` was computed with: null when `p` is 0, undefined when `p` is 1 and no phone was given. */
function phoneKeyFor(payload: QuotePayload, key: string, phone: string | null): string | null | undefined {
  if (payload.p === 0) return null;
  return phone === null ? undefined : phoneKey(key, phone);
}

/** Expiry, business, store and cart checks of a payload whose signature already passed. */
function checkClaims(payload: QuotePayload, key: string, input: VerifyQuoteTokenInput): QuoteVerification {
  const { expect } = input;
  if (input.now >= payload.exp) return refused('expired');
  if (payload.b !== expect.businessId) return refused('business_mismatch');
  if (payload.s !== expect.storeId) return refused('store_mismatch');
  const phoneKeyOfCart = phoneKeyFor(payload, key, expect.phone);
  if (phoneKeyOfCart === undefined || expect.cartHashFor(phoneKeyOfCart) !== payload.h) return refused('cart_mismatch');
  return { ok: true, payload };
}

/**
 * Verifies a quote token (D2421). Order: length, shape and prefix; then the HMAC over the transmitted `qt1.<payload>`
 * with the key of the payload's kid, before any other field is trusted; then the payload's types; then expiry (a token
 * fails at `exp`), business, store and the cart hash. Never throws on any input.
 */
export function verifyQuoteToken(input: VerifyQuoteTokenInput): QuoteVerification {
  const parts = splitToken(input.token);
  if (parts === null) return refused('malformed');
  const decoded = decodedPayload(parts.payload);
  const kid = kidOf(decoded);
  if (kid === null) return refused('malformed');
  const key = input.ring.keyOf(kid);
  if (key === undefined || !signatureMatches(key, parts)) return refused('bad_signature');
  const parsed = quotePayloadSchema.safeParse(decoded);
  if (!parsed.success) return refused('malformed');
  return checkClaims(parsed.data, key, input);
}
