import type { BusinessId, Snowflake } from '@cod/shared';
import type { AdministratorProfile } from './administrator-profile';
import { emailKeyOf, type TeamMember } from './team-member';

/** What adopting an existing administrator as a member needs. */
export interface AdoptedMemberInput {
  readonly id: Snowflake;
  readonly businessId: BusinessId;
  readonly profile: AdministratorProfile;
  readonly now: Date;
}

/** An empty name is no name. */
const nameOrNull = (name: string): string | null => (name.trim() === '' ? null : name);

/**
 * An administrator who already has an account (the owner, or a member given access outside Team) as an active member
 * who joined now (D215). It was never invited and has no salary yet; its access stays in rbac (D204).
 */
export function adoptedMember({ id, businessId, profile, now }: AdoptedMemberInput): TeamMember {
  return {
    id,
    businessId,
    administratorId: profile.administratorId,
    email: profile.email,
    emailKey: emailKeyOf(profile.email),
    firstName: nameOrNull(profile.firstName),
    lastName: nameOrNull(profile.lastName),
    status: 'active',
    suspendedAccess: null,
    commissionConfigIds: [],
    baseSalary: 0,
    maxOpenOrders: null,
    receivingOrders: true,
    invitedByAdministratorId: null,
    invitedAt: null,
    joinedAt: now,
    removedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
