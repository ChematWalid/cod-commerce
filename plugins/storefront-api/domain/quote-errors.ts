/**
 * The storefront quote API's own errors (D3303): adapters translate the offers' and delivery pricing's errors into
 * these, so `api/` maps one family and never imports another plugin's errors.
 */

/** A quote body the shared contract refuses; `code` is the stable code the caller reads, never a message. */
export class QuoteRequestInvalidError extends Error {
  constructor(readonly code: string) {
    super('the quote request is invalid');
    this.name = 'QuoteRequestInvalidError';
  }
}

/** A quote whose total would pass the largest amount money may hold. */
export class QuoteTotalTooLargeError extends Error {
  constructor() {
    super('the quote total is too large');
    this.name = 'QuoteTotalTooLargeError';
  }
}

/** The signed store cannot be quoted for (no active store behind the context). */
export class QuoteStoreUnavailableError extends Error {
  constructor() {
    super('the store cannot be quoted for');
    this.name = 'QuoteStoreUnavailableError';
  }
}
