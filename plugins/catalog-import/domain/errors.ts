import { CATALOG_IMPORT_ERROR_CODES, DomainError } from '@cod/shared';

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
