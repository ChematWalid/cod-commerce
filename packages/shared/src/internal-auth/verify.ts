import { timingSafeEqual } from 'node:crypto';
import { canonicalInternalRequest, hasLineBreak, type InternalRequest } from './canonical';
import { INTERNAL_AUTH_HEADERS, INTERNAL_AUTH_MAX_SKEW_SECONDS } from './constants';
import type { InternalSigningKey } from './keys';
import { internalSignature } from './sign';

/** Why a request failed verification. `bad-signature` also covers a tampered store, address or country. */
export type InternalVerifyFailure = 'missing' | 'malformed' | 'unknown-kid' | 'stale' | 'bad-signature';

export type InternalVerifyResult = { ok: true; kid: string } | { ok: false; reason: InternalVerifyFailure };

const TIMESTAMP = /^\d{1,12}$/;

const fail = (reason: InternalVerifyFailure): InternalVerifyResult => ({ ok: false, reason });

/**
 * Checks the `x-internal-*` headers of `request` against `keys` at `nowSeconds`. `request` carries the store,
 * client address and country as the receiver read them, so changing one fails the signature. The signature
 * comparison is constant-time. A replay inside the skew window passes (no nonce, ADR 0008).
 */
export function verifyInternalRequest(
  request: InternalRequest,
  headers: Readonly<Record<string, string | undefined>>,
  keys: readonly InternalSigningKey[],
  nowSeconds: number,
): InternalVerifyResult {
  const kid = headers[INTERNAL_AUTH_HEADERS.kid];
  const timestamp = headers[INTERNAL_AUTH_HEADERS.timestamp];
  const signature = headers[INTERNAL_AUTH_HEADERS.signature];
  if (!kid || !timestamp || !signature) {
    return fail('missing');
  }
  if (!TIMESTAMP.test(timestamp) || hasLineBreak(request)) {
    return fail('malformed');
  }
  const key = keys.find((candidate) => candidate.kid === kid);
  if (key === undefined) {
    return fail('unknown-kid');
  }
  const seconds = Number(timestamp);
  if (Math.abs(nowSeconds - seconds) > INTERNAL_AUTH_MAX_SKEW_SECONDS) {
    return fail('stale');
  }
  const expected = Buffer.from(internalSignature(canonicalInternalRequest(request, seconds), key));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return fail('bad-signature');
  }
  return { ok: true, kid: key.kid };
}
