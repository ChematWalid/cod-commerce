/** Stable error codes of the team API; clients map them to translated messages. */
export const TEAM_ERROR_CODES = {
  MEMBER_NOT_FOUND: 'team.member-not-found',
  EMAIL_ALREADY_MEMBER: 'team.email-already-member',
  INVITATION_INVALID: 'team.invitation-invalid',
  INVITATION_EXPIRED: 'team.invitation-expired',
  RESEND_COOLDOWN: 'team.resend-cooldown',
  NOT_PENDING: 'team.member-not-pending',
  NOT_ACTIVE: 'team.member-not-active',
  OWNER_PROTECTED: 'team.owner-protected',
  ACCOUNT_ELSEWHERE: 'team.account-elsewhere',
  COMMISSION_NOT_FOUND: 'team.commission-not-found',
  COMMISSION_IN_USE: 'team.commission-in-use',
  INVALID_INPUT: 'team.invalid-input',
  ACCESS_UNAVAILABLE: 'team.access-unavailable',
  MEMBER_SUSPENDED: 'team.member-suspended',
  SELF_ACTION: 'team.self-action',
  RESEND_LIMIT: 'team.resend-limit',
  TOO_MANY_PENDING: 'team.too-many-pending',
} as const;

/** One of the {@link TEAM_ERROR_CODES} values. */
export type TeamErrorCode = (typeof TEAM_ERROR_CODES)[keyof typeof TEAM_ERROR_CODES];
