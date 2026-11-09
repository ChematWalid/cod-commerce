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

/** The administrator is not a member of the caller's business, or the id cannot name one (D68). */
export class MemberNotFoundError extends RbacError {
  readonly code = RBAC_ERROR_CODES.MEMBER_NOT_FOUND;

  constructor() {
    super('Member not found');
  }
}

/** The role is not one of the caller's business. */
export class RoleNotFoundError extends RbacError {
  readonly code = RBAC_ERROR_CODES.ROLE_NOT_FOUND;

  constructor() {
    super('Role not found');
  }
}

/** A built-in role is defined by the platform and cannot be changed or removed (D61). */
export class BuiltInImmutableError extends RbacError {
  readonly code = RBAC_ERROR_CODES.BUILT_IN_IMMUTABLE;

  constructor() {
    super('A built-in role cannot be changed');
  }
}

/** A role some member still holds cannot be deleted. */
export class RoleInUseError extends RbacError {
  readonly code = RBAC_ERROR_CODES.ROLE_IN_USE;

  constructor() {
    super('This role is still assigned to members');
  }
}

/** Another role of the business already has this name, once normalised (D71). */
export class RoleNameTakenError extends RbacError {
  readonly code = RBAC_ERROR_CODES.NAME_TAKEN;

  constructor() {
    super('A role with this name already exists');
  }
}

/** A role description over the limit (D71). */
export class RoleDescriptionTooLongError extends RbacError {
  readonly code = RBAC_ERROR_CODES.DESCRIPTION_TOO_LONG;

  constructor() {
    super('The role description is too long');
  }
}

/** The business holds as many custom roles as it may (D71). */
export class RoleLimitError extends RbacError {
  readonly code = RBAC_ERROR_CODES.ROLE_LIMIT;

  constructor() {
    super('This business has reached its limit of custom roles');
  }
}

/** The actor does not hold what the change needs (D60). */
export class PrivilegeExceededError extends RbacError {
  readonly code = RBAC_ERROR_CODES.PRIVILEGE_EXCEEDED;

  constructor() {
    super('You cannot grant or change more than you hold');
  }
}

/** Nobody changes their own assignment (D60.5). */
export class SelfAssignmentError extends RbacError {
  readonly code = RBAC_ERROR_CODES.SELF_ASSIGNMENT;

  constructor() {
    super('You cannot change your own access');
  }
}

/** A non-owner edited a role they hold (D60.6). */
export class SelfHeldRoleError extends RbacError {
  readonly code = RBAC_ERROR_CODES.SELF_HELD_ROLE;

  constructor() {
    super('You cannot edit a role you hold');
  }
}

/** Only an Owner holder grants or removes Owner (D60.7). */
export class OwnerRestrictedError extends RbacError {
  readonly code = RBAC_ERROR_CODES.OWNER_RESTRICTED;

  constructor() {
    super('Only an owner can grant or remove the Owner role');
  }
}

/** The change would leave the business without its owner or any Owner holder (D60.8). */
export class LastOwnerError extends RbacError {
  readonly code = RBAC_ERROR_CODES.LAST_OWNER;

  constructor() {
    super('The business must keep its owner');
  }
}

/** A named store is another business's, archived, or out of the actor's reach. */
export class StoreNotAccessibleError extends RbacError {
  readonly code = RBAC_ERROR_CODES.STORE_NOT_ACCESSIBLE;

  constructor() {
    super('That store is not accessible');
  }
}

/** Selected-store access names no store. */
export class StoreAccessInvalidError extends RbacError {
  readonly code = RBAC_ERROR_CODES.STORE_ACCESS_INVALID;

  constructor() {
    super('Selected-store access needs at least one store');
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
    const omitted = failures.length - listed.length;
    const more = omitted > 0 ? `; and ${String(omitted)} more` : '';
    super(
      `${String(failures.length)} of ${String(businesses)} businesses failed to converge: ${listed.join('; ')}${more}`,
    );
    this.name = 'RbacConvergeFailedError';
  }
}
