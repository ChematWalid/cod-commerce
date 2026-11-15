import { DomainError, PRICING_ERROR_CODES } from '@cod/shared';

/** No offer with that id in the active store; a foreign or malformed id answers the same. */
export class OfferNotFoundError extends DomainError {
  readonly code = PRICING_ERROR_CODES.OFFER_NOT_FOUND;
  constructor() {
    super('No such offer');
  }
}

/** An offer, its targets or its kind configuration breaks a rule; the message never repeats the value. */
export class InvalidOfferConfigError extends DomainError {
  readonly code = PRICING_ERROR_CODES.INVALID_CONFIG;
  constructor() {
    super('Invalid offer configuration');
  }
}

/** No calculator of the kind registry handles that kind (D2404). */
export class UnknownOfferKindError extends DomainError {
  readonly code = PRICING_ERROR_CODES.UNKNOWN_KIND;
  constructor() {
    super('Unknown offer kind');
  }
}

/** The store already has that code, on this offer or another (D2406). */
export class CodeTakenError extends DomainError {
  readonly code = PRICING_ERROR_CODES.CODE_TAKEN;
  constructor() {
    super('This code is already used in the store');
  }
}

/** The offer cannot move from its status to the asked one. */
export class InvalidOfferTransitionError extends DomainError {
  readonly code = PRICING_ERROR_CODES.INVALID_TRANSITION;
  constructor() {
    super('This status change is not allowed');
  }
}

/** The offer changed since it was read (another edit or status change won); the caller reads it again. */
export class OfferConflictError extends DomainError {
  readonly code = PRICING_ERROR_CODES.OFFER_CONFLICT;
  constructor() {
    super('The offer changed since it was read');
  }
}

/** A quote total exceeds the money range (D2415). */
export class PricingTotalTooLargeError extends DomainError {
  readonly code = PRICING_ERROR_CODES.TOTAL_TOO_LARGE;
  constructor() {
    super('The order total is too large');
  }
}

/** A quote request breaks its schema (D2418, D2429); the message never repeats the input. */
export class InvalidQuoteRequestError extends DomainError {
  readonly code = PRICING_ERROR_CODES.INVALID_REQUEST;
  constructor() {
    super('Invalid quote request');
  }
}

/** The request context is not on the channel of the store it prices (D2408). */
export class NoActiveStoreError extends DomainError {
  readonly code = PRICING_ERROR_CODES.NO_ACTIVE_STORE;
  constructor() {
    super('No active store');
  }
}

/**
 * The server asked to sign a quote it could not redeem: `issuedAt` is not integer epoch seconds, the payload breaks
 * the token schema, or the token is longer than `MAX_QUOTE_TOKEN_LENGTH` (D2421). A server fault, never buyer input,
 * so it is not a domain error; the message never repeats a value.
 */
export class UnsignableQuoteError extends Error {
  constructor(reason: string) {
    super(`Cannot sign the quote: ${reason}`);
    this.name = 'UnsignableQuoteError';
  }
}
