import { DomainError } from '../errors/domain-error';
import { previewValue } from '../errors/value-preview';
import { hasControlCharacter } from '../text/control-characters';
import { toStoreId, type StoreId } from './tenant-context';
import { type BusinessId, toBusinessId } from './tenant-scope';

/** Separator of cache, lock and queue keys (`b:1:s:2:name`). */
const KEY_SEPARATOR = ':';

/** Separator of object-storage keys (`b/1/s/2/`). */
const OBJECT_SEPARATOR = '/';

/** Marks the business segment of a key or object prefix (ADR 0002 §5). */
const BUSINESS_SEGMENT = 'b';

/** Marks the store segment of a key or object prefix (ADR 0002 §5). */
const STORE_SEGMENT = 's';

/**
 * A part may not hold a separator, so it cannot add a segment, nor whitespace or a Valkey glob
 * character, so a key used as a SCAN MATCH pattern never widens to other keys.
 */
const FORBIDDEN_PART_CHARACTERS = /[:/*?[\]\\\s]/u;

/**
 * Segment markers may not stand alone as a part: `tenantKey({b: 1}, 's', '2', 'x')` would spell
 * the store key `b:1:s:2:x`.
 */
const RESERVED_PARTS: ReadonlySet<string> = new Set([BUSINESS_SEGMENT, STORE_SEGMENT]);

/**
 * A lone UTF-16 surrogate becomes U+FFFD once UTF-8 encoded for Valkey or the object store, so two
 * different parts would collide on the wire.
 */
const LONE_SURROGATE = /\p{Cs}/u;

/** Path segments that would climb out of, or stay at, the tenant prefix on path-normalising stores. */
const DOT_SEGMENTS: ReadonlySet<string> = new Set(['.', '..']);

/**
 * `%` is refused in object parts: a store or proxy that percent-decodes before normalising the path
 * would read `%2e%2e` as `..` and `%2F` as `/`, climbing into another tenant's prefix.
 */
const PERCENT_ENCODING = /%/u;

/** Longest object key S3 and R2 accept, counted in UTF-8 bytes. */
export const MAX_OBJECT_KEY_BYTES = 1024;

const utf8 = new TextEncoder();

/** The tenant a key or object belongs to: a business, optionally narrowed to one of its stores. */
export interface TenantKeyScope {
  readonly businessId: BusinessId;
  readonly storeId?: StoreId;
}

/**
 * Thrown when a key has no part, or a part is not a string, is empty, is reserved, is not well-formed
 * UTF-16 or holds a forbidden character.
 */
export class InvalidTenantKeyPartError extends DomainError {
  readonly code = 'tenancy.invalid-key-part';

  constructor(part: unknown) {
    super(`Invalid tenant key part: ${previewValue(part)}`);
  }
}

/** Thrown when a tenant object key is longer than {@link MAX_OBJECT_KEY_BYTES} once UTF-8 encoded. */
export class ObjectKeyTooLongError extends DomainError {
  readonly code = 'tenancy.object-key-too-long';

  constructor(byteLength: number) {
    super(`Tenant object key is ${String(byteLength)} bytes, over the ${String(MAX_OBJECT_KEY_BYTES)}-byte limit`);
  }
}

function scopeSegments(scope: TenantKeyScope): readonly string[] {
  const businessId = toBusinessId(scope.businessId);
  const business = [BUSINESS_SEGMENT, businessId];
  if (scope.storeId === undefined) {
    return business;
  }
  return [...business, STORE_SEGMENT, toStoreId(scope.storeId)];
}

function isValidPart(part: string): boolean {
  return !(
    part === '' ||
    RESERVED_PARTS.has(part) ||
    FORBIDDEN_PART_CHARACTERS.test(part) ||
    LONE_SURROGATE.test(part) ||
    hasControlCharacter(part)
  );
}

// `unknown`: JavaScript or deserialised callers bypass the signature and must still get the typed error.
function checkedPart(part: unknown): string {
  if (typeof part !== 'string' || !isValidPart(part)) {
    throw new InvalidTenantKeyPartError(part);
  }
  return part;
}

function checkedObjectPart(part: unknown): string {
  if (typeof part === 'string' && (DOT_SEGMENTS.has(part) || PERCENT_ENCODING.test(part))) {
    throw new InvalidTenantKeyPartError(part);
  }
  return checkedPart(part);
}

/**
 * Builds a tenant-scoped cache, lock or queue key: `b:{businessId}[:s:{storeId}]:{parts}` (ADR 0002 §5).
 *
 * @throws {@link InvalidBusinessIdError} or `InvalidSnowflakeError` (`ids.invalid-snowflake`) when an id of `scope` is invalid
 * @throws {@link InvalidTenantKeyPartError} when no part is given, or a part is not a string, is empty,
 *   is a segment marker (`b`, `s`), holds a lone surrogate, or holds `:`, `/`, a glob character,
 *   whitespace or a control character
 */
export function tenantKey(scope: TenantKeyScope, first: string, ...rest: readonly string[]): string {
  return [...scopeSegments(scope), ...[first, ...rest].map(checkedPart)].join(KEY_SEPARATOR);
}

/**
 * Builds the object-storage prefix of a tenant: `b/{businessId}/s/{storeId}/`, or `b/{businessId}/`
 * without a store (ADR 0002 §5, D2113).
 *
 * @throws {@link InvalidBusinessIdError} or `InvalidSnowflakeError` (`ids.invalid-snowflake`) when an id of `scope` is invalid
 */
export function tenantObjectPrefix(scope: TenantKeyScope): string {
  return `${scopeSegments(scope).join(OBJECT_SEPARATOR)}${OBJECT_SEPARATOR}`;
}

/**
 * Builds a full tenant object key: `b/{businessId}[/s/{storeId}]/{parts joined by '/'}` (ADR 0002 §5).
 * Prefer it to appending to {@link tenantObjectPrefix}: each part is checked, so a business object
 * can never start with a store segment nor climb out of its prefix through a literal or
 * percent-encoded dot segment or separator.
 *
 * @throws {@link InvalidBusinessIdError} or `InvalidSnowflakeError` (`ids.invalid-snowflake`) when an id of `scope` is invalid
 * @throws {@link InvalidTenantKeyPartError} on the {@link tenantKey} part rules, for a `.` or `..` part,
 *   and for a part holding `%`
 * @throws {@link ObjectKeyTooLongError} when the key is longer than {@link MAX_OBJECT_KEY_BYTES} in UTF-8
 */
export function tenantObjectKey(scope: TenantKeyScope, first: string, ...rest: readonly string[]): string {
  const key = `${tenantObjectPrefix(scope)}${[first, ...rest].map(checkedObjectPart).join(OBJECT_SEPARATOR)}`;
  const byteLength = utf8.encode(key).length;
  if (byteLength > MAX_OBJECT_KEY_BYTES) {
    throw new ObjectKeyTooLongError(byteLength);
  }
  return key;
}
