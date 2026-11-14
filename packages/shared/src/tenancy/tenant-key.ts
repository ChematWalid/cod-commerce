import { DomainError } from '../errors/domain-error';
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

/** How many characters of a refused part the error message shows. */
const PART_PREVIEW_LENGTH = 32;

/** The tenant a key or object belongs to: a business, optionally narrowed to one of its stores. */
export interface TenantKeyScope {
  readonly businessId: BusinessId;
  readonly storeId?: StoreId;
}

/** Thrown when a key has no part, or a part is empty, reserved or holds a forbidden character. */
export class InvalidTenantKeyPartError extends DomainError {
  readonly code = 'tenancy.invalid-key-part';

  constructor(part: string | undefined) {
    super(`Invalid tenant key part: ${describePart(part)}`);
  }
}

// The part comes from callers' data: bound it and escape it so it cannot flood or inject into logs.
function describePart(part: string | undefined): string {
  if (part === undefined) {
    return 'none given';
  }
  const escaped = JSON.stringify(part.slice(0, PART_PREVIEW_LENGTH)).replace(/[^\x20-\x7e]/gu, '?');
  return part.length > PART_PREVIEW_LENGTH ? `${escaped}…` : escaped;
}

function scopeSegments(scope: TenantKeyScope): readonly string[] {
  const businessId = toBusinessId(scope.businessId);
  const business = [BUSINESS_SEGMENT, businessId];
  if (scope.storeId === undefined) {
    return business;
  }
  return [...business, STORE_SEGMENT, toStoreId(scope.storeId)];
}

function checkedPart(part: string): string {
  const invalid =
    part === '' || RESERVED_PARTS.has(part) || FORBIDDEN_PART_CHARACTERS.test(part) || hasControlCharacter(part);
  if (invalid) {
    throw new InvalidTenantKeyPartError(part);
  }
  return part;
}

/**
 * Builds a tenant-scoped cache, lock or queue key: `b:{businessId}[:s:{storeId}]:{parts}` (ADR 0002 §5).
 *
 * @throws {@link InvalidBusinessIdError} or `InvalidSnowflakeError` (`ids.invalid-snowflake`) when an id of `scope` is invalid
 * @throws {@link InvalidTenantKeyPartError} when no part is given, or a part is empty, is a segment
 *   marker (`b`, `s`), or holds `:`, `/`, a glob character, whitespace or a control character
 */
export function tenantKey(scope: TenantKeyScope, first: string, ...rest: readonly string[]): string {
  // The signature already demands a part; the runtime check covers untyped callers.
  if ((first as unknown) === undefined) {
    throw new InvalidTenantKeyPartError(undefined);
  }
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
