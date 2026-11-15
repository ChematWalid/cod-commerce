import { createHmac } from 'node:crypto';
import type { QuoteKeyRing } from '@cod/shared/quote-keys';
import { canonicalJson } from '../../domain/token/canonical';
import { cartHash, type CartHashInput } from '../../domain/token/cart-hash';
import {
  signQuote,
  type QuotePayload,
  type QuotePayloadBody,
  type QuoteTokenExpectation,
  type VerifyQuoteTokenInput,
} from '../../domain/token/quote-token';
import { aQuoteKeyRing } from './quote-keys';

/** Epoch seconds the token tests issue at. */
export const ISSUED_AT = 1_795_400_000;
/** A synthetic 96-bit nonce, base64url. */
export const NONCE = 'AAECAwQFBgcICQoL';
export const BUSINESS_ID = '7390000000000000001';
export const STORE_ID = '7390000000000000002';
export const PHONE = '+213555123456';

/** The ring of most tests: one key `k1`, active. */
export const RING_K1 = aQuoteKeyRing(['k1'], 'k1');

/** The cart the test tokens commit to, with `phoneKey` filled by the verifier. */
export const aCartFor = (phoneKey: string | null): CartHashInput => ({
  channel: 'storefront',
  lines: [{ variantId: '7', quantity: 2 }],
  destination: { provinceCode: '16', stopdesk: false },
  codes: [],
  phoneKey,
});

/** The payload body of the brief's first worked example: 4,900 × 2 at −10 %, delivery not resolved. */
export const aBody = (overrides: Partial<QuotePayloadBody> = {}): QuotePayloadBody => ({
  b: BUSINESS_ID,
  s: STORE_ID,
  h: cartHash(aCartFor(null)),
  p: 0,
  t: 8_820,
  sh: 0,
  l: [{ variantId: '7', qty: 2, unitPrice: 4_410, originalPrice: 4_900, offerIds: ['7001'] }],
  d: [],
  a: [],
  ...overrides,
});

/** A token of `body` signed by the active key of `ring` at {@link ISSUED_AT}. */
export const aToken = (body: QuotePayloadBody = aBody(), ring: QuoteKeyRing = RING_K1): string =>
  signQuote({ ring, payload: body, issuedAt: ISSUED_AT, nonce: NONCE }).token;

/** What the verifier of store {@link STORE_ID} expects for the cart of {@link aCartFor}. */
export const anExpectation = (overrides: Partial<QuoteTokenExpectation> = {}): QuoteTokenExpectation => ({
  businessId: BUSINESS_ID,
  storeId: STORE_ID,
  phone: null,
  cartHashFor: (phoneKey) => cartHash(aCartFor(phoneKey)),
  ...overrides,
});

/** A verify input for `token` checked one second after issue with `ring`. */
export const aVerifyInput = (token: string, overrides: Partial<VerifyQuoteTokenInput> = {}): VerifyQuoteTokenInput => ({
  ring: RING_K1,
  token,
  now: ISSUED_AT + 1,
  expect: anExpectation(),
  ...overrides,
});

const base64url = (text: string): string => Buffer.from(text, 'utf8').toString('base64url');

/** The decoded payload of `token`. */
export const payloadOf = (token: string): QuotePayload =>
  JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as QuotePayload;

/** `token` with its payload changed by `change`, keeping the original signature. */
export function tampered(token: string, change: (payload: QuotePayload) => void): string {
  const [prefix, , signature] = token.split('.');
  const payload = payloadOf(token);
  change(payload);
  return `${prefix ?? ''}.${base64url(canonicalJson(payload))}.${signature ?? ''}`;
}

/** A correctly signed token over any payload, as a holder of key `k1` could forge it. */
export function signedRaw(payload: unknown, secret: string): string {
  const signed = `qt1.${base64url(canonicalJson(payload))}`;
  return `${signed}.${createHmac('sha256', secret).update(signed, 'ascii').digest('base64url')}`;
}
