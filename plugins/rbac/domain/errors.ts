import { type BusinessId, DomainError, RBAC_ERROR_CODES, type RbacErrorCode } from '@cod/shared';

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

/** A business whose row has no owner role or administrator, so its Owner cannot be bound (D57). */
export class BusinessOwnerLinkMissingError extends Error {
  constructor(businessId: BusinessId) {
    super(`Business ${businessId} has no owner role or owner administrator`);
    this.name = 'BusinessOwnerLinkMissingError';
  }
}

/** One business the converge could not bring to the shipped roles. */
export interface ConvergeFailure {
  readonly businessId: BusinessId;
  readonly reason: string;
}

const REPORTED_FAILURES = 20;

/** Some businesses failed to converge; every other business was committed, and a later migrate retries these (D57). */
export class RbacConvergeFailedError extends Error {
  constructor(
    readonly businesses: number,
    readonly changed: number,
    readonly failures: readonly ConvergeFailure[],
  ) {
    const listed = failures.slice(0, REPORTED_FAILURES).map(({ businessId, reason }) => `${businessId}: ${reason}`);
    super(`${String(failures.length)} of ${String(businesses)} businesses failed to converge: ${listed.join('; ')}`);
    this.name = 'RbacConvergeFailedError';
  }
}
