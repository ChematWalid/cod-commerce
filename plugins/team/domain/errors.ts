import { DomainError, TEAM_ERROR_CODES } from '@cod/shared';

/** No member with that id in the business, or one outside the actor's store reach (D211). */
export class MemberNotFoundError extends DomainError {
  readonly code = TEAM_ERROR_CODES.MEMBER_NOT_FOUND;
  constructor() {
    super('No such team member');
  }
}

/** A live member of the business already has that address. */
export class EmailAlreadyMemberError extends DomainError {
  readonly code = TEAM_ERROR_CODES.EMAIL_ALREADY_MEMBER;
  constructor() {
    super('This address already belongs to a team member');
  }
}

/** The invitation cannot be used; one opaque reason for every cause, so a token reveals nothing (D213). */
export class InvitationInvalidError extends DomainError {
  readonly code = TEAM_ERROR_CODES.INVITATION_INVALID;
  constructor() {
    super('This invitation cannot be used');
  }
}

/** The invitation matched but its lifetime is over. */
export class InvitationExpiredError extends DomainError {
  readonly code = TEAM_ERROR_CODES.INVITATION_EXPIRED;
  constructor() {
    super('This invitation has expired');
  }
}

/** The invitation was sent less than the cooldown ago (D205). */
export class ResendCooldownError extends DomainError {
  readonly code = TEAM_ERROR_CODES.RESEND_COOLDOWN;
  constructor() {
    super('This invitation was sent moments ago');
  }
}

/** The action needs an invited member. */
export class MemberNotPendingError extends DomainError {
  readonly code = TEAM_ERROR_CODES.NOT_PENDING;
  constructor() {
    super('This member is not waiting for an invitation');
  }
}

/** The action needs an active member. */
export class MemberNotActiveError extends DomainError {
  readonly code = TEAM_ERROR_CODES.NOT_ACTIVE;
  constructor() {
    super('This member is not active');
  }
}

/** The business owner cannot be deactivated, removed or restricted (D204). */
export class OwnerProtectedError extends DomainError {
  readonly code = TEAM_ERROR_CODES.OWNER_PROTECTED;
  constructor() {
    super('The business owner cannot be changed this way');
  }
}

/** The invitee's address already has an account, in another business or outside the team (D201). */
export class AccountElsewhereError extends DomainError {
  readonly code = TEAM_ERROR_CODES.ACCOUNT_ELSEWHERE;
  constructor() {
    super('This address already belongs to another account');
  }
}

/** No commission config with that id in the business. */
export class CommissionNotFoundError extends DomainError {
  readonly code = TEAM_ERROR_CODES.COMMISSION_NOT_FOUND;
  constructor() {
    super('No such commission');
  }
}

/** A commission config still given to a member cannot be deleted. */
export class CommissionInUseError extends DomainError {
  readonly code = TEAM_ERROR_CODES.COMMISSION_IN_USE;
  constructor() {
    super('This commission is still given to a member');
  }
}

/** Input that breaks a team rule; the message never repeats the value. */
export class InvalidInputError extends DomainError {
  readonly code = TEAM_ERROR_CODES.INVALID_INPUT;
  constructor() {
    super('Invalid team input');
  }
}

/** A deactivated member's former roles or stores are gone, so it cannot be reactivated as it was (D214). */
export class AccessUnavailableError extends DomainError {
  readonly code = TEAM_ERROR_CODES.ACCESS_UNAVAILABLE;
  constructor() {
    super("This member's former access no longer exists");
  }
}

/** Access of a deactivated member cannot be changed sideways (D204). */
export class MemberSuspendedError extends DomainError {
  readonly code = TEAM_ERROR_CODES.MEMBER_SUSPENDED;
  constructor() {
    super('This member is deactivated');
  }
}

/** An actor may not pay itself or edit its own salary and commissions (D212). */
export class SelfActionError extends DomainError {
  readonly code = TEAM_ERROR_CODES.SELF_ACTION;
  constructor() {
    super('This action cannot be taken on your own member row');
  }
}

/** The invitation was resent as many times as allowed (D205). */
export class ResendLimitError extends DomainError {
  readonly code = TEAM_ERROR_CODES.RESEND_LIMIT;
  constructor() {
    super('This invitation cannot be resent again');
  }
}

/** The business holds as many open invitations as allowed (D205). */
export class TooManyPendingError extends DomainError {
  readonly code = TEAM_ERROR_CODES.TOO_MANY_PENDING;
  constructor() {
    super('Too many invitations are waiting');
  }
}

/** Every team error, one per code of `TEAM_ERROR_CODES`; the API's error mapping covers each. */
export const TEAM_ERROR_CLASSES = [
  MemberNotFoundError,
  EmailAlreadyMemberError,
  InvitationInvalidError,
  InvitationExpiredError,
  ResendCooldownError,
  MemberNotPendingError,
  MemberNotActiveError,
  OwnerProtectedError,
  AccountElsewhereError,
  CommissionNotFoundError,
  CommissionInUseError,
  InvalidInputError,
  AccessUnavailableError,
  MemberSuspendedError,
  SelfActionError,
  ResendLimitError,
  TooManyPendingError,
] as const;
