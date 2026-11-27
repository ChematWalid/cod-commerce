import { DomainError, GEO_ERROR_CODES } from '@cod/shared';

/** The code parameter names no wilaya: malformed, out of range or not seeded (D3115). */
export class ProvinceNotFoundError extends DomainError {
  readonly code = GEO_ERROR_CODES.PROVINCE_NOT_FOUND;

  constructor() {
    super('Province not found');
  }
}

/** The `storeId` of a signed call is missing, malformed, unknown, archived or of a suspended business (D3106). */
export class GeoStoreNotFoundError extends DomainError {
  readonly code = GEO_ERROR_CODES.STORE_NOT_FOUND;

  constructor() {
    super('Store not found');
  }
}
