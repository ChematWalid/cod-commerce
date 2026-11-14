import { CATALOG_ERROR_CODES, DomainError } from '@cod/shared';

/** No product with that id in the active store; a foreign or malformed id answers the same (D2136). */
export class ProductNotFoundError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND;
  constructor() {
    super('No such product');
  }
}

/** Input that breaks a catalog rule; the message never repeats the value. */
export class InvalidCatalogInputError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.INVALID_INPUT;
  constructor() {
    super('Invalid catalog input');
  }
}

/** A product names more highlights than `MAX_PRODUCT_HIGHLIGHTS` (brief AC3). */
export class TooManyHighlightsError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.TOO_MANY_HIGHLIGHTS;
  constructor() {
    super('A product shows at most six highlights');
  }
}

/** The options exceed a matrix cap: groups, values per group or variants (D2124). */
export class MatrixTooLargeError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.MATRIX_TOO_LARGE;
  constructor() {
    super('These options make too many variants');
  }
}

/** One option lists the same value twice, compared without case and Unicode form. */
export class DuplicateOptionValueError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.DUPLICATE_OPTION_VALUE;
  constructor() {
    super('An option lists the same value twice');
  }
}

/** Two options of one product share a name, compared without case and Unicode form. */
export class DuplicateOptionNameError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.DUPLICATE_OPTION_NAME;
  constructor() {
    super('Two options have the same name');
  }
}

/** No brand with that id in the active store. */
export class BrandNotFoundError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.BRAND_NOT_FOUND;
  constructor() {
    super('No such brand');
  }
}

/** No tag with that id in the active store. */
export class TagNotFoundError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.TAG_NOT_FOUND;
  constructor() {
    super('No such tag');
  }
}

/** No highlight with that id in the active store. */
export class HighlightNotFoundError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.HIGHLIGHT_NOT_FOUND;
  constructor() {
    super('No such highlight');
  }
}

/** No media item with that id among the stores the caller may reach (D2132). */
export class MediaNotFoundError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.MEDIA_NOT_FOUND;
  constructor() {
    super('No such media item');
  }
}

/** An upload larger than `MEDIA_MAX_BYTES` (D2113). */
export class MediaTooLargeError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.MEDIA_TOO_LARGE;
  constructor() {
    super('This file is too large');
  }
}

/** An upload whose content is not a PNG, JPEG, GIF or WebP image (D2113). */
export class MediaTypeError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.MEDIA_TYPE;
  constructor() {
    super('This file is not a supported image');
  }
}

/** A media item still used by a product cannot be deleted (D2128). */
export class MediaInUseError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.MEDIA_IN_USE;
  constructor() {
    super('This media item is used by a product');
  }
}

/** An order manager that is not a member of the business with access to the product's store (D2114). */
export class OrderManagerUnknownError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.ORDER_MANAGER_UNKNOWN;
  constructor() {
    super('An order manager is not a member of this store');
  }
}

/** Order managers cannot be checked because no team check is registered (D2114). */
export class OrderManagersUnavailableError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.ORDER_MANAGERS_UNAVAILABLE;
  constructor() {
    super('Order managers cannot be set right now');
  }
}

/** Another brand or tag of the store already has that name, compared without case and Unicode form (D2140). */
export class NameTakenError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.NAME_TAKEN;
  constructor() {
    super('This name is already used');
  }
}

/** Every catalog error, one per code of `CATALOG_ERROR_CODES`; the API's error mapping covers each. */
export const CATALOG_ERROR_CLASSES = [
  ProductNotFoundError,
  InvalidCatalogInputError,
  TooManyHighlightsError,
  MatrixTooLargeError,
  DuplicateOptionValueError,
  DuplicateOptionNameError,
  BrandNotFoundError,
  TagNotFoundError,
  HighlightNotFoundError,
  MediaNotFoundError,
  MediaTooLargeError,
  MediaTypeError,
  MediaInUseError,
  OrderManagerUnknownError,
  OrderManagersUnavailableError,
  NameTakenError,
] as const;
