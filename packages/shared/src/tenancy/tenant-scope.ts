import { DomainError } from '../errors/domain-error';

/** A business (tenant) id: a positive 63-bit integer in decimal form (ADR 0003). */
export type BusinessId = string & { readonly __brand: 'BusinessId' };

/** The business every tenant-scoped operation runs for (ADR 0002). */
export interface TenantScope {
  readonly businessId: BusinessId;
}

/** Largest business id: 2^63 − 1, the maximum of a Postgres `bigint` (ADR 0003). */
export const MAX_BUSINESS_ID = 9223372036854775807n;

const BUSINESS_ID_FORMAT = /^[1-9][0-9]{0,18}$/;

/** Thrown when a value is not a valid {@link BusinessId}. */
export class InvalidBusinessIdError extends DomainError {
  readonly code = 'tenancy.invalid-business-id';

  constructor(value: string) {
    super(`Invalid business id: "${value}"`);
  }
}

/**
 * Validates and brands a business id.
 *
 * @throws {@link InvalidBusinessIdError} unless `value` is a decimal integer from 1 to {@link MAX_BUSINESS_ID}
 * without leading zeros.
 */
export function toBusinessId(value: string): BusinessId {
  if (!BUSINESS_ID_FORMAT.test(value) || BigInt(value) > MAX_BUSINESS_ID) {
    throw new InvalidBusinessIdError(value);
  }
  return value as BusinessId;
}
