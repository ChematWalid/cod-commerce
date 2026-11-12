import { INVITATION_TTL_MS, toSnowflake } from '@cod/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { GetMemberService } from '../../application/get-member.service';
import { ListMembersService } from '../../application/list-members.service';
import type { MemberReadPorts } from '../../application/member-read-ports';
import { MemberNotFoundError } from '../../domain/errors';
import { ORDER_COUNT_PLACEHOLDER } from '../../domain/constants';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { TeamActor } from '../../domain/team-actor';
import { FakeMemberAccess } from '../fakes/invitation-fakes';
import { InMemoryInvitationRepository } from '../fakes/in-memory-invitation-repository';
import { InMemoryMemberRepository } from '../fakes/in-memory-member-repository';
import { FakeMemberDirectory } from '../fakes/member-read-fakes';
import { invitedMember, openInvitation, scopeA, scopeB, T0 } from '../support/builders';

const ctx = asOperationContext({});
const NOW = new Date(T0.getTime() + 1000);
const S1 = toSnowflake('11');
const S2 = toSnowflake('12');
const MANAGER = toSnowflake('900');
const AGENT = toSnowflake('901');
const actor: TeamActor = { administratorId: 1, scope: scopeA, ip: null, userAgent: null };
const SEES_SALARY = { canSeeSalary: true };

let members: InMemoryMemberRepository;
let invitations: InMemoryInvitationRepository;
let access: FakeMemberAccess;
let directory: FakeMemberDirectory;
let ports: MemberReadPorts;

beforeEach(() => {
  members = new InMemoryMemberRepository();
  invitations = new InMemoryInvitationRepository();
  access = new FakeMemberAccess([]);
  directory = new FakeMemberDirectory();
  directory.roles.set(MANAGER, 'Manager').set(AGENT, 'Agent');
  directory.stores.set(S1, 'Main').set(S2, 'Second');
  ports = { members, invitations, access, directory, clock: { now: () => NOW } };
});

/** An active member holding `roleId` on `storeIds` in rbac, or on every store. */
async function activeOn(storeIds: readonly (typeof S1)[] | 'all', administratorId: number, roleId = AGENT) {
  const member = invitedMember(scopeA, {
    status: 'active',
    administratorId,
    firstName: 'Amina',
    lastName: 'Bensalem',
    joinedAt: T0,
  });
  await members.insert(ctx, scopeA, member);
  directory.held.set(administratorId, {
    roleIds: [roleId],
    storeAccess: storeIds === 'all' ? 'all' : 'selected',
    storeIds: storeIds === 'all' ? [] : storeIds,
  });
  return member;
}

/** An invited member whose open invitation grants `roleId` on `storeIds`. */
async function invitedOn(storeIds: readonly (typeof S1)[], overrides: { expired?: boolean } = {}) {
  const member = invitedMember(scopeA);
  await members.insert(ctx, scopeA, member);
  const expiresAt = overrides.expired === true ? T0 : new Date(T0.getTime() + INVITATION_TTL_MS);
  await invitations.insert(
    ctx,
    scopeA,
    openInvitation(member, {
      grant: { roleIds: [MANAGER], storeAccess: 'selected', storeIds },
      expiresAt,
      tokenHash: member.id.padStart(64, '0'),
    }),
  );
  return member;
}

describe('ListMembersService', () => {
  it('shows each member with its roles, stores and status from where they live (D204)', async () => {
    // Arrange
    const active = await activeOn([S1], 41);
    const pending = await invitedOn([S2], { expired: true });
    const inactive = invitedMember(scopeA, {
      status: 'inactive',
      administratorId: 42,
      suspendedAccess: { roleIds: [MANAGER, toSnowflake('999')], storeAccess: 'all', storeIds: [] },
    });
    await members.insert(ctx, scopeA, inactive);

    // Act
    const page = await new ListMembersService(ports).list(ctx, actor, { tab: 'all', page: 1 }, SEES_SALARY);

    // Assert
    const byId = new Map(page.items.map((item) => [item.id, item]));
    expect(byId.get(active.id)).toMatchObject({
      name: 'Amina Bensalem',
      tab: 'active',
      invitationExpired: false,
      roles: [{ id: AGENT, name: 'Agent' }],
      storeAccess: 'selected',
      storeIds: [S1],
      storeNames: ['Main'],
      ordersCount: ORDER_COUNT_PLACEHOLDER,
      baseSalary: 30_000,
    });
    expect(byId.get(pending.id)).toMatchObject({
      name: null,
      tab: 'pending',
      invitationExpired: true,
      roles: [{ id: MANAGER, name: 'Manager' }],
      storeNames: ['Second'],
    });
    // A role deleted since the deactivation is not shown (D214).
    expect(byId.get(inactive.id)).toMatchObject({
      tab: 'inactive',
      roles: [{ id: MANAGER, name: 'Manager' }],
      storeAccess: 'all',
      storeNames: [],
    });
    expect(page.counts).toEqual({ all: 3, active: 1, pending: 1, inactive: 1 });
  });

  it('leaves out removed members and members of another business', async () => {
    // Arrange
    await activeOn('all', 41);
    await members.insert(ctx, scopeA, invitedMember(scopeA, { removedAt: T0 }));
    await members.insert(ctx, scopeB, invitedMember(scopeB, { status: 'active', administratorId: 41 }));

    // Act
    const page = await new ListMembersService(ports).list(ctx, actor, { tab: 'all', page: 1 }, SEES_SALARY);

    // Assert
    expect(page.total).toBe(1);
    expect(page.counts.all).toBe(1);
  });

  it('hides members a store-limited actor does not reach from the list and the counts (D211)', async () => {
    // Arrange
    access.reach = { allStores: false, storeIds: [S1] };
    const onS1 = await activeOn([S1], 41);
    await activeOn([S2], 42);
    await activeOn([S1, S2], 43);
    await activeOn('all', 44);
    const invitedOnS1 = await invitedOn([S1]);
    await invitedOn([S2]);

    // Act
    const page = await new ListMembersService(ports).list(ctx, actor, { tab: 'all', page: 1 }, SEES_SALARY);

    // Assert
    expect(page.items.map((item) => item.id).sort()).toEqual([onS1.id, invitedOnS1.id].sort());
    expect(page.counts).toEqual({ all: 2, active: 1, pending: 1, inactive: 0 });
  });

  it('shows no salary to a caller without team.members.edit (D207)', async () => {
    // Arrange
    await activeOn('all', 41);

    // Act
    const page = await new ListMembersService(ports).list(ctx, actor, { tab: 'active', page: 1 }, {});

    // Assert
    expect(page.items.map((item) => item.baseSalary)).toEqual([null]);
  });
});

describe('GetMemberService', () => {
  it('shows one member the actor reaches', async () => {
    // Arrange
    const member = await activeOn([S1], 41);

    // Act
    const details = await new GetMemberService(ports).get(ctx, actor, member.id, SEES_SALARY);

    // Assert
    expect(details).toMatchObject({ id: member.id, email: member.email, roles: [{ id: AGENT, name: 'Agent' }] });
  });

  it.each([
    ['out of the actor reach', 'reach'],
    ['removed', 'removed'],
    ['of another business', 'foreign'],
    ['unknown', 'unknown'],
  ] as const)('answers member-not-found for a member %s', async (_case, kind) => {
    // Arrange
    if (kind === 'reach') access.reach = { allStores: false, storeIds: [S1] };
    const onS2 = await activeOn([S2], 41);
    const removed = invitedMember(scopeA, { removedAt: T0 });
    await members.insert(ctx, scopeA, removed);
    const foreign = invitedMember(scopeB);
    await members.insert(ctx, scopeB, foreign);
    const id = { reach: onS2.id, removed: removed.id, foreign: foreign.id, unknown: toSnowflake('77') }[kind];

    // Act
    const read = new GetMemberService(ports).get(ctx, actor, id, SEES_SALARY);

    // Assert
    await expect(read).rejects.toBeInstanceOf(MemberNotFoundError);
  });
});
