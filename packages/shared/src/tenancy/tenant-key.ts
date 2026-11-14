import { DomainError } from '../errors/domain-error';
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

/** A part may not hold a separator, so no part can forge another tenant's segment. */
const FORBIDDEN_PART_CHARACTERS = /[:/]/;

/** The tenant a key or object belongs to: a business, optionally narrowed to one of its stores. */
export interface TenantKeyScope {
  readonly businessId: BusinessId;
  readonly storeId?: StoreId;
}

/** Thrown when a key part is empty or holds a separator. */
export class InvalidTenantKeyPartError extends DomainError {
  readonly code = 'tenancy.invalid-key-part';

  constructor(part: string) {
    super(`Invalid tenant key part: "${part}"`);
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

function checkedPart(part: string): string {
  if (part === '' || FORBIDDEN_PART_CHARACTERS.test(part)) {
    throw new InvalidTenantKeyPartError(part);
  }
  return part;
}

/**
 * Builds a tenant-scoped cache, lock or queue key: `b:{businessId}[:s:{storeId}]:{parts}` (ADR 0002 §5).
 *
 * @throws {@link InvalidBusinessIdError} or `InvalidSnowflakeError` when an id of `scope` is invalid
 * @throws {@link InvalidTenantKeyPartError} when a part is empty or holds `:` or `/`
 */
export function tenantKey(scope: TenantKeyScope, ...parts: readonly string[]): string {
  return [...scopeSegments(scope), ...parts.map(checkedPart)].join(KEY_SEPARATOR);
}

/**
 * Builds the object-storage prefix of a tenant: `b/{businessId}/s/{storeId}/`, or `b/{businessId}/`
 * without a store (ADR 0002 §5, D2113).
 *
 * @throws {@link InvalidBusinessIdError} or `InvalidSnowflakeError` when an id of `scope` is invalid
 */
export function tenantObjectPrefix(scope: TenantKeyScope): string {
  return `${scopeSegments(scope).join(OBJECT_SEPARATOR)}${OBJECT_SEPARATOR}`;
}
