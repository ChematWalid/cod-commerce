/** Stable error codes of the roles and access API; clients map them to translated messages. */
export const RBAC_ERROR_CODES = {
  ROLE_NOT_FOUND: 'rbac.role-not-found',
  MEMBER_NOT_FOUND: 'rbac.member-not-found',
  BUILT_IN_IMMUTABLE: 'rbac.built-in-immutable',
  ROLE_IN_USE: 'rbac.role-in-use',
  NAME_TAKEN: 'rbac.name-taken',
  NAME_INVALID: 'rbac.name-invalid',
  DESCRIPTION_TOO_LONG: 'rbac.description-too-long',
  ROLE_LIMIT: 'rbac.role-limit',
  UNKNOWN_PERMISSION: 'rbac.unknown-permission',
  PRIVILEGE_EXCEEDED: 'rbac.privilege-exceeded',
  SELF_ASSIGNMENT: 'rbac.self-assignment',
  SELF_HELD_ROLE: 'rbac.self-held-role',
  OWNER_RESTRICTED: 'rbac.owner-restricted',
  LAST_OWNER: 'rbac.last-owner',
  STORE_NOT_ACCESSIBLE: 'rbac.store-not-accessible',
  STORE_ACCESS_INVALID: 'rbac.store-access-invalid',
  MEMBER_SUSPENDED: 'rbac.member-suspended',
} as const;

/** One of the {@link RBAC_ERROR_CODES} values. */
export type RbacErrorCode = (typeof RBAC_ERROR_CODES)[keyof typeof RBAC_ERROR_CODES];

/** Activity-log actions written by the roles and team features. */
export const ACTIVITY_ACTIONS = {
  ROLE_CREATED: 'rbac.role.created',
  ROLE_UPDATED: 'rbac.role.updated',
  ROLE_DELETED: 'rbac.role.deleted',
  ROLE_DUPLICATED: 'rbac.role.duplicated',
  MEMBER_ACCESS_CHANGED: 'rbac.member-access.changed',
  MEMBER_INVITED: 'team.member.invited',
  INVITATION_RESENT: 'team.invitation.resent',
  INVITATION_REVOKED: 'team.invitation.revoked',
  INVITATION_ACCEPTED: 'team.invitation.accepted',
  MEMBER_UPDATED: 'team.member.updated',
  MEMBER_DEACTIVATED: 'team.member.deactivated',
  MEMBER_REACTIVATED: 'team.member.reactivated',
  MEMBER_REMOVED: 'team.member.removed',
  SALARY_PAID: 'team.salary.paid',
  COMMISSION_CREATED: 'team.commission.created',
  COMMISSION_UPDATED: 'team.commission.updated',
  COMMISSION_DELETED: 'team.commission.deleted',
} as const;

/** One of the {@link ACTIVITY_ACTIONS} values. */
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS];

/**
 * The entity types activity rows are written with. Each names one kind of id, so filtering on a type and an id never
 * mixes an administrator (`member`) with a Team member (`team-member`).
 */
export const ACTIVITY_ENTITY_TYPES = {
  ROLE: 'role',
  MEMBER: 'member',
  TEAM_MEMBER: 'team-member',
  COMMISSION_CONFIG: 'commission-config',
} as const;

/** One of the {@link ACTIVITY_ENTITY_TYPES} values. */
export type ActivityEntityType = (typeof ACTIVITY_ENTITY_TYPES)[keyof typeof ACTIVITY_ENTITY_TYPES];

/**
 * Actions whose rows carry no store and describe a team member, its access or a commission (D217). rbac's activity
 * query shows them only to viewers with all-store access, so a store-limited viewer never learns of members outside
 * its reach (D211). The member-access change counts too: every Team action that touches access writes one next to
 * its team row, and its diff names the member's roles and stores.
 */
export const ALL_STORES_ONLY_ACTIVITY_ACTIONS: readonly ActivityAction[] = Object.values(ACTIVITY_ACTIONS).filter(
  (action) => action.startsWith('team.') || action === ACTIVITY_ACTIONS.MEMBER_ACCESS_CHANGED,
);

const ALL_STORES_ONLY_SET: ReadonlySet<string> = new Set(ALL_STORES_ONLY_ACTIVITY_ACTIONS);

/** Whether rows of `action` are shown only to viewers with all-store access (D217). */
export function isAllStoresOnlyActivityAction(action: string): boolean {
  return ALL_STORES_ONLY_SET.has(action);
}
