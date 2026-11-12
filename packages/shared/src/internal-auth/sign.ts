import { createHmac } from 'node:crypto';
import { canonicalInternalRequest, type InternalRequest } from './canonical';
import { INTERNAL_AUTH_HEADERS } from './constants';
import type { InternalSigningKey } from './keys';

/** The base64url HMAC-SHA-256 of the canonical string. */
export function internalSignature(canonical: string, key: InternalSigningKey): string {
  return createHmac('sha256', key.secret).update(canonical).digest('base64url');
}

/**
 * The headers to send with `request`: kid, timestamp and signature, plus the store, client address and country the
 * signature covers when set.
 *
 * @throws {RangeError} when a field holds a line break.
 */
export function signInternalRequest(
  request: InternalRequest,
  key: InternalSigningKey,
  nowSeconds: number,
): Readonly<Record<string, string>> {
  const timestamp = Math.floor(nowSeconds);
  const headers: Record<string, string> = {
    [INTERNAL_AUTH_HEADERS.kid]: key.kid,
    [INTERNAL_AUTH_HEADERS.timestamp]: String(timestamp),
    [INTERNAL_AUTH_HEADERS.signature]: internalSignature(canonicalInternalRequest(request, timestamp), key),
  };
  if (request.storeId !== undefined) {
    headers[INTERNAL_AUTH_HEADERS.storeId] = request.storeId;
  }
  if (request.clientIp !== undefined) {
    headers[INTERNAL_AUTH_HEADERS.clientIp] = request.clientIp;
  }
  if (request.clientCountry !== undefined) {
    headers[INTERNAL_AUTH_HEADERS.clientCountry] = request.clientCountry;
  }
  return headers;
}
