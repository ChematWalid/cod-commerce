import {
  COLLECTION_MAX_MANUAL_PRODUCTS,
  COLLECTIONS_ERROR_CODES,
  COLLECTIONS_PER_STORE_MAX,
  DomainError,
} from '@cod/shared';
import { MIN_RETRY_AFTER_SECONDS } from './constants';

/** No collection with that id in the active store; a foreign or malformed id answers the same. */
export class CollectionNotFoundError extends DomainError {
  readonly code = COLLECTIONS_ERROR_CODES.NOT_FOUND;
  constructor() {
    super('No such collection');
  }
}

/** Input that breaks a collections rule; the message never repeats the value. */
export class InvalidCollectionInputError extends DomainError {
  readonly code = COLLECTIONS_ERROR_CODES.INVALID_INPUT;
  constructor() {
    super('Invalid collection input');
  }
}

/** A rule that does not follow the stored rule shape, or an automatic collection without one (D2303). */
export class InvalidCollectionRuleError extends DomainError {
  readonly code = COLLECTIONS_ERROR_CODES.RULE_INVALID;
  constructor() {
    super('Invalid collection rule');
  }
}

/** Another collection of the store already uses that slug (D2319). */
export class CollectionSlugTakenError extends DomainError {
  readonly code = COLLECTIONS_ERROR_CODES.SLUG_TAKEN;
  constructor() {
    super('This slug is already used by another collection');
  }
}

/** The image is not an asset of the store (D2320). */
export class CollectionImageNotFoundError extends DomainError {
  readonly code = COLLECTIONS_ERROR_CODES.IMAGE_NOT_FOUND;
  constructor() {
    super('No such image');
  }
}

/** A product named in a manual collection is not a product of the store. */
export class CollectionProductNotFoundError extends DomainError {
  readonly code = COLLECTIONS_ERROR_CODES.PRODUCT_NOT_FOUND;
  constructor() {
    super('No such product');
  }
}

/** A manual collection would hold more than {@link COLLECTION_MAX_MANUAL_PRODUCTS} products (D2322, D2337). */
export class TooManyManualProductsError extends DomainError {
  readonly code = COLLECTIONS_ERROR_CODES.TOO_MANY_PRODUCTS;
  constructor() {
    super(`A manual collection holds at most ${String(COLLECTION_MAX_MANUAL_PRODUCTS)} products`);
  }
}

/** The store would hold more than {@link COLLECTIONS_PER_STORE_MAX} collections (D2322). */
export class TooManyCollectionsError extends DomainError {
  readonly code = COLLECTIONS_ERROR_CODES.TOO_MANY_COLLECTIONS;
  constructor() {
    super(`A store holds at most ${String(COLLECTIONS_PER_STORE_MAX)} collections`);
  }
}

/** Products are picked by hand only in a manual collection (D2302). */
export class CollectionNotManualError extends DomainError {
  readonly code = COLLECTIONS_ERROR_CODES.NOT_MANUAL;
  constructor() {
    super('This collection gets its products from its rule');
  }
}

/** Too many previews or rule-option reads by one member in the window (D2338); says when to come back. */
export class CollectionsRateLimitedError extends DomainError {
  readonly code = COLLECTIONS_ERROR_CODES.RATE_LIMITED;
  constructor(readonly retryAfterSeconds: number = MIN_RETRY_AFTER_SECONDS) {
    super('Too many requests, try again shortly');
  }
}
