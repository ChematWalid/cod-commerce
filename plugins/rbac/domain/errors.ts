import { DomainError, type RbacErrorCode } from '@cod/shared';

/** A refusal of the roles feature; its code is one of the stable `RBAC_ERROR_CODES`. */
export abstract class RbacError extends DomainError {
  abstract override readonly code: RbacErrorCode;
}
