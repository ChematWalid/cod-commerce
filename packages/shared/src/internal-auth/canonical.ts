import { createHash } from 'node:crypto';
import { INTERNAL_AUTH_VERSION } from './constants';

/** The parts of a request the signature covers. */
export interface InternalRequest {
  readonly method: string;
  /** The path and query exactly as sent, from the original URL (not a prefix-stripped one). */
  readonly pathWithQuery: string;
  readonly body: Uint8Array | string;
  readonly storeId?: string;
  readonly clientIp?: string;
  readonly clientCountry?: string;
}

/** True when a field would break the one-field-per-line layout of the canonical string. */
export function hasLineBreak(request: InternalRequest): boolean {
  return [request.method, request.pathWithQuery, request.storeId, request.clientIp, request.clientCountry].some(
    (field) => field !== undefined && /[\r\n]/.test(field),
  );
}

/**
 * The string that is signed (D111): the version, the upper-case method, the path with query, the timestamp, the
 * store id, the client address and country (empty when absent) and the lower-case hex SHA-256 of the body, one per line.
 *
 * @throws {RangeError} when a field holds a line break.
 */
export function canonicalInternalRequest(request: InternalRequest, timestampSeconds: number): string {
  if (hasLineBreak(request)) {
    throw new RangeError('an internal request field holds a line break');
  }
  return [
    INTERNAL_AUTH_VERSION,
    request.method.toUpperCase(),
    request.pathWithQuery,
    String(timestampSeconds),
    request.storeId ?? '',
    request.clientIp ?? '',
    request.clientCountry ?? '',
    createHash('sha256').update(request.body).digest('hex'),
  ].join('\n');
}
