import { fieldOf, type IsolationHttp } from './http';
import { ownChannel } from './matrix';
import type { BusinessWorld } from './world-types';

/**
 * The Team rows (plugins/team, P1.S4) of one business, seeded through the Team Admin API as its owner. A salary
 * payment is not among them: only an active member other than the payer can be paid (`team.self-action` for the
 * owner's own row), and the only way to an active non-owner member is accepting the invitation mail's token.
 */
export interface TeamWorld {
  /** The owner's own member row: active, receiving orders, so also the business's one order manager (D209, D215). */
  readonly ownerMemberId: string;
  /** A member whose invitation is pending; the invitation is reached by its member id (no invitation id is exposed). */
  readonly invited: { readonly memberId: string; readonly email: string };
  /** A commission config of the business, given to the invited member. */
  readonly commission: { readonly id: string; readonly name: string };
}

/**
 * The Team rows of businesses A and B, filled by the controller with {@link seedTeam} until `TeamWorld` is part of
 * `BusinessWorld`. The team cases read the victim's (and the attacker's) rows from here.
 */
export const TEAM_WORLDS = new Map<'A' | 'B', TeamWorld>();

const CREATE_COMMISSION = `mutation ($input: TeamCommissionConfigInput!) {
  createTeamCommissionConfig(input: $input) { id name }
}`;
const INVITE_MEMBER = 'mutation ($input: InviteMemberInput!) { inviteMember(input: $input) { id email status } }';
const ACTIVE_MEMBERS = `query ($input: TeamMembersInput) {
  teamMembers(input: $input) { items { id administratorId email status } }
}`;

interface MemberRow {
  readonly id: string;
  readonly administratorId: string | null;
  readonly email: string;
  readonly status: string;
}

/**
 * Seeds `business`'s Team rows as its owner on its first store: a commission config, a pending invitation that is
 * given it, and finds the owner's own member row (made at provisioning). Names and addresses carry the business id,
 * so they are unique to the run like the rest of the world.
 *
 * @throws Error when a call fails or the owner has no member row.
 */
export async function seedTeam(http: IsolationHttp, business: BusinessWorld): Promise<TeamWorld> {
  const channel = ownChannel(business);
  const as = async <T>(query: string, variables: Record<string, unknown>, field: string): Promise<T> =>
    fieldOf(await http.graphql(business.owner, query, variables, channel), field) as T;
  const tag = `${business.label} ${business.businessId}`;
  const commissionInput = {
    name: `Commission ${tag}`,
    basis: 'per-confirmed-order',
    valueKind: 'fixed',
    value: 150,
    scope: 'all',
  };
  const commission = await as<{ id: string; name: string }>(
    CREATE_COMMISSION,
    { input: commissionInput },
    'createTeamCommissionConfig',
  );
  const inviteInput = {
    email: `invitee-${business.label.toLowerCase()}-${business.businessId}@example.test`,
    roleIds: [business.role.id],
    storeAccess: 'selected',
    storeIds: [business.stores[0].id],
    baseSalary: 25_000,
    commissionConfigIds: [commission.id],
    locale: 'en',
  };
  const invited = await as<MemberRow>(INVITE_MEMBER, { input: inviteInput }, 'inviteMember');
  const page = await as<{ items: readonly MemberRow[] }>(
    ACTIVE_MEMBERS,
    { input: { tab: 'active', page: 1 } },
    'teamMembers',
  );
  const owner = page.items.find((member) => member.administratorId === business.owner.administratorId);
  if (owner === undefined) throw new Error(`business ${business.label}: the owner has no team member row`);
  return {
    ownerMemberId: owner.id,
    invited: { memberId: invited.id, email: invited.email },
    commission: { id: commission.id, name: commission.name },
  };
}

/** Every value that identifies `team`'s rows, for the leak scanner (with `fingerprintsOf` of its business). */
export function teamFingerprints(team: TeamWorld): string[] {
  return [team.ownerMemberId, team.invited.memberId, team.invited.email, team.commission.id, team.commission.name];
}
