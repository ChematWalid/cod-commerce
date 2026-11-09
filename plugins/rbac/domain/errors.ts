import { DomainError, RBAC_ERROR_CODES, type RbacErrorCode } from '@cod/shared';

/** A refusal of the roles feature; its code is one of the stable `RBAC_ERROR_CODES`. */
export abstract class RbacError extends DomainError {
  abstract override readonly code: RbacErrorCode;
}

/** A role name that is empty or too long once normalised (D71). */
export class RoleNameInvalidError extends RbacError {
  readonly code = RBAC_ERROR_CODES.NAME_INVALID;

  constructor() {
    super('A role name must be between 1 and 60 characters');
  }
}
