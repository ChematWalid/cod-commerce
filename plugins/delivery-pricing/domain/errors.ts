import { DELIVERY_PRICING_ERROR_CODES, DomainError } from '@cod/shared';

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
