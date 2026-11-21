import { CATALOG_ERROR_CODES, CATALOG_IMPORT_ERROR_CODES, DomainError } from '@cod/shared';

const C = CATALOG_IMPORT_ERROR_CODES;

/** Input the import, export or bulk-edit rules refuse; the value is never repeated. */
export class InvalidImportInputError extends DomainError {
  readonly code = C.INVALID_INPUT;
  constructor() {
    super('Invalid import or export input');
  }
}

/** A file that is not of a registered spreadsheet format, or not of the one it was declared as. */
export class FileTypeError extends DomainError {
  readonly code = C.FILE_TYPE;
  constructor() {
    super('Unsupported file type');
  }
}

/** A file above the size cap, or one whose size differs from the declared one. */
export class FileTooLargeError extends DomainError {
  readonly code = C.FILE_TOO_LARGE;
  constructor() {
    super('The file is too large');
  }
}

/** The job, or the object it reads, is not in the state the call needs (an object re-written or gone, D2208). */
export class JobStateError extends DomainError {
  readonly code = C.JOB_STATE;
  constructor() {
    super('The job is not in a state that allows this');
  }
}

/** A bulk price change whose result is below 0 or above the money maximum: that product's error (D2213). */
export class PriceOutOfRangeError extends DomainError {
  readonly code = C.PRICE_OUT_OF_RANGE;
  constructor() {
    super('The new price is out of range');
  }
}

/** A brand or tag id of no brand or tag of the store, foreign ones included: same answer for both (D2213). */
export class TaxonomyNotFoundError extends DomainError {
  readonly code = C.TAXONOMY_NOT_FOUND;
  constructor() {
    super('Brand or tag not found');
  }
}

/** Collections cannot be bulk-edited until P2.S3 (D2213, D2221). */
export class CollectionsUnavailableError extends DomainError {
  readonly code = C.COLLECTIONS_UNAVAILABLE;
  constructor() {
    super('Collections are not available yet');
  }
}

/** A product of no product of the store: foreign, deleted and malformed ids answer the same (D2213). */
export class ProductNotFoundError extends DomainError {
  readonly code = CATALOG_ERROR_CODES.PRODUCT_NOT_FOUND;
  constructor() {
    super('Product not found');
  }
}

/** A job of no job of the store: another business's, another store's, a missing and a malformed id answer the same. */
export class JobNotFoundError extends DomainError {
  readonly code = C.JOB_NOT_FOUND;
  constructor() {
    super('Job not found');
  }
}

/** An export whose filter finds more products than one file holds (D2211). */
export class TooManyRowsError extends DomainError {
  readonly code = C.TOO_MANY_ROWS;
  constructor() {
    super('Too many rows');
  }
}

/** A file whose first rows hold no header naming a name and a price column (D2224). */
export class NoHeaderError extends DomainError {
  readonly code = C.NO_HEADER;
  constructor() {
    super('No header row found');
  }
}

/**
 * A confirm by an actor without `catalog.products.edit` of a preview holding update rows (D2207): the API answers it as
 * FORBIDDEN, like a missing permission.
 */
export class ConfirmNeedsEditError extends DomainError {
  readonly code = C.UPDATE_FORBIDDEN;
  constructor() {
    super('Confirming updates needs the edit permission');
  }
}

/** An update row whose product is no longer one of the store's when the worker applies it (D2209, D2210). */
export class RowProductNotFoundError extends DomainError {
  readonly code = C.ROW_PRODUCT_NOT_FOUND;
  constructor() {
    super('The row names no product of the store');
  }
}

/** A create group one of whose SKUs a product of the store took since the preview (D2285): the group is not created. */
export class RowSkuTakenError extends DomainError {
  readonly code = C.ROW_SKU_TAKEN;
  constructor() {
    super('A SKU of the row was taken since the preview');
  }
}

/**
 * A link the guard refuses (D2214): a scheme, port, userinfo or host it does not allow, a name that does not resolve,
 * resolves to a private address or fails DNS, or a page that is not HTML. One answer for all, so it is no oracle of
 * internal names; the address and the cause are never kept.
 */
export class LinkRefusedError extends DomainError {
  readonly code = C.LINK_REFUSED;
  constructor() {
    super('Link refused');
  }
}

/** A vetted link whose server could not be reached, answered too slowly or with an error status (D2214). */
export class LinkUnreachableError extends DomainError {
  readonly code = C.LINK_UNREACHABLE;
  constructor() {
    super('Link unreachable');
  }
}

/** An AI hook while the `ai.enabled` kill switch is off (D2215). */
export class AiDisabledError extends DomainError {
  readonly code = C.AI_DISABLED;
  constructor() {
    super('AI features are turned off');
  }
}
