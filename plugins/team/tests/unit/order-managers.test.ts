import { toSnowflake } from '@cod/shared';
import { describe, expect, it } from 'vitest';
import { ListOrderManagersService } from '../../application/list-order-managers.service';
import { asOperationContext } from '../../domain/ports/operation-context';
import type { TeamActor } from '../../domain/team-actor';
import { FakeMemberAccess } from '../fakes/invitation-fakes';
import { InMemoryInvitationRepository } from '../fakes/in-memory-invitation-repository';
import { InMemoryMemberRepository } from '../fakes/in-memory-member-repository';
import { FakeMemberDirectory } from '../fakes/member-read-fakes';
import { invitedMember, scopeA, scopeB, T0 } from '../support/builders';

const ctx = asOperationContext({});
const S1 = toSnowflake('11');
const S2 = toSnowflake('12');
const ROLE = toSnowflake('901');
const actor: TeamActor = { administratorId: 1, scope: scopeA, ip: null, userAgent: null };

describe('ListOrderManagersService.list (D209)', () => {
  it('lists the active members receiving orders that the actor reaches, of its business only', async () => {
    // Arrange
    const members = new InMemoryMemberRepository();
    const access = new FakeMemberAccess([]);
    const directory = new FakeMemberDirectory();
    const add = async (administratorId: number, storeIds: readonly (typeof S1)[], overrides = {}) => {
      const member = invitedMember(scopeA, { status: 'active', administratorId, joinedAt: T0, ...overrides });
      await members.insert(ctx, scopeA, member);
      directory.held.set(administratorId, { roleIds: [ROLE], storeAccess: 'selected', storeIds });
      return member;
    };
    const receiving = await add(10, [S1], { firstName: 'Amina', lastName: 'B', maxOpenOrders: 5 });
    await add(11, [S1], { receivingOrders: false });
    await add(12, [S1], {
      status: 'inactive',
      suspendedAccess: { roleIds: [ROLE], storeAccess: 'selected', storeIds: [S1] },
    });
    await add(13, [S2]);
    await members.insert(ctx, scopeB, invitedMember(scopeB, { status: 'active', administratorId: 14 }));
    access.reach = { allStores: false, storeIds: [S1] };
    const service = new ListOrderManagersService({
      members,
      invitations: new InMemoryInvitationRepository(),
      access,
      directory,
      clock: { now: () => T0 },
    });

    // Act
    const managers = await service.list(ctx, actor);

    // Assert
    expect(managers).toEqual([
      { id: receiving.id, name: 'Amina B', maxOpenOrders: 5, storeAccess: 'selected', storeIds: [S1] },
    ]);
  });
});
