import { type BusinessId, type MemberStatus, normalizeEmail, type Snowflake } from '@cod/shared';
import type { MemberGrant } from './member-grant';

/**
 * A person on a business's team (D200): invited (no account yet, `administratorId` null), active or inactive. Roles
 * and stores live in rbac (D204); only a deactivated member keeps its former grant here, in `suspendedAccess`.
 */
export interface TeamMember {
  readonly id: Snowflake;
  readonly businessId: BusinessId;
  readonly administratorId: number | null;
  readonly email: string;
  readonly emailKey: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly status: MemberStatus;
  readonly suspendedAccess: MemberGrant | null;
  readonly commissionConfigIds: readonly Snowflake[];
  /** Monthly base salary in whole DZD (ADR 0004). */
  readonly baseSalary: number;
  /** Most open orders the member may hold, or `null` for no limit. */
  readonly maxOpenOrders: number | null;
  readonly receivingOrders: boolean;
  readonly invitedByAdministratorId: number | null;
  readonly invitedAt: Date | null;
  readonly joinedAt: Date | null;
  /** Set when the member was removed or its invitation revoked; frees the email for a new invitation. */
  readonly removedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A member as the API shows it: no business id, no lookup key, no suspended grant and never a token. */
export interface TeamMemberView {
  readonly id: Snowflake;
  readonly administratorId: number | null;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly status: MemberStatus;
  readonly commissionConfigIds: readonly Snowflake[];
  readonly baseSalary: number;
  readonly maxOpenOrders: number | null;
  readonly receivingOrders: boolean;
  readonly invitedAt: Date | null;
  readonly joinedAt: Date | null;
}

/** The key that decides whether two addresses are the same member: `Foo@X.com ` equals `foo@x.com`. */
export function emailKeyOf(email: string): string {
  return normalizeEmail(email);
}

/** Copies the fields a client may see, field by field, so a new internal field never leaks by default. */
export function toTeamMemberView(member: TeamMember): TeamMemberView {
  return {
    id: member.id,
    administratorId: member.administratorId,
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    status: member.status,
    commissionConfigIds: member.commissionConfigIds,
    baseSalary: member.baseSalary,
    maxOpenOrders: member.maxOpenOrders,
    receivingOrders: member.receivingOrders,
    invitedAt: member.invitedAt,
    joinedAt: member.joinedAt,
  };
}
