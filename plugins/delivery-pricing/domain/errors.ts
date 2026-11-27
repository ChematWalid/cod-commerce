import { type BusinessId, DELIVERY_PRICING_ERROR_CODES, DomainError, type StoreId } from '@cod/shared';
import { CONVERGE_REPORTED_FAILURES } from './constants';

const C = DELIVERY_PRICING_ERROR_CODES;

/** A fee-group body that breaks its schema, or a commune outside its wilaya; the value is never repeated. */
export class InvalidDeliveryFeeInputError extends DomainError {
  readonly code = C.INVALID_INPUT;
  constructor() {
    super('Invalid delivery fee input');
  }
}

/** No fee group with that id in the active store; a foreign, other-store or malformed id answers the same. */
export class DeliveryFeeGroupNotFoundError extends DomainError {
  readonly code = C.NOT_FOUND;
  constructor() {
    super('No such delivery fee group');
  }
}

/** The group is the store's default or its platform default, so it cannot be deleted (D3108). */
export class DeliveryFeeGroupInUseError extends DomainError {
  readonly code = C.GROUP_IN_USE;
  constructor() {
    super('The delivery fee group is in use');
  }
}

/** A carrier id no carrier of the store holds: every non-null id until P5.S1 (D3109). */
export class DeliveryCarrierNotFoundError extends DomainError {
  readonly code = C.CARRIER_NOT_FOUND;
  constructor() {
    super('No such carrier');
  }
}

/** A pricing CSV that is not strict UTF-8 CSV text with each expected column once (D3142); nothing is quoted back. */
export class InvalidPricingCsvFileError extends DomainError {
  readonly code = C.CSV_INVALID_FILE;
  constructor() {
    super('Invalid pricing CSV file');
  }
}

/** A pricing CSV above `PRICING_CSV_MAX_BYTES` (D3142). */
export class PricingCsvTooLargeError extends DomainError {
  readonly code = C.CSV_TOO_LARGE;
  constructor() {
    super('The pricing CSV file is too large');
  }
}

/** A pricing CSV with more rows than the option's wilayas and their communes, plus the header (D3142). */
export class PricingCsvTooManyRowsError extends DomainError {
  readonly code = C.CSV_TOO_MANY_ROWS;
  constructor() {
    super('The pricing CSV file has too many rows');
  }
}

/** An apply of a pricing CSV with refused rows; nothing is written and a dry run lists the rows (D3142). */
export class InvalidPricingCsvRowsError extends DomainError {
  readonly code = C.CSV_INVALID_ROWS;
  constructor() {
    super('The pricing CSV file has refused rows');
  }
}

/** One store the default-table converge could not link, and why. */
export interface DeliveryDefaultsConvergeFailure {
  readonly businessId: BusinessId;
  readonly storeId: StoreId;
  readonly reason: string;
}

/**
 * Some stores could not be linked to a default table; every other store was committed, and a later migrate retries
 * these (D3112). A platform fault, not a caller's input, so it is a plain `Error` like rbac's converge failure.
 */
export class DeliveryDefaultsConvergeFailedError extends Error {
  constructor(
    readonly stores: number,
    readonly failures: readonly DeliveryDefaultsConvergeFailure[],
  ) {
    const listed = failures.slice(0, CONVERGE_REPORTED_FAILURES).map(({ storeId, reason }) => `${storeId}: ${reason}`);
    const omitted = failures.length - listed.length;
    const more = omitted > 0 ? `; and ${String(omitted)} more` : '';
    super(
      `${String(failures.length)} of ${String(stores)} stores failed to link a default table: ${listed.join('; ')}${more}`,
    );
    this.name = 'DeliveryDefaultsConvergeFailedError';
  }
}

/**
 * A carrier answered rates a sync cannot merge (a bad price, wilaya or commune, a key named twice, a commune of another
 * wilaya); nothing is written. A carrier adapter's fault, not a caller's input, so a plain `Error`.
 */
export class InvalidCarrierRatesError extends Error {
  constructor(readonly reason: string) {
    super(`Carrier rates refused: ${reason}`);
    this.name = 'InvalidCarrierRatesError';
  }
}
